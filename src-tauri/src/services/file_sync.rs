use rusqlite::Connection;
use std::fs;
use std::path::{Path, PathBuf};

use crate::models::page::Page;

pub struct FileSyncService {
    workspace_path: PathBuf,
}

impl FileSyncService {
    pub fn new(workspace_path: impl Into<PathBuf>) -> Self {
        Self {
            workspace_path: workspace_path.into(),
        }
    }

    /// Compute workspace-relative path from absolute path
    /// Returns a path relative to workspace_root with `/` separators
    fn compute_rel_path(&self, abs_path: &Path) -> Result<String, String> {
        abs_path
            .strip_prefix(&self.workspace_path)
            .map_err(|_| format!("Path {:?} is not under workspace root", abs_path))
            .and_then(|rel| {
                rel.to_str()
                    .map(|s| {
                        // Convert backslashes to forward slashes for cross-platform consistency
                        s.replace('\\', "/")
                    })
                    .ok_or_else(|| "Path contains invalid UTF-8".to_string())
            })
    }

    /// Get the file path for a page based on its hierarchy
    /// Returns absolute path for filesystem operations
    pub fn get_page_file_path(&self, conn: &Connection, page_id: &str) -> Result<PathBuf, String> {
        let page = self.get_page_from_db(conn, page_id)?;

        if let Some(file_path) = page.file_path {
            // file_path in DB is now workspace-relative; convert to absolute for filesystem ops
            return Ok(self.workspace_path.join(&file_path));
        }

        // Build path from hierarchy
        let mut path_parts = Vec::new();
        let mut current_id = Some(page_id.to_string());

        while let Some(id) = current_id {
            let current_page = self.get_page_from_db(conn, &id)?;
            path_parts.push(current_page.title.clone());
            current_id = current_page.parent_id;
        }

        path_parts.reverse();

        let mut full_path = self.workspace_path.clone();

        // If page has children (is_directory), add as directory
        if page.is_directory {
            for part in &path_parts {
                full_path = full_path.join(sanitize_filename(part));
            }
            Ok(full_path.join(format!("{}.md", sanitize_filename(&page.title))))
        } else {
            // Regular file
            for part in &path_parts[..path_parts.len() - 1] {
                full_path = full_path.join(sanitize_filename(part));
            }
            Ok(full_path.join(format!("{}.md", sanitize_filename(&page.title))))
        }
    }

    /// Create a new page file
    /// Returns workspace-relative path (P0 requirement)
    pub fn create_page_file(
        &self,
        conn: &Connection,
        page_id: &str,
        _title: &str,
    ) -> Result<String, String> {
        let abs_file_path = self.get_page_file_path(conn, page_id)?;

        // Ensure parent directory exists
        if let Some(parent) = abs_file_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }

        // Create an empty file.
        //
        // Rationale:
        // We previously wrote a "- {title}" bullet as "basic header", but the page title already
        // lives in the pages table / UI header. Writing an initial bullet causes the parser to
        // import a root block, and the editor may also create its own initial empty block on first
        // open, resulting in duplicate/empty root bullets being persisted.
        //
        // Keeping the initial file empty prevents phantom empty root bullets from accumulating
        // across open/close cycles.
        fs::write(&abs_file_path, "").map_err(|e| format!("Failed to create file: {}", e))?;

        // Return relative path
        self.compute_rel_path(&abs_file_path)
    }

    /// Rename a page file
    /// Returns workspace-relative path (P0 requirement)
    pub fn rename_page_file(
        &self,
        conn: &Connection,
        page_id: &str,
        new_title: &str,
    ) -> Result<String, String> {
        let page = self.get_page_from_db(conn, page_id)?;
        // file_path in DB is relative; convert to absolute for filesystem ops
        let old_abs_path = if let Some(fp) = &page.file_path {
            self.workspace_path.join(fp)
        } else {
            self.get_page_file_path(conn, page_id)?
        };

        // If old file doesn't exist, create it first
        if !old_abs_path.exists() {
            // Ensure parent directory exists
            if let Some(parent) = old_abs_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent directory: {}", e))?;
            }
            // Create file with basic content
            let initial_content = format!("- {}\n", page.title);
            fs::write(&old_abs_path, initial_content)
                .map_err(|e| format!("Failed to create file: {}", e))?;
        }

        let parent = old_abs_path.parent().ok_or("Cannot get parent directory")?;

        if page.is_directory {
            // Rename directory
            let old_dir = parent.join(old_abs_path.file_stem().ok_or("Invalid file name")?);
            let new_dir = parent.join(sanitize_filename(new_title));

            if old_dir.exists() {
                fs::rename(&old_dir, &new_dir)
                    .map_err(|e| format!("Failed to rename directory: {}", e))?;
            }

            // Rename the file inside
            let new_file_path = new_dir.join(format!("{}.md", sanitize_filename(new_title)));
            if old_abs_path.exists() {
                let old_file_in_dir =
                    new_dir.join(old_abs_path.file_name().ok_or("Invalid file name")?);
                if old_file_in_dir.exists() {
                    fs::rename(&old_file_in_dir, &new_file_path)
                        .map_err(|e| format!("Failed to rename file: {}", e))?;
                }
            }

            self.compute_rel_path(&new_file_path)
        } else {
            // Rename file only
            let new_path = parent.join(format!("{}.md", sanitize_filename(new_title)));
            fs::rename(&old_abs_path, &new_path)
                .map_err(|e| format!("Failed to rename file: {}", e))?;

            self.compute_rel_path(&new_path)
        }
    }

    /// Move a page to a new parent
    /// Returns workspace-relative path (P0 requirement)
    pub fn move_page_file(
        &self,
        conn: &Connection,
        page_id: &str,
        new_parent_id: Option<&str>,
    ) -> Result<String, String> {
        let page = self.get_page_from_db(conn, page_id)?;

        // Calculate new parent directory (absolute path)
        let new_parent_dir = if let Some(parent_id) = new_parent_id {
            let parent_page = self.get_page_from_db(conn, parent_id)?;
            let parent_file_path = self.get_page_file_path(conn, parent_id)?;

            if parent_page.is_directory {
                // For directory notes, the file path is DirName/DirName.md
                // We want to put children directly in DirName/, not DirName/DirName/
                parent_file_path
                    .parent()
                    .ok_or("Cannot get parent directory")?
                    .to_path_buf()
            } else {
                // Convert parent to directory first
                return Err("Parent page must be converted to directory first".to_string());
            }
        } else {
            self.workspace_path.clone()
        };

        // Ensure target directory exists
        fs::create_dir_all(&new_parent_dir)
            .map_err(|e| format!("Failed to create target directory: {}", e))?;

        if page.is_directory {
            // Moving a directory note - move the entire folder structure
            let old_abs_path = if let Some(fp) = &page.file_path {
                self.workspace_path.join(fp)
            } else {
                self.get_page_file_path(conn, page_id)?
            };

            // The directory is named after the file stem
            let old_dir = old_abs_path
                .parent()
                .ok_or("Cannot get parent directory")?
                .join(old_abs_path.file_stem().ok_or("Invalid file name")?);

            if !old_dir.exists() {
                return Err(format!("Directory does not exist: {:?}", old_dir));
            }

            // Move the entire directory
            let dir_name = old_dir.file_name().ok_or("Invalid directory name")?;
            let new_dir = new_parent_dir.join(dir_name);

            fs::rename(&old_dir, &new_dir)
                .map_err(|e| format!("Failed to move directory: {}", e))?;

            // Return new file path inside moved directory (relative)
            let new_file_path = new_dir.join(format!("{}.md", dir_name.to_string_lossy()));
            self.compute_rel_path(&new_file_path)
        } else {
            // Moving a regular file
            let old_abs_path = if let Some(fp) = &page.file_path {
                self.workspace_path.join(fp)
            } else {
                self.get_page_file_path(conn, page_id)?
            };

            if !old_abs_path.exists() {
                // Create file if it doesn't exist
                if let Some(parent) = old_abs_path.parent() {
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("Failed to create parent directory: {}", e))?;
                }
                let initial_content = format!("- {}\n", page.title);
                fs::write(&old_abs_path, initial_content)
                    .map_err(|e| format!("Failed to create file: {}", e))?;
            }

            let file_name = old_abs_path.file_name().ok_or("Invalid file name")?;
            let new_path = new_parent_dir.join(file_name);

            fs::rename(&old_abs_path, &new_path)
                .map_err(|e| format!("Failed to move file: {}", e))?;

            self.compute_rel_path(&new_path)
        }
    }

    /// Convert a directory back to a regular file (when no children remain)
    /// Returns workspace-relative path (P0 requirement)
    pub fn convert_directory_to_file(
        &self,
        conn: &Connection,
        page_id: &str,
    ) -> Result<String, String> {
        let page = self.get_page_from_db(conn, page_id)?;

        if !page.is_directory {
            return Err("Page is not a directory".to_string());
        }

        let old_abs_file_path = if let Some(fp) = &page.file_path {
            self.workspace_path.join(fp)
        } else {
            self.get_page_file_path(conn, page_id)?
        };

        // The directory is the parent of the file
        let dir_path = old_abs_file_path
            .parent()
            .ok_or("Cannot get directory path")?;

        // Read content from the file inside directory
        let content = if old_abs_file_path.exists() {
            fs::read_to_string(&old_abs_file_path)
                .map_err(|e| format!("Failed to read file: {}", e))?
        } else {
            format!("- {}\n", page.title)
        };

        // Create new file path (one level up, outside the directory)
        let parent = dir_path.parent().ok_or("Cannot get parent directory")?;
        let file_name = format!(
            "{}.md",
            dir_path
                .file_name()
                .and_then(|n| n.to_str())
                .ok_or("Invalid directory name")?
        );
        let new_file_path = parent.join(file_name);

        // Write content to new file location
        fs::write(&new_file_path, content).map_err(|e| format!("Failed to write file: {}", e))?;

        // Remove the directory and its contents
        if dir_path.exists() {
            fs::remove_dir_all(dir_path)
                .map_err(|e| format!("Failed to remove directory: {}", e))?;
        }

        self.compute_rel_path(&new_file_path)
    }

    /// Convert a page file to a directory structure
    /// Returns workspace-relative path (P0 requirement)
    pub fn convert_page_to_directory(
        &self,
        conn: &Connection,
        page_id: &str,
    ) -> Result<String, String> {
        let page = self.get_page_from_db(conn, page_id)?;
        let old_abs_file_path = if let Some(fp) = &page.file_path {
            self.workspace_path.join(fp)
        } else {
            self.get_page_file_path(conn, page_id)?
        };

        // Read existing content if file exists, otherwise use default
        let content = if old_abs_file_path.exists() {
            fs::read_to_string(&old_abs_file_path)
                .map_err(|e| format!("Failed to read file: {}", e))?
        } else {
            format!("- {}\n", page.title)
        };

        let parent = old_abs_file_path
            .parent()
            .ok_or("Cannot get parent directory")?;
        let file_stem = old_abs_file_path.file_stem().ok_or("Invalid file name")?;

        // Create directory
        let dir_path = parent.join(file_stem);
        fs::create_dir_all(&dir_path).map_err(|e| format!("Failed to create directory: {}", e))?;

        // Move content to file inside directory
        let new_file_path = dir_path.join(format!("{}.md", file_stem.to_string_lossy()));
        fs::write(&new_file_path, content).map_err(|e| format!("Failed to write file: {}", e))?;

        // Remove old file if it exists
        if old_abs_file_path.exists() {
            fs::remove_file(&old_abs_file_path)
                .map_err(|e| format!("Failed to remove old file: {}", e))?;
        }

        self.compute_rel_path(&new_file_path)
    }

    /// Delete a page file
    pub fn delete_page_file(&self, conn: &Connection, page_id: &str) -> Result<(), String> {
        let page = self.get_page_from_db(conn, page_id)?;
        let file_path = if let Some(fp) = &page.file_path {
            PathBuf::from(fp)
        } else {
            self.get_page_file_path(conn, page_id)?
        };

        if !file_path.exists() {
            return Ok(()); // Already deleted
        }

        if page.is_directory {
            // Delete directory and all contents
            let dir_path = file_path
                .parent()
                .ok_or("Cannot get parent")?
                .join(file_path.file_stem().ok_or("Invalid name")?);

            if dir_path.exists() {
                fs::remove_dir_all(&dir_path)
                    .map_err(|e| format!("Failed to remove directory: {}", e))?;
            }
        }

        // Delete the file
        if file_path.exists() {
            fs::remove_file(&file_path).map_err(|e| format!("Failed to remove file: {}", e))?;
        }

        Ok(())
    }

    /// Update file path in database
    /// new_path must be workspace-relative (P0 requirement)
    pub fn update_file_path_in_db(
        &self,
        conn: &Connection,
        page_id: &str,
        new_path: &str,
    ) -> Result<(), String> {
        conn.execute(
            "UPDATE pages SET file_path = ? WHERE id = ?",
            rusqlite::params![new_path, page_id],
        )
        .map_err(|e| format!("Failed to update file path: {}", e))?;

        Ok(())
    }

    // Helper: Get page from database
    fn get_page_from_db(&self, conn: &Connection, page_id: &str) -> Result<Page, String> {
        conn.query_row(
            "SELECT id, title, parent_id, file_path, is_directory, file_mtime, file_size, created_at, updated_at
             FROM pages WHERE id = ?",
            [page_id],
            |row| {
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
            },
        )
        .map_err(|e| format!("Page not found: {}", e))
    }
}

/// Sanitize filename by removing invalid characters
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_filename() {
        assert_eq!(sanitize_filename("Hello World"), "Hello World");
        assert_eq!(sanitize_filename("Test:File*Name?"), "Test_File_Name_");
        assert_eq!(sanitize_filename("Path/To/File"), "Path_To_File");
    }
}
