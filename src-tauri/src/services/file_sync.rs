use rusqlite::Connection;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tokio::fs;

use crate::models::page::Page;
use crate::services::path_validator::PathValidator;

pub struct FileSyncService {
    workspace_path: PathBuf,
    path_validator: PathValidator,
}

impl FileSyncService {
    pub fn new(workspace_path: impl Into<PathBuf>) -> Self {
        let workspace = workspace_path.into();
        let path_validator = PathValidator::new(workspace.clone());
        Self {
            workspace_path: workspace,
            path_validator,
        }
    }

    /// Compute workspace-relative path from absolute path.
    async fn compute_rel_path(&self, abs_path: &Path) -> Result<String, String> {
        self.path_validator.to_relative_path(abs_path).await
    }

    /// Get the file path for a page based on its hierarchy
    pub async fn get_page_file_path(
        &self,
        conn_mutex: &Mutex<Connection>,
        page_id: &str,
    ) -> Result<PathBuf, String> {
        let page = self.get_page_from_db(conn_mutex, page_id)?;

        if let Some(file_path) = page.file_path {
            let abs_path = self
                .path_validator
                .validate_relative_path(&file_path)
                .await?;
            return Ok(abs_path);
        }

        let mut path_parts = Vec::new();
        let mut current_id = Some(page_id.to_string());

        while let Some(id) = current_id {
            let current_page = self.get_page_from_db(conn_mutex, &id)?;
            path_parts.push(current_page.title.clone());
            current_id = current_page.parent_id;
        }

        path_parts.reverse();

        let mut full_path = self.workspace_path.clone();

        if page.is_directory {
            for part in &path_parts {
                full_path = full_path.join(sanitize_filename(part));
            }
            Ok(full_path.join(format!("{}.md", sanitize_filename(&page.title))))
        } else {
            for part in &path_parts[..path_parts.len() - 1] {
                full_path = full_path.join(sanitize_filename(part));
            }
            Ok(full_path.join(format!("{}.md", sanitize_filename(&page.title))))
        }
    }

    /// Create a new page file
    pub async fn create_page_file(
        &self,
        conn_mutex: &Mutex<Connection>,
        page_id: &str,
        _title: &str,
    ) -> Result<String, String> {
        let abs_file_path = self.get_page_file_path(conn_mutex, page_id).await?;

        if let Some(parent) = abs_file_path.parent() {
            fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }

        fs::write(&abs_file_path, "")
            .await
            .map_err(|e| format!("Failed to create file: {}", e))?;

        self.compute_rel_path(&abs_file_path).await
    }

    /// Rename a page file
    pub async fn rename_page_file(
        &self,
        conn_mutex: &Mutex<Connection>,
        page_id: &str,
        new_title: &str,
    ) -> Result<String, String> {
        let page = self.get_page_from_db(conn_mutex, page_id)?;

        let old_abs_path = if let Some(fp) = &page.file_path {
            self.workspace_path.join(fp)
        } else {
            self.get_page_file_path(conn_mutex, page_id).await?
        };

        if !old_abs_path.exists() {
            if let Some(parent) = old_abs_path.parent() {
                fs::create_dir_all(parent)
                    .await
                    .map_err(|e| format!("Failed to create parent directory: {}", e))?;
            }
            let initial_content = format!("- {}\n", page.title);
            fs::write(&old_abs_path, initial_content)
                .await
                .map_err(|e| format!("Failed to create file: {}", e))?;
        }

        let parent = old_abs_path.parent().ok_or("Cannot get parent directory")?;

        if page.is_directory {
            let old_dir = parent.join(old_abs_path.file_stem().ok_or("Invalid file name")?);
            let new_dir = parent.join(sanitize_filename(new_title));

            if old_dir.exists() {
                fs::rename(&old_dir, &new_dir)
                    .await
                    .map_err(|e| format!("Failed to rename directory: {}", e))?;
            }

            let new_file_path = new_dir.join(format!("{}.md", sanitize_filename(new_title)));
            if old_abs_path.exists() {
                let old_file_in_dir =
                    new_dir.join(old_abs_path.file_name().ok_or("Invalid file name")?);
                if old_file_in_dir.exists() {
                    fs::rename(&old_file_in_dir, &new_file_path)
                        .await
                        .map_err(|e| format!("Failed to rename file: {}", e))?;
                }
            }

            self.compute_rel_path(&new_file_path).await
        } else {
            let new_path = parent.join(format!("{}.md", sanitize_filename(new_title)));
            fs::rename(&old_abs_path, &new_path)
                .await
                .map_err(|e| format!("Failed to rename file: {}", e))?;

            self.compute_rel_path(&new_path).await
        }
    }

    /// Move a page to a new parent
    /// Returns workspace-relative path (P0 requirement)
    pub async fn move_page_file(
        &self,
        conn_mutex: &Mutex<Connection>,
        page_id: &str,
        new_parent_id: Option<&str>,
    ) -> Result<String, String> {
        let page = self.get_page_from_db(conn_mutex, page_id)?;

        let old_abs_path = if let Some(fp) = &page.file_path {
            self.workspace_path.join(fp)
        } else {
            self.get_page_file_path(conn_mutex, page_id).await?
        };

        if !old_abs_path.exists() {
            return Err("Source file does not exist".to_string());
        }

        let new_parent_dir = if let Some(parent_id) = new_parent_id {
            let parent_page = self.get_page_from_db(conn_mutex, parent_id)?;
            if let Some(fp) = &parent_page.file_path {
                self.workspace_path
                    .join(fp)
                    .parent()
                    .map(|p| p.to_path_buf())
            } else {
                self.get_page_file_path(conn_mutex, parent_id)
                    .await?
                    .parent()
                    .map(|p| p.to_path_buf())
            }
        } else {
            Some(self.workspace_path.clone())
        };

        let new_parent_dir = new_parent_dir.ok_or("Cannot determine new parent directory")?;
        let new_abs_path = new_parent_dir.join(format!("{}.md", sanitize_filename(&page.title)));

        fs::create_dir_all(&new_parent_dir)
            .await
            .map_err(|e| format!("Failed to create parent directory: {}", e))?;

        fs::rename(&old_abs_path, &new_abs_path)
            .await
            .map_err(|e| format!("Failed to move file: {}", e))?;

        self.compute_rel_path(&new_abs_path).await
    }

    /// Delete a page file
    pub async fn delete_page_file(
        &self,
        conn_mutex: &Mutex<Connection>,
        page_id: &str,
    ) -> Result<(), String> {
        let page = self.get_page_from_db(conn_mutex, page_id)?;
        let file_path = if let Some(fp) = &page.file_path {
            PathBuf::from(fp)
        } else {
            self.get_page_file_path(conn_mutex, page_id).await?
        };

        let abs_path = if file_path.is_absolute() {
            file_path
        } else {
            self.workspace_path.join(&file_path)
        };

        if !abs_path.exists() {
            return Ok(()); // Already deleted
        }

        if page.is_directory {
            let dir_path = abs_path
                .parent()
                .ok_or("Cannot get parent")?
                .join(abs_path.file_stem().ok_or("Invalid name")?);

            if dir_path.exists() {
                fs::remove_dir_all(&dir_path)
                    .await
                    .map_err(|e| format!("Failed to remove directory: {}", e))?;
            }
        }

        if abs_path.exists() {
            fs::remove_file(&abs_path)
                .await
                .map_err(|e| format!("Failed to remove file: {}", e))?;
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
    fn get_page_from_db(
        &self,
        conn_mutex: &Mutex<Connection>,
        page_id: &str,
    ) -> Result<Page, String> {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
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

    /// Convert a page file to a directory
    pub async fn convert_page_to_directory(
        &self,
        conn_mutex: &Mutex<Connection>,
        page_id: &str,
    ) -> Result<String, String> {
        let page = self.get_page_from_db(conn_mutex, page_id)?;
        let old_abs_file_path = if let Some(fp) = &page.file_path {
            self.workspace_path.join(fp)
        } else {
            self.get_page_file_path(conn_mutex, page_id).await?
        };

        let content = if old_abs_file_path.exists() {
            fs::read_to_string(&old_abs_file_path)
                .await
                .map_err(|e| format!("Failed to read file: {}", e))?
        } else {
            format!("- {}\n", page.title)
        };

        let parent = old_abs_file_path
            .parent()
            .ok_or("Cannot get parent directory")?;
        let file_stem = old_abs_file_path.file_stem().ok_or("Invalid file name")?;

        let dir_path = parent.join(file_stem);
        fs::create_dir_all(&dir_path)
            .await
            .map_err(|e| format!("Failed to create directory: {}", e))?;

        let new_file_path = dir_path.join(format!("{}.md", file_stem.to_string_lossy()));
        fs::write(&new_file_path, content)
            .await
            .map_err(|e| format!("Failed to write file: {}", e))?;

        if old_abs_file_path.exists() {
            fs::remove_file(&old_abs_file_path)
                .await
                .map_err(|e| format!("Failed to remove old file: {}", e))?;
        }

        self.compute_rel_path(&new_file_path).await
    }

    /// Convert a directory page to a file
    pub async fn convert_directory_to_file(
        &self,
        conn_mutex: &Mutex<Connection>,
        page_id: &str,
    ) -> Result<String, String> {
        let page = self.get_page_from_db(conn_mutex, page_id)?;

        if !page.is_directory {
            return Err("Page is not a directory".to_string());
        }

        let old_abs_file_path = if let Some(fp) = &page.file_path {
            self.workspace_path.join(fp)
        } else {
            self.get_page_file_path(conn_mutex, page_id).await?
        };

        let dir_path = old_abs_file_path
            .parent()
            .ok_or("Cannot get directory path")?;

        let content = if old_abs_file_path.exists() {
            fs::read_to_string(&old_abs_file_path)
                .await
                .map_err(|e| format!("Failed to read file: {}", e))?
        } else {
            format!("- {}\n", page.title)
        };

        let parent = dir_path.parent().ok_or("Cannot get parent directory")?;
        let file_name = format!(
            "{}.md",
            dir_path
                .file_name()
                .and_then(|n| n.to_str())
                .ok_or("Invalid directory name")?
        );
        let new_file_path = parent.join(file_name);

        fs::write(&new_file_path, content)
            .await
            .map_err(|e| format!("Failed to write file: {}", e))?;

        if dir_path.exists() {
            fs::remove_dir_all(dir_path)
                .await
                .map_err(|e| format!("Failed to remove directory: {}", e))?;
        }

        self.compute_rel_path(&new_file_path).await
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
