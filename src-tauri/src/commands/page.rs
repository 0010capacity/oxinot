use chrono::Utc;
use rusqlite::{params, Connection};
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

use crate::models::page::{CreatePageRequest, Page, UpdatePageRequest};

/// Get all pages
#[tauri::command]
pub async fn get_pages(
    db: State<'_, Arc<std::sync::Mutex<Connection>>>,
) -> Result<Vec<Page>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, title, file_path, created_at, updated_at
            FROM pages
            ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let pages = stmt
        .query_map([], |row| {
            Ok(Page {
                id: row.get(0)?,
                title: row.get(1)?,
                file_path: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
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
        "INSERT INTO pages (id, title, file_path, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)",
        params![&id, &request.title, &request.file_path, &now, &now],
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

    let new_title = request.title.unwrap_or(page.title);
    let new_file_path = request.file_path.or(page.file_path);

    conn.execute(
        "UPDATE pages SET title = ?, file_path = ?, updated_at = ? WHERE id = ?",
        params![&new_title, &new_file_path, &now, &request.id],
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

    // CASCADE will automatically delete all blocks
    conn.execute("DELETE FROM pages WHERE id = ?", [&page_id])
        .map_err(|e| e.to_string())?;

    Ok(true)
}

// ============ Helper Functions ============

fn get_page_by_id(conn: &Connection, id: &str) -> Result<Page, String> {
    conn.query_row(
        "SELECT id, title, file_path, created_at, updated_at
         FROM pages WHERE id = ?",
        [id],
        |row| {
            Ok(Page {
                id: row.get(0)?,
                title: row.get(1)?,
                file_path: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        },
    )
    .map_err(|e| format!("Page not found: {}", e))
}
