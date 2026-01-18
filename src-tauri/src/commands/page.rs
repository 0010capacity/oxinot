use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use uuid::Uuid;

use crate::commands::workspace::open_workspace_db;
use crate::models::page::{CreatePageRequest, MovePageRequest, Page, UpdatePageRequest};
use crate::services::file_sync::FileSyncService;
use crate::utils::page_sync::sync_page_to_markdown;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetPageRequest {
    pub page_id: String,
}

/// Create a new page
#[tauri::command]
pub async fn create_page(
    app: tauri::AppHandle,
    workspace_path: String,
    request: CreatePageRequest,
) -> Result<Page, String> {
    let conn = open_workspace_db(&workspace_path)?;
    let conn_mutex = Mutex::new(conn);

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        conn.execute("BEGIN TRANSACTION", [])
            .map_err(|e| e.to_string())?;
    }

    // Check if parent page exists (if parent_id provided)
    if let Some(parent_id) = &request.parent_id {
        let count: i64 = {
            let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
            conn.query_row(
                "SELECT COUNT(*) FROM pages WHERE id = ?",
                [parent_id],
                |row| row.get(0),
            )
            .map_err(|_| "Failed to check parent page".to_string())?
        };

        if count == 0 {
            {
                let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
                let _ = conn.execute("ROLLBACK", []);
            }
            return Err("Parent page not found".to_string());
        }

        // Check if parent is a directory (is_directory = 1)
        let is_dir: bool = {
            let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
            conn.query_row(
                "SELECT is_directory FROM pages WHERE id = ?",
                [parent_id],
                |row| Ok(row.get::<_, i32>(0)? != 0),
            )
            .map_err(|_| "Failed to check parent directory status".to_string())?
        };

        if !is_dir {
            {
                let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
                let _ = conn.execute("ROLLBACK", []);
            }
            return Err(
                "Parent page must be converted to a directory before adding children".to_string(),
            );
        }
    }

    // Insert into DB
    {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO pages (id, title, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            params![&id, &request.title, &request.parent_id, &now, &now],
        )
        .map_err(|e| {
            // Need to drop lock before returning error?
            // Actually map_err consumes the error.
            // We need to rollback.
            // But we are inside lock scope.
            // We can just return error string, and handle rollback via Drop? No, simple rollback logic.
            // Simplified: if error, return it. Caller logic? No, I must rollback here.
            // But I hold the lock.
            // I can execute rollback here.
            let _ = conn.execute("ROLLBACK", []);
            format!("Failed to insert page: {}", e)
        })?;
    }

    // Create file
    let file_sync = FileSyncService::new(&workspace_path);
    // Pass conn_mutex to create_page_file
    let file_path = match file_sync
        .create_page_file(&conn_mutex, &id, &request.title)
        .await
    {
        Ok(path) => path,
        Err(e) => {
            {
                let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
                let _ = conn.execute("ROLLBACK", []);
            }
            return Err(format!("Failed to create page file: {}", e));
        }
    };

    // Update file path in DB
    {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE pages SET file_path = ? WHERE id = ?",
            params![file_path, id],
        )
        .map_err(|e| {
            let _ = conn.execute("ROLLBACK", []);
            format!("Failed to update page file path: {}", e)
        })?;

        conn.execute("COMMIT", [])
            .map_err(|e| format!("Failed to commit transaction: {}", e))?;
    }

    // Re-query to get full page object
    // get_page_internal needs to be updated to take Mutex or I unwrap it?
    // I can just lock locally.
    let new_page = get_page_internal(&conn_mutex, &id)?;

    // Emit workspace changed event for git monitoring
    crate::utils::events::emit_workspace_changed(&app, &workspace_path);

    Ok(new_page)
}

/// Get all pages
#[tauri::command]
pub async fn get_pages(workspace_path: String) -> Result<Vec<Page>, String> {
    let conn = open_workspace_db(&workspace_path)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, title, parent_id, file_path, is_directory, file_mtime, file_size, created_at, updated_at
             FROM pages
             WHERE is_deleted = 0
             ORDER BY title",
        )
        .map_err(|e| e.to_string())?;

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
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(pages)
}

/// Update page title
#[tauri::command]
pub async fn update_page_title(
    app: tauri::AppHandle,
    workspace_path: String,
    request: UpdatePageRequest,
) -> Result<Page, String> {
    let conn = open_workspace_db(&workspace_path)?;
    let conn_mutex = Mutex::new(conn);
    let now = Utc::now().to_rfc3339();

    if let Some(title) = &request.title {
        // Rename file first
        let file_sync = FileSyncService::new(&workspace_path);
        let new_file_path = file_sync
            .rename_page_file(&conn_mutex, &request.id, title)
            .await?;

        // Update DB
        {
            let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
            conn.execute(
                "UPDATE pages SET title = ?, file_path = ?, updated_at = ? WHERE id = ?",
                params![title, new_file_path, now, request.id],
            )
            .map_err(|e| e.to_string())?;
        }

        // Re-write file content to update title inside the file (if header is used)
        // Or just ensure sync
        sync_page_to_markdown(&conn_mutex, &workspace_path, &request.id).await?;
    } else {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE pages SET updated_at = ? WHERE id = ?",
            params![now, request.id],
        )
        .map_err(|e| e.to_string())?;
    }

    // Emit workspace changed event for git monitoring
    crate::utils::events::emit_workspace_changed(&app, &workspace_path);

    get_page_internal(&conn_mutex, &request.id)
}

/// Delete a page
#[tauri::command]
pub async fn delete_page(
    app: tauri::AppHandle,
    workspace_path: String,
    page_id: String,
) -> Result<String, String> {
    let conn = open_workspace_db(&workspace_path)?;
    let conn_mutex = Mutex::new(conn);

    // Check if page has children
    let children_count: i64 = {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT COUNT(*) FROM pages WHERE parent_id = ?",
            [&page_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?
    };

    if children_count > 0 {
        return Err("Cannot delete page with children".to_string());
    }

    // Delete file
    let file_sync = FileSyncService::new(&workspace_path);
    file_sync.delete_page_file(&conn_mutex, &page_id).await?;

    // Delete from DB (Cascade will handle blocks, but we do it explicitly to be safe)
    {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM pages WHERE id = ?", [&page_id])
            .map_err(|e| e.to_string())?;
    }

    // Emit workspace changed event for git monitoring
    crate::utils::events::emit_workspace_changed(&app, &workspace_path);

    Ok(page_id)
}

/// Get a single page
#[tauri::command]
pub async fn get_page(
    workspace_path: String,
    request: GetPageRequest,
) -> Result<Option<Page>, String> {
    let conn = open_workspace_db(&workspace_path)?;
    let conn_mutex = Mutex::new(conn);
    match get_page_internal(&conn_mutex, &request.page_id) {
        Ok(page) => Ok(Some(page)),
        Err(_) => Ok(None),
    }
}

// Internal helper to get page
fn get_page_internal(conn_mutex: &Mutex<Connection>, page_id: &str) -> Result<Page, String> {
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
    .map_err(|e| e.to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageTreeItem {
    #[serde(flatten)]
    pub page: Page,
    pub children: Vec<PageTreeItem>,
    pub depth: i32,
}

#[tauri::command]
pub async fn get_page_tree(workspace_path: String) -> Result<Vec<PageTreeItem>, String> {
    let pages = get_pages(workspace_path).await?;
    let mut tree: Vec<PageTreeItem> = Vec::new();
    let mut page_map: HashMap<String, Vec<Page>> = HashMap::new();

    // Group by parent_id
    for page in pages {
        let parent_id = page.parent_id.clone().unwrap_or_else(|| "root".to_string());
        page_map.entry(parent_id).or_default().push(page);
    }

    // Build tree
    if let Some(root_pages) = page_map.get("root") {
        for page in root_pages {
            tree.push(build_tree_recursive(page.clone(), &page_map, 0));
        }
    }

    Ok(tree)
}

fn build_tree_recursive(
    page: Page,
    page_map: &HashMap<String, Vec<Page>>,
    depth: i32,
) -> PageTreeItem {
    let mut children: Vec<PageTreeItem> = Vec::new();
    if let Some(child_pages) = page_map.get(&page.id) {
        for child in child_pages {
            children.push(build_tree_recursive(child.clone(), page_map, depth + 1));
        }
    }
    PageTreeItem {
        page,
        children,
        depth,
    }
}

/// Convert a page to a directory (folder)
#[tauri::command]
pub async fn convert_page_to_directory(
    app: tauri::AppHandle,
    workspace_path: String,
    page_id: String,
) -> Result<Page, String> {
    let conn = open_workspace_db(&workspace_path)?;
    let conn_mutex = Mutex::new(conn);
    let file_sync = FileSyncService::new(&workspace_path);

    // Convert file to directory structure
    let new_path = file_sync
        .convert_page_to_directory(&conn_mutex, &page_id)
        .await?;

    // Update DB
    {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE pages SET is_directory = 1, file_path = ? WHERE id = ?",
            params![new_path, page_id],
        )
        .map_err(|e| e.to_string())?;
    }

    // Emit workspace changed event for git monitoring
    crate::utils::events::emit_workspace_changed(&app, &workspace_path);

    get_page_internal(&conn_mutex, &page_id)
}

/// Move a page to a new parent
#[tauri::command]
pub async fn move_page(
    app: tauri::AppHandle,
    workspace_path: String,
    request: MovePageRequest,
) -> Result<Page, String> {
    let conn = open_workspace_db(&workspace_path)?;
    let conn_mutex = Mutex::new(conn);
    let file_sync = FileSyncService::new(&workspace_path);

    // Get the page being moved and its old parent
    let moved_page = get_page_internal(&conn_mutex, &request.id)?;
    let old_parent_id = moved_page.parent_id.clone();

    // If moving to a parent, ensure parent is a directory
    if let Some(pid) = &request.parent_id {
        let parent = get_page_internal(&conn_mutex, pid)?;
        if !parent.is_directory {
            // Auto-convert parent to directory
            let new_parent_path = file_sync
                .convert_page_to_directory(&conn_mutex, pid)
                .await?;
            {
                let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
                conn.execute(
                    "UPDATE pages SET is_directory = 1, file_path = ? WHERE id = ?",
                    params![new_parent_path, pid],
                )
                .map_err(|e| e.to_string())?;
            }
        }
    }

    // Move file
    let new_path = file_sync
        .move_page_file(&conn_mutex, &request.id, request.parent_id.as_deref())
        .await?;

    // Update DB
    {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE pages SET parent_id = ?, file_path = ? WHERE id = ?",
            params![request.parent_id, new_path, request.id],
        )
        .map_err(|e| e.to_string())?;
    }

    // If moved away from a parent, check if that parent is now empty
    // If so, convert it back to a regular file
    if let Some(old_pid) = old_parent_id {
        let remaining_children: i64 = {
            let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
            conn.query_row(
                "SELECT COUNT(*) FROM pages WHERE parent_id = ?",
                [&old_pid],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?
        };

        if remaining_children == 0 {
            // Old parent is now empty, convert back to regular file
            let old_parent = get_page_internal(&conn_mutex, &old_pid)?;
            if old_parent.is_directory {
                let new_file_path = file_sync
                    .convert_directory_to_file(&conn_mutex, &old_pid)
                    .await?;
                {
                    let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
                    conn.execute(
                        "UPDATE pages SET is_directory = 0, file_path = ? WHERE id = ?",
                        params![new_file_path, old_pid],
                    )
                    .map_err(|e| e.to_string())?;
                }
            }
        }
    }

    // Emit workspace changed event for git monitoring
    crate::utils::events::emit_workspace_changed(&app, &workspace_path);

    get_page_internal(&conn_mutex, &request.id)
}

/// Convert a directory back to a file (if no children)
#[tauri::command]
pub async fn convert_directory_to_file(
    app: tauri::AppHandle,
    workspace_path: String,
    page_id: String,
) -> Result<Page, String> {
    let conn = open_workspace_db(&workspace_path)?;
    let conn_mutex = Mutex::new(conn);

    // Check if directory has children
    let children_count: i64 = {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT COUNT(*) FROM pages WHERE parent_id = ?",
            [&page_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?
    };

    if children_count > 0 {
        return Err("Cannot convert directory with children to file".to_string());
    }

    let file_sync = FileSyncService::new(&workspace_path);
    let new_path = file_sync
        .convert_directory_to_file(&conn_mutex, &page_id)
        .await?;

    // Update DB
    {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE pages SET is_directory = 0, file_path = ? WHERE id = ?",
            params![new_path, page_id],
        )
        .map_err(|e| e.to_string())?;
    }

    // Emit workspace changed event for git monitoring
    crate::utils::events::emit_workspace_changed(&app, &workspace_path);

    get_page_internal(&conn_mutex, &page_id)
}

/// Manually trigger a re-sync of page markdown (for debugging or repair)
#[tauri::command]
pub async fn reindex_page_markdown(workspace_path: String, page_id: String) -> Result<(), String> {
    let conn = open_workspace_db(&workspace_path)?;
    let conn_mutex = Mutex::new(conn);
    sync_page_to_markdown(&conn_mutex, &workspace_path, &page_id).await
}
