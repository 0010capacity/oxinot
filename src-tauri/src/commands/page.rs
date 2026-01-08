use chrono::Utc;
use rusqlite::{params, Connection};
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

use crate::models::page::{CreatePageRequest, Page, UpdatePageRequest};
use crate::services::FileSyncService;

/// Get all pages
#[tauri::command]
pub async fn get_pages(
    db: State<'_, Arc<std::sync::Mutex<Connection>>>,
) -> Result<Vec<Page>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, title, parent_id, file_path, is_directory, created_at, updated_at
            FROM pages
            ORDER BY created_at DESC",
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
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(pages)
}

/// Create a new page
#[tauri::command]
pub async fn create_page(
    db: State<'_, Arc<std::sync::Mutex<Connection>>>,
    request: CreatePageRequest,
) -> Result<Page, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO pages (id, title, parent_id, file_path, is_directory, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, ?, ?)",
        params![
            &id,
            &request.title,
            &request.parent_id,
            &request.file_path,
            &now,
            &now
        ],
    )
    .map_err(|e| e.to_string())?;

    // Get workspace path
    let workspace_path: String = conn
        .query_row(
            "SELECT path FROM workspace WHERE id = 'default'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to get workspace path: {}", e))?;

    // Create file in file system
    let file_sync = FileSyncService::new(workspace_path);
    let file_path = file_sync
        .create_page_file(&conn, &id, &request.title)
        .map_err(|e| format!("Failed to create page file: {}", e))?;

    // Update file_path in database
    conn.execute(
        "UPDATE pages SET file_path = ? WHERE id = ?",
        params![&file_path, &id],
    )
    .map_err(|e| e.to_string())?;

    get_page_by_id(&conn, &id)
}

/// Update a page
#[tauri::command]
pub async fn update_page(
    db: State<'_, Arc<std::sync::Mutex<Connection>>>,
    request: UpdatePageRequest,
) -> Result<Page, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    let page = get_page_by_id(&conn, &request.id)?;

    let new_title = request.title.clone().unwrap_or(page.title.clone());
    let new_parent_id = request.parent_id.or(page.parent_id.clone());
    let new_file_path = request.file_path.clone().or(page.file_path.clone());

    // Get workspace path
    let workspace_path: String = conn
        .query_row(
            "SELECT path FROM workspace WHERE id = 'default'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to get workspace path: {}", e))?;

    // If title changed, rename file
    if let Some(title) = &request.title {
        if title != &page.title {
            let file_sync = FileSyncService::new(workspace_path.clone());
            let new_path = file_sync
                .rename_page_file(&conn, &request.id, title)
                .map_err(|e| format!("Failed to rename page file: {}", e))?;

            // Update the new_file_path to use the renamed path
            conn.execute(
                "UPDATE pages SET title = ?, file_path = ?, updated_at = ? WHERE id = ?",
                params![&new_title, &new_path, &now, &request.id],
            )
            .map_err(|e| e.to_string())?;

            return get_page_by_id(&conn, &request.id);
        }
    }

    conn.execute(
        "UPDATE pages SET title = ?, parent_id = ?, file_path = ?, updated_at = ? WHERE id = ?",
        params![
            &new_title,
            &new_parent_id,
            &new_file_path,
            &now,
            &request.id
        ],
    )
    .map_err(|e| e.to_string())?;

    get_page_by_id(&conn, &request.id)
}

/// Delete a page (and all its blocks)
#[tauri::command]
pub async fn delete_page(
    db: State<'_, Arc<std::sync::Mutex<Connection>>>,
    page_id: String,
) -> Result<bool, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    // Get workspace path
    let workspace_path: String = conn
        .query_row(
            "SELECT path FROM workspace WHERE id = 'default'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to get workspace path: {}", e))?;

    // Delete file from file system
    let file_sync = FileSyncService::new(workspace_path);
    file_sync
        .delete_page_file(&conn, &page_id)
        .map_err(|e| format!("Failed to delete page file: {}", e))?;

    // CASCADE will automatically delete all blocks
    conn.execute("DELETE FROM pages WHERE id = ?", [&page_id])
        .map_err(|e| e.to_string())?;

    Ok(true)
}

// ============ Helper Functions ============

fn get_page_by_id(conn: &Connection, id: &str) -> Result<Page, String> {
    conn.query_row(
        "SELECT id, title, parent_id, file_path, is_directory, created_at, updated_at
         FROM pages WHERE id = ?",
        [id],
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

/// Move a page to a new parent
#[tauri::command]
pub async fn move_page(
    db: State<'_, Arc<std::sync::Mutex<Connection>>>,
    request: crate::models::page::MovePageRequest,
) -> Result<Page, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    // Get workspace path
    let workspace_path: String = conn
        .query_row(
            "SELECT path FROM workspace WHERE id = 'default'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to get workspace path: {}", e))?;

    // If moving to a parent, ensure parent is a directory
    if let Some(parent_id) = &request.new_parent_id {
        let parent = get_page_by_id(&conn, parent_id)?;
        if !parent.is_directory {
            // Convert parent to directory first
            let file_sync = FileSyncService::new(workspace_path.clone());
            let new_path = file_sync
                .convert_page_to_directory(&conn, parent_id)
                .map_err(|e| format!("Failed to convert parent to directory: {}", e))?;

            conn.execute(
                "UPDATE pages SET is_directory = 1, file_path = ?, updated_at = ? WHERE id = ?",
                params![&new_path, &now, parent_id],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    // Move file in file system
    let file_sync = FileSyncService::new(workspace_path);
    let new_path = file_sync
        .move_page_file(
            &conn,
            &request.id,
            request.new_parent_id.as_ref().map(|s| s.as_str()),
        )
        .map_err(|e| format!("Failed to move page file: {}", e))?;

    // Update database
    conn.execute(
        "UPDATE pages SET parent_id = ?, file_path = ?, updated_at = ? WHERE id = ?",
        params![&request.new_parent_id, &new_path, &now, &request.id],
    )
    .map_err(|e| e.to_string())?;

    get_page_by_id(&conn, &request.id)
}

/// Convert a page to directory (when adding first child)
#[tauri::command]
pub async fn convert_page_to_directory(
    db: State<'_, Arc<std::sync::Mutex<Connection>>>,
    page_id: String,
) -> Result<Page, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    // Get workspace path
    let workspace_path: String = conn
        .query_row(
            "SELECT path FROM workspace WHERE id = 'default'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to get workspace path: {}", e))?;

    // Convert file to directory structure
    let file_sync = FileSyncService::new(workspace_path);
    let new_path = file_sync
        .convert_page_to_directory(&conn, &page_id)
        .map_err(|e| format!("Failed to convert to directory: {}", e))?;

    // Update database
    conn.execute(
        "UPDATE pages SET is_directory = 1, file_path = ?, updated_at = ? WHERE id = ?",
        params![&new_path, &now, &page_id],
    )
    .map_err(|e| e.to_string())?;

    get_page_by_id(&conn, &page_id)
}
