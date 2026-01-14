use rusqlite::{params, Connection};

use crate::models::block::Block;
use crate::utils::markdown::blocks_to_markdown;

/// Sync a page's blocks from DB to its markdown file on disk.
///
/// - `workspace_path` is the absolute workspace root path
/// - `pages.file_path` is expected to be workspace-relative (e.g., `프로젝트/Oxinot.md`)
///
/// This function is intended to be the single shared implementation used by:
/// - block commands after block mutations
/// - page commands that rewrite block content (e.g., bulk link rewrite)
///
/// NOTE:
/// This is a *DB -> file* sync. In this project, the filesystem markdown is the
/// source of truth (SoT), but we still serialize from DB after mutations to keep
/// the on-disk file consistent with DB state.
pub fn sync_page_to_markdown(
    conn: &Connection,
    workspace_path: &str,
    page_id: &str,
) -> Result<(), String> {
    // Get file path for this page
    // NOTE: file_path in DB is workspace-relative (P0 requirement)
    let file_path: Option<String> = conn
        .query_row(
            "SELECT file_path FROM pages WHERE id = ?",
            [page_id],
            |row| row.get(0),
        )
        .ok();

    if file_path.is_none() {
        return Ok(()); // No file path, skip
    }

    // Get all blocks for this page
    let mut stmt = conn
        .prepare(
            "SELECT id, page_id, parent_id, content, order_weight,
                is_collapsed, block_type, language, created_at, updated_at
         FROM blocks WHERE page_id = ? ORDER BY order_weight",
        )
        .map_err(|e| e.to_string())?;

    let blocks: Vec<Block> = stmt
        .query_map([page_id], |row| {
            Ok(Block {
                id: row.get(0)?,
                page_id: row.get(1)?,
                parent_id: row.get(2)?,
                content: row.get(3)?,
                order_weight: row.get(4)?,
                is_collapsed: row.get::<_, i32>(5)? != 0,
                block_type: crate::models::block::string_to_block_type(&row.get::<_, String>(6)?),
                language: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Convert blocks to markdown
    let markdown = blocks_to_markdown(&blocks);

    // Write to file
    if let Some(path) = file_path {
        let full_path = std::path::Path::new(workspace_path).join(&path);
        std::fs::write(&full_path, markdown).map_err(|e| format!("Failed to write file: {}", e))?;

        // Update page's mtime and size in DB to reflect the file change
        if let Ok(metadata) = std::fs::metadata(&full_path) {
            if let Ok(mtime) = metadata.modified() {
                if let Ok(duration) = mtime.duration_since(std::time::UNIX_EPOCH) {
                    let mtime_secs = duration.as_secs() as i64;
                    let size = metadata.len() as i64;

                    conn.execute(
                        "UPDATE pages SET file_mtime = ?, file_size = ? WHERE id = ?",
                        params![mtime_secs, size, page_id],
                    )
                    .map_err(|e| format!("Failed to update page metadata: {}", e))?;
                }
            }
        }
    }

    Ok(())
}
