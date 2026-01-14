use rusqlite::{params, Connection};

use crate::models::block::Block;
use crate::utils::markdown::{blocks_to_markdown, sanitize_content_for_markdown};

/// Attempt to update a single bullet block's content in the page markdown file by patching
/// the full bullet segment (one or more lines) that appears immediately before its `ID::<uuid>` marker.
///
/// Serializer format for Bullet blocks:
/// - First line: "<indent>- <content_first_line>"
/// - If content has multiple lines, subsequent lines are serialized as lines at the same indent:
///     "<indent><content_next_line>"
/// - Hidden marker line directly after the bullet segment:
///     "<indent>  ID::<uuid>"
///
/// Safety rules:
/// - Only applies to Bullet blocks (current canonical markdown format).
/// - Anchors exclusively on the hidden `ID::<uuid>` marker line.
/// - Uses line-based manipulation (no byte offsets) to avoid UTF-8 corruption.
/// - If the file shape is unexpected (missing marker, missing bullet start, etc.), returns `Ok(false)`
///   so the caller can fall back to a full rewrite.
/// - If the on-disk file appears externally modified (mtime/size differ from DB), returns `Ok(false)`.
fn try_patch_bullet_block_content(
    conn: &Connection,
    workspace_path: &str,
    page_id: &str,
    updated_block_id: &str,
) -> Result<bool, String> {
    // Lookup file path + last known file metadata
    let (file_path, db_mtime, db_size): (Option<String>, Option<i64>, Option<i64>) = conn
        .query_row(
            "SELECT file_path, file_mtime, file_size FROM pages WHERE id = ?",
            [page_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .unwrap_or((None, None, None));

    let Some(rel_path) = file_path else {
        return Ok(false);
    };

    let full_path = std::path::Path::new(workspace_path).join(&rel_path);

    // If we have DB metadata, ensure the file hasn't changed since last sync.
    // If anything looks off, fall back to a full rewrite.
    if let (Some(expected_mtime), Some(expected_size)) = (db_mtime, db_size) {
        if let Ok(metadata) = std::fs::metadata(&full_path) {
            let actual_size = metadata.len() as i64;

            let actual_mtime_secs: Option<i64> = metadata
                .modified()
                .ok()
                .and_then(|mtime| mtime.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64);

            if actual_mtime_secs != Some(expected_mtime) || actual_size != expected_size {
                return Ok(false);
            }
        }
    }

    // Get updated block content + type
    let (block_type, content): (String, String) = conn
        .query_row(
            "SELECT block_type, content FROM blocks WHERE id = ? AND page_id = ?",
            params![updated_block_id, page_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    if block_type.to_lowercase() != "bullet" {
        return Ok(false);
    }

    // Read file as UTF-8 text
    let file_text = std::fs::read_to_string(&full_path)
        .map_err(|e| format!("Failed to read file for patching: {}", e))?;

    // Split into lines, preserving whether the file ended with a trailing newline
    let had_trailing_newline = file_text.ends_with('\n');
    let mut lines: Vec<String> = file_text.lines().map(|s| s.to_string()).collect();

    // Find the ID marker line for this block.
    let marker = format!("ID::{}", updated_block_id);
    let mut marker_idx: Option<usize> = None;

    for (idx, line) in lines.iter().enumerate() {
        let trimmed = line.trim_start();
        if trimmed == marker {
            marker_idx = Some(idx);
            break;
        }
    }

    let Some(mi) = marker_idx else {
        return Ok(false);
    };
    if mi == 0 {
        // Marker cannot be the first line; unexpected file shape.
        return Ok(false);
    }

    // Marker line indent determines the bullet's depth.
    let marker_line = &lines[mi];
    let indent_len = marker_line.len() - marker_line.trim_start().len();
    let indent = &marker_line[..indent_len];

    // Walk upward to find the bullet-start line at the same indent.
    // We stop at the first line with the same indent that begins with "- ".
    // Content continuation lines for this block are at the same indent but do NOT start with "- ".
    let mut start_idx: Option<usize> = None;
    let mut j = mi;
    while j > 0 {
        j -= 1;
        let line = &lines[j];

        let line_indent_len = line.len() - line.trim_start().len();
        if line_indent_len != indent_len {
            // Different indent => reached outside this block's segment.
            // If we haven't found the bullet start yet, the structure is unexpected.
            if start_idx.is_none() {
                return Ok(false);
            }
            break;
        }

        let trimmed = line.trim_start();
        if trimmed.starts_with("- ") {
            start_idx = Some(j);
            break;
        }
    }

    let Some(si) = start_idx else {
        return Ok(false);
    };

    // Replace [si, mi) with the newly serialized bullet content lines.
    let sanitized = sanitize_content_for_markdown(&content);
    let content_lines: Vec<&str> = sanitized.lines().collect();

    // Serializer always writes a bullet line. If content is empty, it becomes "- ".
    let mut replacement: Vec<String> = Vec::new();
    let first = content_lines.first().copied().unwrap_or("");
    replacement.push(format!("{}- {}", indent, first));
    for &line in content_lines.iter().skip(1) {
        replacement.push(format!("{}{}", indent, line));
    }

    // Splice in replacement. Keep marker line intact.
    // Old segment is si..mi (mi itself is the marker line).
    lines.splice(si..mi, replacement);

    // Re-join with '\n'. Keep trailing newline behavior stable (serializer uses trailing newline).
    let mut new_text = lines.join("\n");
    if had_trailing_newline {
        new_text.push('\n');
    }

    std::fs::write(&full_path, new_text)
        .map_err(|e| format!("Failed to write patched file: {}", e))?;

    // Update page metadata (mtime/size) after patch write
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

    Ok(true)
}

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
    // Full rewrite default
    sync_page_to_markdown_after_block_update(conn, workspace_path, page_id, None)
}

/// Backward-compatible alias for existing callers.
///
/// Prefer `sync_page_to_markdown_after_block_change` for new call sites (create/update/delete/move/etc).
pub fn sync_page_to_markdown_after_block_update(
    conn: &Connection,
    workspace_path: &str,
    page_id: &str,
    updated_block_id: Option<&str>,
) -> Result<(), String> {
    sync_page_to_markdown_after_block_change(conn, workspace_path, page_id, updated_block_id)
}

/// Sync a page after a specific block change, allowing a targeted on-disk patch when safe.
///
/// - If `changed_block_id` is `Some`, we attempt a safe incremental patch for Bullet content edits.
/// - If patching is not possible or unsafe, we fall back to a full rewrite (current behavior).
///
/// Note:
/// This helper is intended to be called by commands that mutate blocks (create/update/delete/move/etc)
/// so they can pass the specific block id they touched. For now, only Bullet content edits are patched;
/// other operations fall back to full rewrite.
pub fn sync_page_to_markdown_after_block_change(
    conn: &Connection,
    workspace_path: &str,
    page_id: &str,
    changed_block_id: Option<&str>,
) -> Result<(), String> {
    if let Some(block_id) = changed_block_id {
        if try_patch_bullet_block_content(conn, workspace_path, page_id, block_id)? {
            return Ok(());
        }
    }

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
