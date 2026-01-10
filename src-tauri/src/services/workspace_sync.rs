use crate::models::page::Page;
use crate::services::markdown_mirror::markdown_to_blocks;
use rusqlite::{params, Connection};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use uuid::Uuid;
use walkdir::WalkDir;

pub struct WorkspaceSyncService {
    workspace_path: PathBuf,
}

impl WorkspaceSyncService {
    pub fn new(workspace_path: impl Into<PathBuf>) -> Self {
        Self {
            workspace_path: workspace_path.into(),
        }
    }

    /// Sync workspace: scan files and update DB incrementally
    pub fn sync(&self, conn: &Connection) -> Result<SyncStats, String> {
        let mut stats = SyncStats::default();

        // 1. Scan all .md files in workspace
        let mut files = self.scan_markdown_files()?;

        // Sort by depth (parent directories first) to ensure parent_id resolution
        files.sort_by_key(|f| {
            f.path
                .strip_prefix(&self.workspace_path)
                .map(|p| p.components().count())
                .unwrap_or(0)
        });

        // Separate directory notes from regular files
        let (dir_notes, regular_files): (Vec<_>, Vec<_>) = files
            .into_iter()
            .partition(|f| self.is_directory_note(&f.path));

        // 2. Get existing pages from DB
        let existing_pages = self.get_all_pages(conn)?;
        let mut existing_paths: std::collections::HashMap<String, Page> = existing_pages
            .into_iter()
            .filter_map(|p| p.file_path.clone().map(|path| (path, p)))
            .collect();

        // 3. Process directory notes first
        for file_info in dir_notes {
            let relative_path = self.get_relative_path(&file_info.path)?;

            match existing_paths.remove(&relative_path) {
                Some(page) => {
                    // File exists in DB - check if modified
                    if self.needs_reindex(&file_info, &page) {
                        self.reindex_file(conn, &file_info, &page.id)?;
                        stats.updated += 1;
                    } else {
                        stats.unchanged += 1;
                    }
                }
                None => {
                    // New file - index it
                    self.index_new_file(conn, &file_info)?;
                    stats.added += 1;
                }
            }
        }

        // 4. Process regular files (now parent_id can be resolved)
        for file_info in regular_files {
            let relative_path = self.get_relative_path(&file_info.path)?;

            match existing_paths.remove(&relative_path) {
                Some(page) => {
                    // File exists in DB - check if modified
                    if self.needs_reindex(&file_info, &page) {
                        self.reindex_file(conn, &file_info, &page.id)?;
                        stats.updated += 1;
                    } else {
                        stats.unchanged += 1;
                    }
                }
                None => {
                    // New file - index it
                    self.index_new_file(conn, &file_info)?;
                    stats.added += 1;
                }
            }
        }

        // 5. Remove pages that no longer have files
        for (_, page) in existing_paths {
            self.delete_page_from_db(conn, &page.id)?;
            stats.deleted += 1;
        }

        Ok(stats)
    }

    /// Full reindex: delete all and rebuild
    pub fn reindex_full(&self, conn: &Connection) -> Result<SyncStats, String> {
        // Backup recommendation: caller should handle this

        // Delete all blocks and pages
        conn.execute("DELETE FROM blocks", [])
            .map_err(|e| format!("Failed to delete blocks: {}", e))?;
        conn.execute("DELETE FROM pages", [])
            .map_err(|e| format!("Failed to delete pages: {}", e))?;

        // Run sync (all files will be treated as new)
        self.sync(conn)
    }

    /// Scan all .md files in workspace
    fn scan_markdown_files(&self) -> Result<Vec<FileInfo>, String> {
        let mut files = Vec::new();

        for entry in WalkDir::new(&self.workspace_path)
            .follow_links(true)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();

            // Skip if not a file
            if !path.is_file() {
                continue;
            }

            // Only .md files
            if path.extension().and_then(|s| s.to_str()) != Some("md") {
                continue;
            }

            // Get file metadata
            let metadata = fs::metadata(path)
                .map_err(|e| format!("Failed to read metadata for {:?}: {}", path, e))?;

            let mtime = metadata
                .modified()
                .map_err(|e| format!("Failed to get mtime: {}", e))?;

            let size = metadata.len();

            files.push(FileInfo {
                path: path.to_path_buf(),
                mtime,
                size,
            });
        }

        Ok(files)
    }

    /// Check if file needs reindexing (mtime or size changed)
    fn needs_reindex(&self, file_info: &FileInfo, page: &Page) -> bool {
        // Compare mtime
        if let Some(db_mtime) = page.file_mtime {
            if let Ok(duration) = file_info.mtime.duration_since(SystemTime::UNIX_EPOCH) {
                let file_mtime = duration.as_secs() as i64;
                if file_mtime != db_mtime {
                    return true;
                }
            }
        } else {
            // No mtime in DB - needs reindex
            return true;
        }

        // Compare size
        if let Some(db_size) = page.file_size {
            if file_info.size as i64 != db_size {
                return true;
            }
        } else {
            // No size in DB - needs reindex
            return true;
        }

        false
    }

    /// Index a new file
    fn index_new_file(&self, conn: &Connection, file_info: &FileInfo) -> Result<(), String> {
        let tx = conn
            .unchecked_transaction()
            .map_err(|e| format!("Failed to start transaction: {}", e))?;

        // Read file content
        let content = fs::read_to_string(&file_info.path)
            .map_err(|e| format!("Failed to read file {:?}: {}", file_info.path, e))?;

        // Extract title from first line or filename
        let title = self.extract_title(&content, &file_info.path);

        // Detect if this is a directory note (DirName/DirName.md pattern)
        let is_directory = self.is_directory_note(&file_info.path);

        // Detect parent_id by checking directory structure
        let parent_id = self.detect_parent_id(conn, &file_info.path)?;

        // Create page
        let page_id = Uuid::new_v4().to_string();
        let relative_path = self.get_relative_path(&file_info.path)?;
        let now = chrono::Utc::now().to_rfc3339();

        let mtime = file_info
            .mtime
            .duration_since(SystemTime::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .ok();

        tx.execute(
            "INSERT INTO pages (id, title, parent_id, file_path, is_directory, file_mtime, file_size, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                &page_id,
                &title,
                &parent_id,
                &relative_path,
                is_directory as i32,
                mtime,
                file_info.size as i64,
                &now,
                &now
            ],
        )
        .map_err(|e| format!("Failed to insert page: {}", e))?;

        // Parse markdown to blocks
        let blocks = markdown_to_blocks(&content, &page_id);

        // Insert blocks
        for block in blocks {
            tx.execute(
                "INSERT INTO blocks (id, page_id, parent_id, content, order_weight, is_collapsed, block_type, language, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                params![
                    &block.id,
                    &block.page_id,
                    &block.parent_id,
                    &block.content,
                    block.order_weight,
                    block.is_collapsed as i32,
                    format!("{:?}", block.block_type).to_lowercase(),
                    &block.language,
                    &block.created_at,
                    &block.updated_at,
                ],
            )
            .map_err(|e| format!("Failed to insert block: {}", e))?;
        }

        tx.commit()
            .map_err(|e| format!("Failed to commit transaction: {}", e))?;

        Ok(())
    }

    /// Reindex existing file (delete old blocks and reparse)
    fn reindex_file(
        &self,
        conn: &Connection,
        file_info: &FileInfo,
        page_id: &str,
    ) -> Result<(), String> {
        let tx = conn
            .unchecked_transaction()
            .map_err(|e| format!("Failed to start transaction: {}", e))?;

        // Delete existing blocks
        tx.execute("DELETE FROM blocks WHERE page_id = ?", [page_id])
            .map_err(|e| format!("Failed to delete blocks: {}", e))?;

        // Read file content
        let content = fs::read_to_string(&file_info.path)
            .map_err(|e| format!("Failed to read file {:?}: {}", file_info.path, e))?;

        // Extract title
        let title = self.extract_title(&content, &file_info.path);

        // Detect if this is a directory note
        let is_directory = self.is_directory_note(&file_info.path);

        // Detect parent_id by checking directory structure
        let parent_id = self.detect_parent_id(&tx, &file_info.path)?;

        // Update page metadata
        let now = chrono::Utc::now().to_rfc3339();
        let mtime = file_info
            .mtime
            .duration_since(SystemTime::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .ok();

        tx.execute(
            "UPDATE pages SET title = ?, parent_id = ?, is_directory = ?, file_mtime = ?, file_size = ?, updated_at = ? WHERE id = ?",
            params![&title, &parent_id, is_directory as i32, mtime, file_info.size as i64, &now, page_id],
        )
        .map_err(|e| format!("Failed to update page: {}", e))?;

        // Parse markdown to blocks
        let blocks = markdown_to_blocks(&content, page_id);

        // Insert blocks
        for block in blocks {
            tx.execute(
                "INSERT INTO blocks (id, page_id, parent_id, content, order_weight, is_collapsed, block_type, language, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                params![
                    &block.id,
                    &block.page_id,
                    &block.parent_id,
                    &block.content,
                    block.order_weight,
                    block.is_collapsed as i32,
                    format!("{:?}", block.block_type).to_lowercase(),
                    &block.language,
                    &block.created_at,
                    &block.updated_at,
                ],
            )
            .map_err(|e| format!("Failed to insert block: {}", e))?;
        }

        tx.commit()
            .map_err(|e| format!("Failed to commit transaction: {}", e))?;

        Ok(())
    }

    /// Delete page and its blocks from DB
    fn delete_page_from_db(&self, conn: &Connection, page_id: &str) -> Result<(), String> {
        // CASCADE will automatically delete blocks
        conn.execute("DELETE FROM pages WHERE id = ?", [page_id])
            .map_err(|e| format!("Failed to delete page: {}", e))?;
        Ok(())
    }

    /// Get all pages from DB
    fn get_all_pages(&self, conn: &Connection) -> Result<Vec<Page>, String> {
        let mut stmt = conn
            .prepare(
                "SELECT id, title, parent_id, file_path, is_directory, file_mtime, file_size, created_at, updated_at
                 FROM pages",
            )
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let pages = stmt
            .query_map([], |row| {
                Ok(Page {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    parent_id: row.get(2)?,
                    file_path: row.get(3)?,
                    is_directory: row.get::<_, i32>(4)? != 0,
                    file_mtime: row.get(5)?,
                    file_size: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            })
            .map_err(|e| format!("Failed to query pages: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to collect pages: {}", e))?;

        Ok(pages)
    }

    /// Get relative path from workspace root
    fn get_relative_path(&self, path: &Path) -> Result<String, String> {
        path.strip_prefix(&self.workspace_path)
            .map_err(|e| format!("Failed to get relative path: {}", e))?
            .to_str()
            .ok_or_else(|| "Invalid UTF-8 in path".to_string())
            .map(|s| s.to_string())
    }

    /// Extract title from markdown content or filename
    fn extract_title(&self, content: &str, path: &Path) -> String {
        // Try to find # Title in first few lines
        for line in content.lines().take(5) {
            let trimmed = line.trim();
            if trimmed.starts_with("# ") {
                return trimmed[2..].trim().to_string();
            }
        }

        // Fallback to filename without extension
        path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled")
            .to_string()
    }

    /// Check if a file is a directory note (pattern: DirName/DirName.md)
    fn is_directory_note(&self, path: &Path) -> bool {
        let file_stem = path.file_stem().and_then(|s| s.to_str());
        let parent_dir_name = path
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|n| n.to_str());

        if let (Some(stem), Some(parent)) = (file_stem, parent_dir_name) {
            return stem == parent;
        }

        false
    }

    /// Detect parent_id by checking if file is inside a directory note
    fn detect_parent_id(&self, conn: &Connection, path: &Path) -> Result<Option<String>, String> {
        let parent_dir = match path.parent() {
            Some(p) => p,
            None => return Ok(None),
        };

        // If parent is workspace root, no parent_id
        if parent_dir == self.workspace_path {
            return Ok(None);
        }

        // Check if there's a directory note in the parent directory
        let parent_dir_name = parent_dir
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or("Invalid parent directory name")?;

        let potential_dir_note_path = parent_dir.join(format!("{}.md", parent_dir_name));
        let relative_dir_note_path = self.get_relative_path(&potential_dir_note_path)?;

        // Check if this directory note exists in DB
        let parent_id: Option<String> = conn
            .query_row(
                "SELECT id FROM pages WHERE file_path = ?",
                [&relative_dir_note_path],
                |row| row.get(0),
            )
            .ok();

        Ok(parent_id)
    }
}

#[derive(Debug)]
struct FileInfo {
    path: PathBuf,
    mtime: SystemTime,
    size: u64,
}

#[derive(Debug, Default)]
pub struct SyncStats {
    pub added: usize,
    pub updated: usize,
    pub deleted: usize,
    pub unchanged: usize,
}

impl SyncStats {
    pub fn total_changed(&self) -> usize {
        self.added + self.updated + self.deleted
    }
}
