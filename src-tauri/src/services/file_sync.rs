use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;

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

    /// Get the file path for a page based on its hierarchy
    pub fn get_page_file_path(&self, conn: &Connection, page_id: &str) -> Result<PathBuf, String> {
        let page = self.get_page_from_db(conn, page_id)?;

        if let Some(file_path) = page.file_path {
            return Ok(PathBuf::from(&file_path));
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
    pub fn create_page_file(
        &self,
        conn: &Connection,
        page_id: &str,
        title: &str,
    ) -> Result<String, String> {
        let file_path = self.get_page_file_path(conn, page_id)?;

        // Ensure parent directory exists
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }

        // Create file with basic header
        let initial_content = format!("# {}\n\n", title);
        fs::write(&file_path, initial_content)
            .map_err(|e| format!("Failed to create file: {}", e))?;

        Ok(file_path.to_string_lossy().to_string())
    }

    /// Rename a page file
    pub fn rename_page_file(
        &self,
        conn: &Connection,
        page_id: &str,
        new_title: &str,
    ) -> Result<String, String> {
        let page = self.get_page_from_db(conn, page_id)?;
        let old_path = if let Some(fp) = &page.file_path {
            PathBuf::from(fp)
        } else {
            self.get_page_file_path(conn, page_id)?
        };

        if !old_path.exists() {
            return Err("Original file does not exist".to_string());
        }

        let parent = old_path.parent().ok_or("Cannot get parent directory")?;

        if page.is_directory {
            // Rename directory
            let old_dir = parent.join(old_path.file_stem().ok_or("Invalid file name")?);
            let new_dir = parent.join(sanitize_filename(new_title));

            if old_dir.exists() {
                fs::rename(&old_dir, &new_dir)
                    .map_err(|e| format!("Failed to rename directory: {}", e))?;
            }

            // Rename the file inside
            let new_file_path = new_dir.join(format!("{}.md", sanitize_filename(new_title)));
            if old_path.exists() {
                let old_file_in_dir =
                    new_dir.join(old_path.file_name().ok_or("Invalid file name")?);
                if old_file_in_dir.exists() {
                    fs::rename(&old_file_in_dir, &new_file_path)
                        .map_err(|e| format!("Failed to rename file: {}", e))?;
                }
            }

            Ok(new_file_path.to_string_lossy().to_string())
        } else {
            // Rename file only
            let new_path = parent.join(format!("{}.md", sanitize_filename(new_title)));
            fs::rename(&old_path, &new_path)
                .map_err(|e| format!("Failed to rename file: {}", e))?;

            Ok(new_path.to_string_lossy().to_string())
        }
    }

    /// Move a page to a new parent
    pub fn move_page_file(
        &self,
        conn: &Connection,
        page_id: &str,
        new_parent_id: Option<&str>,
    ) -> Result<String, String> {
        let page = self.get_page_from_db(conn, page_id)?;
        let old_path = if let Some(fp) = &page.file_path {
            PathBuf::from(fp)
        } else {
            self.get_page_file_path(conn, page_id)?
        };

        if !old_path.exists() {
            return Err("Original file does not exist".to_string());
        }

        // Calculate new parent directory
        let new_parent_dir = if let Some(parent_id) = new_parent_id {
            let parent_page = self.get_page_from_db(conn, parent_id)?;
            let parent_file_path = self.get_page_file_path(conn, parent_id)?;

            if parent_page.is_directory {
                parent_file_path
                    .parent()
                    .ok_or("Cannot get parent directory")?
                    .join(parent_file_path.file_stem().ok_or("Invalid file name")?)
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

        let file_name = old_path.file_name().ok_or("Invalid file name")?;
        let new_path = new_parent_dir.join(file_name);

        // Move file or directory
        fs::rename(&old_path, &new_path).map_err(|e| format!("Failed to move: {}", e))?;

        // If it's a directory, move the whole directory
        if page.is_directory {
            let old_dir = old_path
                .parent()
                .ok_or("Cannot get parent")?
                .join(old_path.file_stem().ok_or("Invalid name")?);

            if old_dir.exists() {
                let new_dir = new_parent_dir.join(old_dir.file_name().ok_or("Invalid dir name")?);
                fs::rename(&old_dir, &new_dir)
                    .map_err(|e| format!("Failed to move directory: {}", e))?;
            }
        }

        Ok(new_path.to_string_lossy().to_string())
    }

    /// Convert a page file to a directory structure
    pub fn convert_page_to_directory(
        &self,
        conn: &Connection,
        page_id: &str,
    ) -> Result<String, String> {
        let page = self.get_page_from_db(conn, page_id)?;
        let old_file_path = if let Some(fp) = &page.file_path {
            PathBuf::from(fp)
        } else {
            self.get_page_file_path(conn, page_id)?
        };

        if !old_file_path.exists() {
            return Err("Original file does not exist".to_string());
        }

        // Read existing content
        let content = fs::read_to_string(&old_file_path)
            .map_err(|e| format!("Failed to read file: {}", e))?;

        let parent = old_file_path
            .parent()
            .ok_or("Cannot get parent directory")?;
        let file_stem = old_file_path.file_stem().ok_or("Invalid file name")?;

        // Create directory
        let dir_path = parent.join(file_stem);
        fs::create_dir_all(&dir_path).map_err(|e| format!("Failed to create directory: {}", e))?;

        // Move content to file inside directory
        let new_file_path = dir_path.join(format!("{}.md", file_stem.to_string_lossy()));
        fs::write(&new_file_path, content).map_err(|e| format!("Failed to write file: {}", e))?;

        // Remove old file
        fs::remove_file(&old_file_path).map_err(|e| format!("Failed to remove old file: {}", e))?;

        Ok(new_file_path.to_string_lossy().to_string())
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

    /// Sync file path in database
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
            "SELECT id, title, parent_id, file_path, is_directory, created_at, updated_at
             FROM pages WHERE id = ?",
            [page_id],
            |row| {
                Ok(Page {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    parent_id: row.get(2)?,
                    file_path: row.get(3)?,
                    is_directory: row.get::<_, i32>(4)? != 0,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
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
