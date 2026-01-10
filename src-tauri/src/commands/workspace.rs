use crate::models::block::BlockType;
use crate::services::markdown_to_blocks;
// (removed) WorkspaceSyncService import: sync/reindex paths are unified on filesystem-driven `sync_workspace`
use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::SystemTime;
use uuid::Uuid;

/// Compute workspace-relative path from absolute path
/// Example: /home/user/repo/Test4/File.md with workspace /home/user/repo
/// Returns: "Test4/File.md" (always uses `/` separators)
fn compute_rel_path(abs_path: &Path, workspace_root: &Path) -> Result<String, String> {
    abs_path
        .strip_prefix(workspace_root)
        .map_err(|_| format!("Path {:?} is not under workspace root {:?}", abs_path, workspace_root))
        .and_then(|rel| {
            rel.to_str()
                .map(|s| {
                    // Convert backslashes to forward slashes for cross-platform consistency
                    s.replace('\\', "/")
                })
                .ok_or_else(|| "Path contains invalid UTF-8".to_string())
        })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MigrationResult {
    pub pages: usize,
    pub blocks: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspaceSettings {
    pub version: String,
    pub workspace_name: String,
    pub created_at: String,
    pub last_opened: String,
}

/// Helper function to open workspace-specific DB connection
pub fn open_workspace_db(workspace_path: &str) -> Result<Connection, String> {
    let db_path = get_workspace_db_path(workspace_path)?;

    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open workspace database: {}", e))?;

    // Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON", [])
        .map_err(|e| format!("Failed to enable foreign keys: {}", e))?;

    // Initialize schema
    crate::db::schema::init_schema(&conn)
        .map_err(|e| format!("Failed to initialize schema: {}", e))?;

    Ok(conn)
}

/// Get or create workspace metadata directory
fn get_workspace_metadata_dir(workspace_path: &str) -> Result<PathBuf, String> {
    let workspace = PathBuf::from(workspace_path);
    let metadata_dir = workspace.join(".md-outliner");

    if !metadata_dir.exists() {
        fs::create_dir_all(&metadata_dir)
            .map_err(|e| format!("Failed to create metadata directory: {}", e))?;
    }

    Ok(metadata_dir)
}

/// Get workspace database path
pub fn get_workspace_db_path(workspace_path: &str) -> Result<PathBuf, String> {
    let metadata_dir = get_workspace_metadata_dir(workspace_path)?;
    Ok(metadata_dir.join("outliner.db"))
}

/// Get workspace settings path
fn get_workspace_settings_path(workspace_path: &str) -> Result<PathBuf, String> {
    let metadata_dir = get_workspace_metadata_dir(workspace_path)?;
    Ok(metadata_dir.join("settings.json"))
}

/// Initialize or load workspace settings
fn init_workspace_settings(workspace_path: &str) -> Result<WorkspaceSettings, String> {
    let settings_path = get_workspace_settings_path(workspace_path)?;

    if settings_path.exists() {
        // Load existing settings
        let content = fs::read_to_string(&settings_path)
            .map_err(|e| format!("Failed to read settings: {}", e))?;
        let mut settings: WorkspaceSettings = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse settings: {}", e))?;

        // Update last_opened
        settings.last_opened = Utc::now().to_rfc3339();
        save_workspace_settings(workspace_path, &settings)?;

        Ok(settings)
    } else {
        // Create new settings
        let workspace_name = PathBuf::from(workspace_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Workspace")
            .to_string();

        let now = Utc::now().to_rfc3339();
        let settings = WorkspaceSettings {
            version: "0.1.0".to_string(),
            workspace_name,
            created_at: now.clone(),
            last_opened: now,
        };

        save_workspace_settings(workspace_path, &settings)?;

        Ok(settings)
    }
}

/// Save workspace settings
fn save_workspace_settings(
    workspace_path: &str,
    settings: &WorkspaceSettings,
) -> Result<(), String> {
    let settings_path = get_workspace_settings_path(workspace_path)?;
    let json = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(&settings_path, json).map_err(|e| format!("Failed to write settings: {}", e))?;

    Ok(())
}

/// Initialize workspace: create metadata directory, DB, and settings
#[tauri::command]
pub async fn initialize_workspace(workspace_path: String) -> Result<WorkspaceSettings, String> {
    // Create metadata directory
    let _metadata_dir = get_workspace_metadata_dir(&workspace_path)?;

    // Initialize settings
    let settings = init_workspace_settings(&workspace_path)?;

    // DB will be initialized by the connection manager

    Ok(settings)
}

/// Initialize database for a workspace
#[tauri::command]
pub async fn init_workspace_db(
    db: tauri::State<'_, Arc<std::sync::Mutex<rusqlite::Connection>>>,
) -> Result<bool, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    // Initialize database schema if not already done
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS workspace (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS pages (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            file_path TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS blocks (
            id TEXT PRIMARY KEY,
            page_id TEXT NOT NULL,
            parent_id TEXT,
            content TEXT NOT NULL,
            order_weight REAL NOT NULL,
            is_collapsed INTEGER NOT NULL DEFAULT 0,
            block_type TEXT NOT NULL DEFAULT 'bullet',
            language TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
            FOREIGN KEY (parent_id) REFERENCES blocks(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_blocks_page_id ON blocks(page_id);
        CREATE INDEX IF NOT EXISTS idx_blocks_parent_id ON blocks(parent_id);
        CREATE INDEX IF NOT EXISTS idx_blocks_order ON blocks(page_id, parent_id, order_weight);

        CREATE TABLE IF NOT EXISTS block_refs (
            id TEXT PRIMARY KEY,
            block_id TEXT NOT NULL,
            ref_block_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE,
            FOREIGN KEY (ref_block_id) REFERENCES blocks(id) ON DELETE CASCADE
        );",
    )
    .map_err(|e| e.to_string())?;

    Ok(true)
}

/// Migrate markdown files from workspace to SQLite database
#[tauri::command]
pub async fn migrate_workspace(
    db: tauri::State<'_, Arc<std::sync::Mutex<rusqlite::Connection>>>,
    workspace_path: String,
) -> Result<MigrationResult, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut migrated_pages = 0;
    let mut migrated_blocks = 0;

    // Store workspace path in database
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT OR REPLACE INTO workspace (id, path, created_at) VALUES ('default', ?, ?)",
        params![&workspace_path, &now],
    )
    .map_err(|e| e.to_string())?;

    // Recursively scan and migrate all markdown files
    let workspace_root = PathBuf::from(&workspace_path);
    let result = scan_and_migrate_directory(
        &conn,
        &workspace_root,
        &workspace_root,
        None,
        &mut migrated_pages,
        &mut migrated_blocks,
    )?;

    Ok(MigrationResult {
        pages: migrated_pages,
        blocks: migrated_blocks,
    })
}

/// Recursively scan directory and migrate markdown files
fn scan_and_migrate_directory(
    conn: &rusqlite::Connection,
    workspace_root: &Path,
    current_dir: &Path,
    parent_page_id: Option<&str>,
    migrated_pages: &mut usize,
    migrated_blocks: &mut usize,
) -> Result<(), String> {
    let entries =
        fs::read_dir(current_dir).map_err(|e| format!("Error reading directory: {}", e))?;

    let mut items: Vec<_> = entries.filter_map(|e| e.ok()).collect();
    items.sort_by(|a, b| {
        let a_name = a.file_name();
        let b_name = b.file_name();
        a_name.cmp(&b_name)
    });

    for entry in items {
        let path = entry.path();
        let metadata = entry
            .metadata()
            .map_err(|e| format!("Error reading metadata: {}", e))?;

        if metadata.is_file() {
            if let Some(ext) = path.extension() {
                if ext == "md" {
                    migrate_file(
                        conn,
                        workspace_root,
                        &path,
                        parent_page_id,
                        false,
                        migrated_pages,
                        migrated_blocks,
                    )?;
                }
            }
        } else if metadata.is_dir() {
            // Check if this directory has a corresponding .md file
            let dir_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            let folder_note_path = path.join(format!("{}.md", dir_name));

            let page_id = if folder_note_path.exists() {
                // This is a folder with a folder note
                let id = migrate_file(
                    conn,
                    workspace_root,
                    &folder_note_path,
                    parent_page_id,
                    true,
                    migrated_pages,
                    migrated_blocks,
                )?;
                Some(id)
            } else {
                None
            };

            // Recursively scan subdirectory
            scan_and_migrate_directory(
                conn,
                workspace_root,
                &path,
                page_id.as_deref().or(parent_page_id),
                migrated_pages,
                migrated_blocks,
            )?;
        }
    }

    Ok(())
}

/// Migrate a single markdown file to the database
fn migrate_file(
    conn: &rusqlite::Connection,
    workspace_root: &Path,
    file_path: &Path,
    parent_page_id: Option<&str>,
    is_directory: bool,
    migrated_pages: &mut usize,
    migrated_blocks: &mut usize,
) -> Result<String, String> {
    let file_name = file_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Untitled");

    let content = fs::read_to_string(file_path).map_err(|e| e.to_string())?;

    // Create page
    let page_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO pages (id, title, parent_id, file_path, is_directory, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![
            &page_id,
            file_name,
            parent_page_id,
            file_path.to_string_lossy().to_string(),
            if is_directory { 1 } else { 0 },
            &now,
            &now
        ],
    )
    .map_err(|e| e.to_string())?;

    // Parse and create blocks
    let blocks = markdown_to_blocks(&content, &page_id);

    for block in &blocks {
        conn.execute(
            "INSERT INTO blocks (id, page_id, parent_id, content, order_weight,
                                block_type, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                &block.id,
                &block.page_id,
                &block.parent_id,
                &block.content,
                block.order_weight,
                block_type_to_string(&block.block_type),
                &block.created_at,
                &block.updated_at
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    *migrated_pages += 1;
    *migrated_blocks += blocks.len();

    Ok(page_id)
}

fn block_type_to_string(bt: &BlockType) -> String {
    match bt {
        BlockType::Bullet => "bullet".to_string(),
        BlockType::Code => "code".to_string(),
        BlockType::Fence => "fence".to_string(),
    }
}

/// Set workspace path (called when workspace is selected)
#[tauri::command]
pub async fn set_workspace_path(
    db: tauri::State<'_, Arc<std::sync::Mutex<rusqlite::Connection>>>,
    workspace_path: String,
) -> Result<bool, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    // Insert or update workspace path
    conn.execute(
        "INSERT INTO workspace (id, path, created_at) VALUES ('default', ?, ?)
         ON CONFLICT(id) DO UPDATE SET path = excluded.path",
        params![&workspace_path, &now],
    )
    .map_err(|e| e.to_string())?;

    Ok(true)
}

/// Sync workspace: scan all markdown files and sync with database
/// This is the source of truth - filesystem drives the database
#[tauri::command]
pub async fn sync_workspace(workspace_path: String) -> Result<MigrationResult, String> {
    let conn = open_workspace_db(&workspace_path)?;
    let workspace_root = PathBuf::from(&workspace_path);

    println!(
        "[sync_workspace] Starting sync for workspace: {}",
        workspace_path
    );

    // Detect if DB contains absolute paths (P0 safety check)
    // If found, we must wipe DB and force full reindex
    {
        let mut stmt = conn
            .prepare("SELECT COUNT(*) FROM pages WHERE file_path IS NOT NULL AND (file_path LIKE '/%' OR file_path LIKE '%:\\%')")
            .map_err(|e| e.to_string())?;

        let has_absolute: i32 = stmt
            .query_row([], |row| row.get(0))
            .map_err(|e| e.to_string())?;

        if has_absolute > 0 {
            println!(
                "[sync_workspace] WARNING: DB contains {} absolute paths. Forcing full reindex to migrate to relative paths.",
                has_absolute
            );
            // Wipe all pages and blocks (DB is disposable cache per I2)
            conn.execute("DELETE FROM blocks", [])
                .map_err(|e| e.to_string())?;
            conn.execute("DELETE FROM pages", [])
                .map_err(|e| e.to_string())?;
        }
    }

    // Get all existing pages from DB
    // file_path MUST be workspace-relative at this point (or empty from migration above)
    let mut existing_pages: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();
    {
        let mut stmt = conn
            .prepare("SELECT id, file_path FROM pages WHERE file_path IS NOT NULL")
            .map_err(|e| e.to_string())?;

        let pages = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?;

        for page in pages {
            let (id, path) = page.map_err(|e| e.to_string())?;
            println!(
                "[sync_workspace] Found page in DB: id={}, path={}",
                id, path
            );
            existing_pages.insert(path, id);
        }
    }

    println!(
        "[sync_workspace] Total pages in DB: {}",
        existing_pages.len()
    );

    let mut synced_pages = 0;
    let mut synced_blocks = 0;

    // Scan filesystem
    let mut found_files = std::collections::HashSet::new();
    sync_directory(
        &conn,
        &workspace_root,
        &workspace_root,
        None,
        &mut existing_pages,
        &mut found_files,
        &mut synced_pages,
        &mut synced_blocks,
    )?;

    println!(
        "[sync_workspace] Found {} files in filesystem",
        found_files.len()
    );

    // Delete pages from DB that no longer exist in filesystem
    let mut deleted_count = 0;
    for (file_path, page_id) in existing_pages.iter() {
        if !found_files.contains(file_path) {
            println!(
                "[sync_workspace] DELETING orphaned page from DB: id={}, path={}",
                page_id, file_path
            );
            conn.execute("DELETE FROM pages WHERE id = ?", [page_id])
                .map_err(|e| e.to_string())?;
            deleted_count += 1;
        }
    }

    println!(
        "[sync_workspace] Sync complete: {} pages synced, {} blocks synced, {} pages deleted",
        synced_pages, synced_blocks, deleted_count
    );

    Ok(MigrationResult {
        pages: synced_pages,
        blocks: synced_blocks,
    })
}

/// Recursively sync directory with database
fn sync_directory(
    conn: &rusqlite::Connection,
    workspace_root: &Path,
    current_dir: &Path,
    parent_page_id: Option<&str>,
    existing_pages: &mut std::collections::HashMap<String, String>,
    found_files: &mut std::collections::HashSet<String>,
    synced_pages: &mut usize,
    synced_blocks: &mut usize,
) -> Result<(), String> {
    let entries = fs::read_dir(current_dir)
        .map_err(|e| format!("Error reading directory {}: {}", current_dir.display(), e))?;

    let mut items: Vec<_> = entries.filter_map(|e| e.ok()).collect();
    items.sort_by(|a, b| {
        let a_name = a.file_name();
        let b_name = b.file_name();
        a_name.cmp(&b_name)
    });

    // Skip .md-outliner directory and separate files/dirs up-front
    let mut file_entries: Vec<std::fs::DirEntry> = Vec::new();
    let mut dir_entries: Vec<std::fs::DirEntry> = Vec::new();

    for entry in items {
        let path = entry.path();

        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if name == ".md-outliner" {
                continue;
            }
        }

        let metadata = entry
            .metadata()
            .map_err(|e| format!("Error reading metadata: {}", e))?;

        if metadata.is_dir() {
            dir_entries.push(entry);
        } else if metadata.is_file() {
            file_entries.push(entry);
        }
    }

    // (1) Process subdirectories first so we can create directory pages (Dir/Dir.md)
    // and pass the correct parent_id when indexing their contents.
    for entry in dir_entries {
        let path = entry.path();
        let dir_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        let folder_note_path = path.join(format!("{}.md", dir_name));

        let page_id = if folder_note_path.exists() {
            // Store relative path in found_files
            let rel_path = compute_rel_path(&folder_note_path, workspace_root)?;
            found_files.insert(rel_path.clone());

            let id = sync_or_create_file(
                conn,
                workspace_root,
                &folder_note_path,
                parent_page_id,
                true,
                existing_pages,
                synced_pages,
                synced_blocks,
            )?;
            Some(id)
        } else {
            None
        };

        sync_directory(
            conn,
            workspace_root,
            &path,
            page_id.as_deref().or(parent_page_id),
            existing_pages,
            found_files,
            synced_pages,
            synced_blocks,
        )?;
    }

    // (2) Process regular markdown files in the current directory.
    // IMPORTANT: never index "directory note" files (Dir/Dir.md) as regular pages.
    for entry in file_entries {
        let path = entry.path();

        if let Some(ext) = path.extension() {
            if ext != "md" {
                continue;
            }
        } else {
            continue;
        }

        let is_dir_note = path
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|n| n.to_str())
            .zip(path.file_stem().and_then(|s| s.to_str()))
            .map(|(parent_name, stem)| parent_name == stem)
            .unwrap_or(false);

        if is_dir_note {
            // Store relative path in found_files for directory notes
            let rel_path = compute_rel_path(&path, workspace_root)?;
            println!(
                "[sync_directory] Skipping directory-note markdown file: {}",
                rel_path
            );
            found_files.insert(rel_path);
            continue;
        }

        // Store relative path in found_files
        let rel_path = compute_rel_path(&path, workspace_root)?;
        println!("[sync_directory] Found markdown file: {}", rel_path);
        found_files.insert(rel_path.clone());

        sync_or_create_file(
            conn,
            workspace_root,
            &path,
            parent_page_id,
            false,
            existing_pages,
            synced_pages,
            synced_blocks,
        )?;
    }

    Ok(())
}

/// Sync or create a file in database
fn sync_or_create_file(
    conn: &rusqlite::Connection,
    workspace_root: &Path,
    file_path: &Path,
    parent_page_id: Option<&str>,
    is_directory: bool,
    existing_pages: &mut std::collections::HashMap<String, String>,
    synced_pages: &mut usize,
    synced_blocks: &mut usize,
) -> Result<String, String> {
    // Compute workspace-relative path for DB storage (P0 requirement)
    let rel_path = compute_rel_path(file_path, workspace_root)?;

    let file_name = file_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Untitled");

    // Read filesystem metadata for incremental detection (mtime + size)
    let metadata = fs::metadata(file_path).map_err(|e| e.to_string())?;
    let size = metadata.len() as i64;

    let mtime = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64);

    // Check if page already exists in DB using relative path
    if let Some(page_id) = existing_pages.get(&rel_path) {
        println!("Page already exists in DB: {} -> {}", file_name, page_id);

        // Determine if blocks need reindex
        let (db_mtime, db_size): (Option<i64>, Option<i64>) = conn
            .query_row(
                "SELECT file_mtime, file_size FROM pages WHERE id = ?",
                [page_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|e| e.to_string())?;

        let needs_reindex = db_mtime != mtime || db_size != Some(size);

        // Always keep hierarchy metadata in sync
        conn.execute(
            "UPDATE pages SET parent_id = ?, is_directory = ?, file_mtime = ?, file_size = ?, updated_at = ? WHERE id = ?",
            params![
                parent_page_id,
                if is_directory { 1 } else { 0 },
                mtime,
                size,
                Utc::now().to_rfc3339(),
                page_id
            ],
        )
        .map_err(|e| e.to_string())?;

        if needs_reindex {
            // Reindex blocks
            let content = fs::read_to_string(file_path).map_err(|e| e.to_string())?;

            conn.execute("DELETE FROM blocks WHERE page_id = ?", [page_id])
                .map_err(|e| e.to_string())?;

            let blocks = markdown_to_blocks(&content, page_id);

            for block in &blocks {
                conn.execute(
                    "INSERT INTO blocks (id, page_id, parent_id, content, order_weight,
                                        block_type, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    params![
                        &block.id,
                        &block.page_id,
                        &block.parent_id,
                        &block.content,
                        block.order_weight,
                        block_type_to_string(&block.block_type),
                        &block.created_at,
                        &block.updated_at
                    ],
                )
                .map_err(|e| e.to_string())?;
            }

            *synced_pages += 1;
            *synced_blocks += blocks.len();
        }

        return Ok(page_id.clone());
    }

    // Create new page
    println!("Creating new page in DB: {}", file_name);
    let content = fs::read_to_string(file_path).map_err(|e| e.to_string())?;
    let page_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    // Store relative path in DB (P0 requirement)
    conn.execute(
        "INSERT INTO pages (id, title, parent_id, file_path, is_directory, file_mtime, file_size, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            &page_id,
            file_name,
            parent_page_id,
            &rel_path,
            if is_directory { 1 } else { 0 },
            mtime,
            size,
            &now,
            &now
        ],
    )
    .map_err(|e| e.to_string())?;

    // Parse and create blocks
    let blocks = markdown_to_blocks(&content, &page_id);

    for block in &blocks {
        conn.execute(
            "INSERT INTO blocks (id, page_id, parent_id, content, order_weight,
                                block_type, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                &block.id,
                &block.page_id,
                &block.parent_id,
                &block.content,
                &block.order_weight,
                block_type_to_string(&block.block_type),
                &block.created_at,
                &block.updated_at
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    *synced_pages += 1;
    *synced_blocks += blocks.len();

    Ok(page_id)
}

/// Incremental sync: currently unified to use the filesystem-driven sync engine
/// for consistent directory-note semantics (Dir/Dir.md is the directory page's content source).
///
/// NOTE:
/// This preserves behavior correctness, but it's not "incremental" yet. Follow-up work:
/// - Track per-file mtime/size and only reindex changed pages
/// - Or move incremental detection into the filesystem-driven engine
#[tauri::command]
pub async fn sync_workspace_incremental(workspace_path: String) -> Result<MigrationResult, String> {
    // Unify on the canonical filesystem-driven sync to ensure:
    // - Dir/Dir.md is never treated as a separate page node
    // - parent_id relationships are derived from directory structure consistently
    println!(
        "[sync_workspace_incremental] Running unified filesystem-driven sync for: {}",
        workspace_path
    );

    // Reuse the same engine as full sync (no DB wipe here).
    sync_workspace(workspace_path).await
}

/// Full reindex: delete all and rebuild from files
///
/// IMPORTANT:
/// This project has two different sync implementations:
/// - `sync_workspace` (filesystem-driven, handles directory-note semantics)
/// - `WorkspaceSyncService::reindex_full` (md-walkdir based)
///
/// To avoid duplicate "directory note" pages (Dir/Dir.md appearing as its own page),
/// full reindex should use the filesystem-driven sync, which treats Dir/Dir.md
/// as the content source for the directory page (Notion-like).
#[tauri::command]
pub async fn reindex_workspace(workspace_path: String) -> Result<MigrationResult, String> {
    let conn = open_workspace_db(&workspace_path)?;

    println!(
        "[reindex_workspace] Starting full reindex for: {}",
        workspace_path
    );

    // Full wipe
    conn.execute("DELETE FROM blocks", [])
        .map_err(|e| format!("Failed to delete blocks: {}", e))?;
    conn.execute("DELETE FROM pages", [])
        .map_err(|e| format!("Failed to delete pages: {}", e))?;

    // Rebuild from filesystem using the canonical, filesystem-driven sync.
    // This ensures directory-notes (Dir/Dir.md) do not become duplicate pages.
    let result = sync_workspace(workspace_path.clone()).await?;

    println!(
        "[reindex_workspace] Complete: {} pages indexed",
        result.pages
    );

    // Run VACUUM to optimize database
    conn.execute("VACUUM", [])
        .map_err(|e| format!("Failed to vacuum database: {}", e))?;

    conn.execute("ANALYZE", [])
        .map_err(|e| format!("Failed to analyze database: {}", e))?;

    println!("[reindex_workspace] Database optimized");

    Ok(result)
}
