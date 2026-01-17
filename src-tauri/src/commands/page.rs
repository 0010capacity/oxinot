use chrono::Utc;
use rusqlite::{params, Connection};

use crate::commands::workspace::open_workspace_db;
use uuid::Uuid;

use crate::models::page::{CreatePageRequest, MovePageRequest, Page, UpdatePageRequest};
use crate::services::{page_path_service, FileSyncService};
use crate::utils::page_sync::sync_page_to_markdown;

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
    app: tauri::AppHandle,
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

    // Update page_paths for wiki link resolution
    page_path_service::update_page_path(&conn, &id, &file_path)
        .map_err(|e| format!("Failed to update page path: {}", e))?;

    let page = get_page_by_id(&conn, &id)?;
    println!("[create_page] Returning page: {:?}", page);

    // Emit workspace changed event for git monitoring
    crate::utils::events::emit_workspace_changed(&app, &workspace_path);

    Ok(page)
}

/// Update a page
#[tauri::command]
pub async fn update_page(
    app: tauri::AppHandle,
    workspace_path: String,
    request: UpdatePageRequest,
) -> Result<Page, String> {
    let conn = open_workspace_db(&workspace_path)?;
    let now = Utc::now().to_rfc3339();

    let page = get_page_by_id(&conn, &request.id)?;

    // Use provided values or fall back to existing page data
    let new_title = request.title.clone().unwrap_or_else(|| page.title.clone());
    let new_parent_id = request.parent_id.or_else(|| page.parent_id.clone());
    let new_file_path = request.file_path.clone().or_else(|| page.file_path.clone());

    // If title changed, rename file AND rewrite all wiki-link references that point to this page's old path.
    if let Some(title) = &request.title {
        if title != &page.title {
            // Capture old wiki target (workspace-relative, without .md)
            let old_path = page
                .file_path
                .clone()
                .unwrap_or_else(|| format!("{}.md", page.title));
            let from_target = old_path
                .strip_suffix(".md")
                .unwrap_or(old_path.as_str())
                .to_string();

            let file_sync = FileSyncService::new(workspace_path.clone());
            let new_path = file_sync
                .rename_page_file(&conn, &request.id, title)
                .map_err(|e| format!("Failed to rename page file: {}", e))?;

            // Persist the page metadata changes
            conn.execute(
                "UPDATE pages SET title = ?, file_path = ?, updated_at = ? WHERE id = ?",
                params![&new_title, &new_path, &now, &request.id],
            )
            .map_err(|e| e.to_string())?;

            // Compute new wiki target (workspace-relative, without .md)
            let to_target = new_path
                .strip_suffix(".md")
                .unwrap_or(new_path.as_str())
                .to_string();

            // Rewrite referencing blocks in DB and sync affected pages back to markdown files (SoT = files).
            // Note: This uses the existing targeted rewrite helper defined in this module.
            rewrite_wiki_links_for_page_path_change(workspace_path.clone(), from_target, to_target)
                .await?;

            // Update page_paths for wiki link resolution with new path
            page_path_service::update_page_path(&conn, &request.id, &new_path)
                .map_err(|e| format!("Failed to update page path: {}", e))?;

            // Ensure the renamed page's file reflects the rename (serializer may rely on the new file_path)
            sync_page_to_markdown(&conn, &workspace_path, &request.id)?;

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

    // Always update page_paths if file_path exists (either from request or existing)
    if let Some(ref path) = new_file_path {
        page_path_service::update_page_path(&conn, &request.id, path)
            .map_err(|e| format!("Failed to update page path: {}", e))?;
    }

    let page = get_page_by_id(&conn, &request.id)?;

    // Emit workspace changed event for git monitoring
    crate::utils::events::emit_workspace_changed(&app, &workspace_path);

    Ok(page)
}

/// Delete a page (and all its blocks)
#[tauri::command]
pub async fn delete_page(
    app: tauri::AppHandle,
    workspace_path: String,
    page_id: String,
) -> Result<bool, String> {
    println!("[delete_page] Called with page_id: {}", page_id);

    let conn = open_workspace_db(&workspace_path)?;

    // Get parent before deletion
    let page = get_page_by_id(&conn, &page_id)?;
    let parent_id = page.parent_id.clone();

    println!("[delete_page] Found page to delete:");
    println!("  - id: {}", page.id);
    println!("  - title: {}", page.title);
    println!("  - parent_id: {:?}", page.parent_id);
    println!("  - file_path: {:?}", page.file_path);

    // Log all pages before deletion
    let all_pages_before: Vec<(String, String, Option<String>)> = conn
        .prepare("SELECT id, title, parent_id FROM pages ORDER BY title")
        .map_err(|e| e.to_string())?
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    println!("[delete_page] All pages before deletion:");
    for (id, title, parent_id) in &all_pages_before {
        println!("  - {} (title: {}, parent: {:?})", id, title, parent_id);
    }

    // Get children that will be deleted by CASCADE
    let children: Vec<(String, String)> = conn
        .prepare("SELECT id, title FROM pages WHERE parent_id = ?")
        .map_err(|e| e.to_string())?
        .query_map([&page_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    if !children.is_empty() {
        println!(
            "[delete_page] WARNING: This page has {} children that will be CASCADE deleted:",
            children.len()
        );
        for (child_id, child_title) in &children {
            println!("  - {} (title: {})", child_id, child_title);
        }
    } else {
        println!("[delete_page] This page has no children");
    }

    // Delete file from file system
    println!("[delete_page] Deleting page file from filesystem...");
    let file_sync = FileSyncService::new(workspace_path.clone());
    file_sync
        .delete_page_file(&conn, &page_id)
        .map_err(|e| format!("Failed to delete page file: {}", e))?;
    println!("[delete_page] Page file deleted successfully");

    // CASCADE will automatically delete all blocks and child pages
    println!("[delete_page] Executing DELETE FROM pages WHERE id = ?...");
    let deleted_count = conn
        .execute("DELETE FROM pages WHERE id = ?", [&page_id])
        .map_err(|e| e.to_string())?;
    println!(
        "[delete_page] Deleted {} page(s) from database (CASCADE may delete more)",
        deleted_count
    );

    // Log all pages after deletion
    let all_pages_after: Vec<(String, String, Option<String>)> = conn
        .prepare("SELECT id, title, parent_id FROM pages ORDER BY title")
        .map_err(|e| e.to_string())?
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    println!("[delete_page] All pages after deletion:");
    for (id, title, parent_id) in &all_pages_after {
        println!("  - {} (title: {}, parent: {:?})", id, title, parent_id);
    }

    let deleted_count_total = all_pages_before.len() - all_pages_after.len();
    println!(
        "[delete_page] Total pages deleted (including CASCADE): {}",
        deleted_count_total
    );

    // Check if parent should be converted back to regular file
    if let Some(pid) = parent_id {
        println!(
            "[delete_page] Checking if parent {} should be converted to file...",
            pid
        );
        check_and_convert_to_file(&conn, &workspace_path, &pid)?;
    }

    // Emit workspace changed event for git monitoring
    crate::utils::events::emit_workspace_changed(&app, &workspace_path);

    println!("[delete_page] Completed successfully");
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
    app: tauri::AppHandle,
    workspace_path: String,
    request: MovePageRequest,
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

    let page = get_page_by_id(&conn, &request.id)?;

    // Emit workspace changed event for git monitoring
    crate::utils::events::emit_workspace_changed(&app, &workspace_path);

    Ok(page)
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

    // Count children (exclude soft-deleted)
    let child_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM pages WHERE parent_id = ? AND is_deleted = 0",
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
    app: tauri::AppHandle,
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

    let page = get_page_by_id(&conn, &page_id)?;

    // Emit workspace changed event for git monitoring
    crate::utils::events::emit_workspace_changed(&app, &workspace_path);

    Ok(page)
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

/// Rewrite wiki links in blocks that reference a moved/renamed page.
///
/// Avoid mojibake by ONLY rewriting the wiki-link target inside `[[...]]` / `![[...]]`
/// markers, and never re-encoding or otherwise altering unrelated unicode content.
///
/// This is a targeted update (no full-workspace scan):
/// 1) Find blocks that contain `[[from_path]]` / `[[from_path|` / `[[from_path#` / `![[from_path...]]`
/// 2) Rewrite only those blocks' `content` fields.
///
/// NOTE:
/// - This updates the DB `blocks.content` only. If markdown files are authoritative,
///   you should additionally sync the affected pages back to disk after this rewrite.
#[tauri::command]
pub async fn rewrite_wiki_links_for_page_path_change(
    workspace_path: String,
    from_path: String,
    to_path: String,
) -> Result<i64, String> {
    if from_path.trim().is_empty() || to_path.trim().is_empty() {
        return Err("from_path/to_path must be non-empty".to_string());
    }
    if from_path == to_path {
        return Ok(0);
    }

    let mut conn = open_workspace_db(&workspace_path)?;
    let now = Utc::now().to_rfc3339();

    // Optimize: Use wiki_links index to find blocks that reference the from_path.
    // This avoids multiple LIKE queries on the blocks table.
    // Wiki links index (idx_wiki_links_target_path) provides O(log n) lookup.
    let mut candidate_ids: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT DISTINCT from_block_id FROM wiki_links WHERE target_path = ?")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(params![&from_path], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?;

        let mut ids = Vec::new();
        for id in rows {
            ids.push(id.map_err(|e| e.to_string())?);
        }
        ids
    };

    // Also check for blocks with wiki links in content that might not be indexed yet.
    // Use a single LIKE query instead of multiple patterns.
    let content_pattern = format!("%[[{}%", from_path);
    {
        let mut stmt2 = conn
            .prepare("SELECT id FROM blocks WHERE content LIKE ? AND id NOT IN (SELECT from_block_id FROM wiki_links WHERE target_path = ?)")
            .map_err(|e| e.to_string())?;

        let rows = stmt2
            .query_map(params![&content_pattern, &from_path], |row| {
                row.get::<_, String>(0)
            })
            .map_err(|e| e.to_string())?;

        for id in rows {
            let id = id.map_err(|e| e.to_string())?;
            if !candidate_ids.contains(&id) {
                candidate_ids.push(id);
            }
        }
    }

    // Sort and deduplicate results
    candidate_ids.sort();
    candidate_ids.dedup();
    let all_candidate_ids = candidate_ids;

    if all_candidate_ids.is_empty() {
        return Ok(0);
    }

    // Track which pages were affected so we can sync them back to markdown files.
    let mut touched_page_ids: Vec<String> = Vec::new();

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let mut updated_count: i64 = 0;

    for block_id in all_candidate_ids {
        let (page_id, content): (String, String) = tx
            .query_row(
                "SELECT page_id, content FROM blocks WHERE id = ?",
                params![&block_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|e| e.to_string())?;

        let updated = rewrite_wiki_link_targets_in_text(&content, &from_path, &to_path);
        if updated == content {
            continue;
        }

        tx.execute(
            "UPDATE blocks SET content = ?, updated_at = ? WHERE id = ?",
            params![updated, &now, &block_id],
        )
        .map_err(|e| e.to_string())?;

        if !touched_page_ids.iter().any(|x| x == &page_id) {
            touched_page_ids.push(page_id);
        }

        updated_count += 1;
    }

    tx.commit().map_err(|e| e.to_string())?;

    // SoT is filesystem markdown: persist the DB mutation back to disk immediately.
    for page_id in touched_page_ids {
        sync_page_to_markdown(&conn, &workspace_path, &page_id)?;
    }

    Ok(updated_count)
}

/// Replace wiki-link targets in a block of markdown text, preserving aliases and anchors.
///
/// Rewrites only:
/// - [[from]]      -> [[to]]
/// - [[from|...]]  -> [[to|...]]
/// - [[from#...]]  -> [[to#...]]
/// - ![[from...]]  -> ![[to...]]
fn rewrite_wiki_link_targets_in_text(input: &str, from: &str, to: &str) -> String {
    // Byte-safe copy:
    // - copy everything outside of wiki link markers verbatim (as bytes)
    // - within a `[[...]]` or `![[...]]`, rewrite ONLY when the target matches `from`
    //
    // This avoids corrupting unrelated unicode content.
    let mut out: Vec<u8> = Vec::with_capacity(input.len());
    let bytes = input.as_bytes();
    let from_bytes = from.as_bytes();
    let to_bytes = to.as_bytes();
    let mut i: usize = 0;

    while i < bytes.len() {
        let is_embed =
            bytes[i] == b'!' && i + 2 < bytes.len() && bytes[i + 1] == b'[' && bytes[i + 2] == b'[';
        let is_link = bytes[i] == b'[' && i + 1 < bytes.len() && bytes[i + 1] == b'[';

        if !(is_embed || is_link) {
            out.push(bytes[i]);
            i += 1;
            continue;
        }

        let start = i;
        let open_len = if is_embed { 3 } else { 2 };
        let mut j = i + open_len;

        while j + 1 < bytes.len() {
            if bytes[j] == b']' && bytes[j + 1] == b']' {
                break;
            }
            j += 1;
        }

        if j + 1 >= bytes.len() {
            // Unterminated marker; copy remainder as-is.
            out.extend_from_slice(&bytes[start..]);
            break;
        }

        // inner is bytes[(i+open_len)..j]
        let inner_start = i + open_len;
        let inner_end = j;

        // Check whether inner starts with from and is followed by `]]` / `|` / `#`.
        let mut did_replace = false;
        if inner_end >= inner_start + from_bytes.len()
            && &bytes[inner_start..(inner_start + from_bytes.len())] == from_bytes
        {
            let tail_start = inner_start + from_bytes.len();
            let tail = &bytes[tail_start..inner_end];

            let should_replace = tail.is_empty() || tail[0] == b'|' || tail[0] == b'#';
            if should_replace {
                // Write open marker bytes
                out.extend_from_slice(&bytes[start..inner_start]);
                // Write the new target bytes
                out.extend_from_slice(to_bytes);
                // Write the tail bytes
                out.extend_from_slice(tail);
                // Write closing "]]"
                out.extend_from_slice(b"]]");
                i = j + 2;
                did_replace = true;
            }
        }

        if did_replace {
            continue;
        }

        // Default: copy through closing brackets unchanged.
        out.extend_from_slice(&bytes[start..(j + 2)]);
        i = j + 2;
    }

    // Input was valid UTF-8; we only copied/replaced byte slices from/to UTF-8 strings.
    // Converting back to String should be safe.
    String::from_utf8(out).unwrap_or_else(|_| input.to_string())
}

// NOTE: We intentionally do not sync pages back to markdown files here.
// The authoritative source of truth should be clarified (DB vs filesystem) before adding
// any automatic "DB -> markdown" writes in this command module.
