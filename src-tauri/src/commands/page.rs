use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use crate::commands::workspace::open_workspace_db;
use uuid::Uuid;

use crate::models::page::{CreatePageRequest, Page, UpdatePageRequest};
use crate::services::FileSyncService;

/// Backlink reference for a page
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageBacklink {
    pub page_id: String,
    pub page_title: String,
    pub block_id: String,
    pub block_content: String,
    pub block_order: i32,
}

/// Get all pages
#[tauri::command]
pub async fn get_pages(workspace_path: String) -> Result<Vec<Page>, String> {
    let conn = open_workspace_db(&workspace_path)?;

    println!(
        "[get_pages] Getting pages from workspace: {}",
        workspace_path
    );

    let mut stmt = conn
        .prepare(
            "SELECT id, title, parent_id, file_path, is_directory, file_mtime, file_size, created_at, updated_at
            FROM pages
            ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let pages = stmt
        .query_map([], |row| {
            let page = Page {
                id: row.get(0)?,
                title: row.get(1)?,
                parent_id: row.get(2)?,
                file_path: row.get(3)?,
                is_directory: row.get::<_, i32>(4)? != 0,
                file_mtime: row.get(5)?,
                file_size: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            };
            println!(
                "[get_pages] Found page: id={}, title={}, parent={:?}",
                page.id, page.title, page.parent_id
            );
            Ok(page)
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    println!("[get_pages] Returning {} pages from DB", pages.len());

    Ok(pages)
}

/// Create a new page
#[tauri::command]
pub async fn create_page(
    workspace_path: String,
    request: CreatePageRequest,
) -> Result<Page, String> {
    let conn = open_workspace_db(&workspace_path)?;

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    println!(
        "[create_page] Creating page: id={}, title={}, parent_id={:?}",
        id, request.title, request.parent_id
    );

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
    .map_err(|e| format!("Failed to insert page: {}", e))?;

    println!("[create_page] Page inserted into DB successfully");

    // Create file in file system (workspace_path is passed as parameter)
    let file_sync = FileSyncService::new(workspace_path.clone());
    let file_path = file_sync
        .create_page_file(&conn, &id, &request.title)
        .map_err(|e| format!("Failed to create page file: {}", e))?;

    // Update file_path in database
    conn.execute(
        "UPDATE pages SET file_path = ? WHERE id = ?",
        params![&file_path, &id],
    )
    .map_err(|e| e.to_string())?;

    println!("[create_page] File created at: {}", file_path);
    println!("[create_page] Updated file_path in DB");

    let page = get_page_by_id(&conn, &id)?;
    println!("[create_page] Returning page: {:?}", page);
    Ok(page)
}

/// Update a page
#[tauri::command]
pub async fn update_page(
    workspace_path: String,
    request: UpdatePageRequest,
) -> Result<Page, String> {
    let conn = open_workspace_db(&workspace_path)?;
    let now = Utc::now().to_rfc3339();

    let page = get_page_by_id(&conn, &request.id)?;

    let new_title = request.title.clone().unwrap_or(page.title.clone());
    let new_parent_id = request.parent_id.or(page.parent_id.clone());
    let new_file_path = request.file_path.clone().or(page.file_path.clone());

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
pub async fn delete_page(workspace_path: String, page_id: String) -> Result<bool, String> {
    let conn = open_workspace_db(&workspace_path)?;

    // Get parent before deletion
    let page = get_page_by_id(&conn, &page_id)?;
    let parent_id = page.parent_id.clone();

    // Delete file from file system
    let file_sync = FileSyncService::new(workspace_path.clone());
    file_sync
        .delete_page_file(&conn, &page_id)
        .map_err(|e| format!("Failed to delete page file: {}", e))?;

    // CASCADE will automatically delete all blocks
    conn.execute("DELETE FROM pages WHERE id = ?", [&page_id])
        .map_err(|e| e.to_string())?;

    // Check if parent should be converted back to regular file
    if let Some(pid) = parent_id {
        check_and_convert_to_file(&conn, &workspace_path, &pid)?;
    }

    Ok(true)
}

// ============ Helper Functions ============

fn get_page_by_id(conn: &Connection, id: &str) -> Result<Page, String> {
    conn.query_row(
        "SELECT id, title, parent_id, file_path, is_directory, file_mtime, file_size, created_at, updated_at
         FROM pages WHERE id = ?",
        [id],
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

/// Move a page to a new parent
#[tauri::command]
pub async fn move_page(
    workspace_path: String,
    request: crate::models::page::MovePageRequest,
) -> Result<Page, String> {
    let conn = open_workspace_db(&workspace_path)?;
    let now = Utc::now().to_rfc3339();

    // Validate: cannot move to itself
    if let Some(parent_id) = &request.new_parent_id {
        if parent_id == &request.id {
            return Err("Cannot move page to itself".to_string());
        }

        // Validate: cannot move to its own descendant
        if is_descendant(&conn, parent_id, &request.id)? {
            return Err("Cannot move page to its own descendant".to_string());
        }

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
    let file_sync = FileSyncService::new(workspace_path.clone());
    let new_path = file_sync
        .move_page_file(
            &conn,
            &request.id,
            request.new_parent_id.as_ref().map(|s| s.as_str()),
        )
        .map_err(|e| format!("Failed to move page file: {}", e))?;

    // Get old parent before update
    let page = get_page_by_id(&conn, &request.id)?;
    let old_parent_id = page.parent_id.clone();

    // Update database
    conn.execute(
        "UPDATE pages SET parent_id = ?, file_path = ?, updated_at = ? WHERE id = ?",
        params![&request.new_parent_id, &new_path, &now, &request.id],
    )
    .map_err(|e| e.to_string())?;

    // Check if old parent should be converted back to regular file
    if let Some(old_pid) = old_parent_id {
        check_and_convert_to_file(&conn, &workspace_path, &old_pid)?;
    }

    get_page_by_id(&conn, &request.id)
}

/// Check if target_id is a descendant of page_id
fn is_descendant(conn: &Connection, target_id: &str, page_id: &str) -> Result<bool, String> {
    let mut current_id = Some(target_id.to_string());

    while let Some(id) = current_id {
        let page = get_page_by_id(conn, &id)?;

        if let Some(parent_id) = page.parent_id {
            if parent_id == page_id {
                return Ok(true);
            }
            current_id = Some(parent_id);
        } else {
            break;
        }
    }

    Ok(false)
}

/// Check if page has children, and convert to regular file if not
fn check_and_convert_to_file(
    conn: &Connection,
    workspace_path: &str,
    page_id: &str,
) -> Result<(), String> {
    let parent = get_page_by_id(conn, page_id)?;

    if !parent.is_directory {
        return Ok(());
    }

    // Count children
    let child_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM pages WHERE parent_id = ?",
            [page_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to count children: {}", e))?;

    // If no children remain, convert back to regular file
    if child_count == 0 {
        let file_sync = FileSyncService::new(workspace_path);
        let new_path = file_sync
            .convert_directory_to_file(conn, page_id)
            .map_err(|e| format!("Failed to convert to file: {}", e))?;

        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE pages SET is_directory = 0, file_path = ?, updated_at = ? WHERE id = ?",
            params![&new_path, &now, page_id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Convert a page to directory (when adding first child)
#[tauri::command]
pub async fn convert_page_to_directory(
    workspace_path: String,
    page_id: String,
) -> Result<Page, String> {
    let conn = open_workspace_db(&workspace_path)?;
    let now = Utc::now().to_rfc3339();

    // Convert file to directory structure
    let file_sync = FileSyncService::new(workspace_path.clone());
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

/// Debug: Check database state
#[tauri::command]
pub async fn debug_db_state(workspace_path: String) -> Result<String, String> {
    let conn = open_workspace_db(&workspace_path)?;

    let count: i32 = conn
        .query_row("SELECT COUNT(*) FROM pages", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, title, file_path FROM pages ORDER BY created_at DESC LIMIT 5")
        .map_err(|e| e.to_string())?;

    let mut result = format!("Total pages in DB: {}\n\nRecent pages:\n", count);

    let pages = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    for (i, page) in pages.enumerate() {
        let (id, title, file_path) = page.map_err(|e| e.to_string())?;
        result.push_str(&format!(
            "{}. {} (id: {}, path: {:?})\n",
            i + 1,
            title,
            id,
            file_path
        ));
    }

    Ok(result)
}

/// Get all backlinks (pages that link to this page)
#[tauri::command]
pub async fn get_page_backlinks(
    workspace_path: String,
    page_id: String,
) -> Result<Vec<PageBacklink>, String> {
    let conn = open_workspace_db(&workspace_path)?;

    // Get the page title to search for wiki links
    let target_page = get_page_by_id(&conn, &page_id)?;
    let target_title = target_page.title;

    println!(
        "[get_page_backlinks] Finding backlinks for page: {}",
        target_title
    );

    // Search for blocks containing wiki links to this page
    // Format: [[page_title]] or [[path/page_title]] or [[page_title|alias]]
    let search_patterns = vec![
        format!("[[{}]]", target_title),
        format!("[[{}|", target_title),
        format!("/{}", target_title), // For path-based links
    ];

    let mut backlinks = Vec::new();

    for pattern in search_patterns {
        let mut stmt = conn
            .prepare(
                "SELECT b.id, b.content, b.order_weight, b.page_id, p.title
                 FROM blocks b
                 JOIN pages p ON b.page_id = p.id
                 WHERE b.content LIKE ? AND b.page_id != ?
                 ORDER BY p.title, b.order_weight",
            )
            .map_err(|e| e.to_string())?;

        let pattern_search = format!("%{}%", pattern);
        let links = stmt
            .query_map(params![&pattern_search, &page_id], |row| {
                Ok(PageBacklink {
                    block_id: row.get(0)?,
                    block_content: row.get(1)?,
                    block_order: row.get::<_, f64>(2)? as i32,
                    page_id: row.get(3)?,
                    page_title: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;

        for link in links {
            let link = link.map_err(|e| e.to_string())?;
            // Avoid duplicates
            if !backlinks
                .iter()
                .any(|b: &PageBacklink| b.block_id == link.block_id)
            {
                backlinks.push(link);
            }
        }
    }

    println!("[get_page_backlinks] Found {} backlinks", backlinks.len());

    Ok(backlinks)
}
