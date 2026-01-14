use rusqlite::{params, Connection};

use crate::models::block::Block;
use crate::utils::markdown::{blocks_to_markdown, sanitize_content_for_markdown};

/// Compute leading whitespace count (spaces or tabs) as "indent length".
fn indent_len(s: &str) -> usize {
    s.len() - s.trim_start().len()
}

/// Serialize a Bullet block content to the exact on-disk segment used by the canonical serializer,
/// excluding the trailing ID marker line.
fn bullet_content_to_segment_lines(indent: &str, content: &str) -> Vec<String> {
    let sanitized = sanitize_content_for_markdown(content);
    let content_lines: Vec<&str> = sanitized.lines().collect();

    let mut out: Vec<String> = Vec::new();
    let first = content_lines.first().copied().unwrap_or("");
    out.push(format!("{}- {}", indent, first));
    for &line in content_lines.iter().skip(1) {
        out.push(format!("{}{}", indent, line));
    }
    out
}

/// Attempt to delete a Bullet block from the page markdown file by removing its full bullet segment
/// (one or more lines) and its `ID::<uuid>` marker line, without rewriting the full page.
///
/// Strategy (safe + simple):
/// - Only applies to Bullet blocks.
/// - Anchors on the `ID::<uuid>` marker line.
/// - Walks upward from the marker to find the bullet-start line (`- `) at the same indent.
/// - Removes the entire segment [start_idx ..= marker_idx].
/// - Uses line-based manipulation (no byte offsets) to avoid UTF-8 corruption.
/// - If the on-disk file appears externally modified (mtime/size differ from DB), returns `Ok(false)`.
/// - If the file shape is unexpected, returns `Ok(false)` so the caller can fall back to a full rewrite.
fn try_patch_bullet_block_deletion(
    conn: &Connection,
    workspace_path: &str,
    page_id: &str,
    deleted_block_id: &str,
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

    // External modification guard
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

    // Determine block type from DB if it still exists (it may already be deleted from DB).
    // If it doesn't exist, we still attempt patching by anchor in the file, but we only patch
    // if the file contains the expected marker line.
    let block_type_opt: Option<String> = conn
        .query_row(
            "SELECT block_type FROM blocks WHERE id = ? AND page_id = ?",
            params![deleted_block_id, page_id],
            |row| row.get(0),
        )
        .ok();

    if let Some(bt) = block_type_opt {
        if bt.to_lowercase() != "bullet" {
            return Ok(false);
        }
    }

    // Read file as UTF-8 text
    let file_text = std::fs::read_to_string(&full_path)
        .map_err(|e| format!("Failed to read file for patching: {}", e))?;

    let had_trailing_newline = file_text.ends_with('\n');
    let mut lines: Vec<String> = file_text.lines().map(|s| s.to_string()).collect();

    // Find the ID marker line for this block.
    let marker = format!("ID::{}", deleted_block_id);
    let mut marker_idx: Option<usize> = None;

    for (idx, line) in lines.iter().enumerate() {
        if line.trim_start() == marker {
            marker_idx = Some(idx);
            break;
        }
    }

    let Some(mi) = marker_idx else {
        return Ok(false);
    };

    // Marker line indent determines the bullet's depth.
    let marker_line = &lines[mi];
    let indent_len_val = indent_len(marker_line);

    // Walk upward to find the bullet-start line at the same indent.
    let mut start_idx: Option<usize> = None;
    let mut j = mi;
    while j > 0 {
        j -= 1;
        let line = &lines[j];
        if indent_len(line) != indent_len_val {
            // Different indent => we left the segment without finding the bullet start.
            return Ok(false);
        }
        if line.trim_start().starts_with("- ") {
            start_idx = Some(j);
            break;
        }
    }

    let Some(si) = start_idx else {
        return Ok(false);
    };

    // Remove the segment including the marker line.
    lines.drain(si..=mi);

    // Re-join with '\n'. Preserve trailing newline behavior if there were lines originally.
    let mut new_text = lines.join("\n");
    if had_trailing_newline || !new_text.is_empty() {
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

/// Attempt to insert a newly created Bullet block into the page markdown file by inserting a new
/// bullet segment (and its ID marker line) near its neighbors, without rewriting the full page.
///
/// Strategy (safe + simple):
/// - Only applies to Bullet blocks.
/// - Anchors on existing `ID::<uuid>` marker lines for sibling blocks.
/// - Uses DB ordering (`order_weight`) to pick an insertion point:
///   - If there is a next sibling, insert before the next sibling's bullet segment.
///   - Else if there is a previous sibling, insert after the previous sibling's marker line.
///   - Else (first root block / first child), insert at EOF (with an extra newline if needed).
/// - If any shape assumptions fail, returns `Ok(false)` to allow full rewrite fallback.
/// - If the on-disk file appears externally modified (mtime/size differ from DB), returns `Ok(false)`.
fn try_patch_bullet_block_insertion(
    conn: &Connection,
    workspace_path: &str,
    page_id: &str,
    created_block_id: &str,
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

    // External modification guard
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

    // Fetch created block (must exist in DB)
    let (parent_id, order_weight, block_type, content): (Option<String>, f64, String, String) =
        conn.query_row(
            "SELECT parent_id, order_weight, block_type, content
             FROM blocks
             WHERE id = ? AND page_id = ?",
            params![created_block_id, page_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|e| e.to_string())?;

    if block_type.to_lowercase() != "bullet" {
        return Ok(false);
    }

    // Determine next/prev sibling in DB order under the same parent.
    // Sibling definition: same page_id + same parent_id.
    let next_sibling_id: Option<String> = conn
        .query_row(
            "SELECT id
             FROM blocks
             WHERE page_id = ?
               AND parent_id IS ?
               AND order_weight > ?
             ORDER BY order_weight ASC
             LIMIT 1",
            params![page_id, parent_id, order_weight],
            |row| row.get(0),
        )
        .ok();

    let prev_sibling_id: Option<String> = conn
        .query_row(
            "SELECT id
             FROM blocks
             WHERE page_id = ?
               AND parent_id IS ?
               AND order_weight < ?
             ORDER BY order_weight DESC
             LIMIT 1",
            params![page_id, parent_id, order_weight],
            |row| row.get(0),
        )
        .ok();

    // Read file as UTF-8 text
    let file_text = std::fs::read_to_string(&full_path)
        .map_err(|e| format!("Failed to read file for patching: {}", e))?;

    let had_trailing_newline = file_text.ends_with('\n');
    let mut lines: Vec<String> = file_text.lines().map(|s| s.to_string()).collect();

    // Determine indent for this block from parent in file if possible.
    // We infer indent from siblings' marker line indentation, otherwise default to root indent "".
    let mut indent_len_opt: Option<usize> = None;

    // Helper to find marker line index for a block id
    let find_marker_idx = |ls: &[String], block_id: &str| -> Option<usize> {
        let marker = format!("ID::{}", block_id);
        for (idx, line) in ls.iter().enumerate() {
            if line.trim_start() == marker {
                return Some(idx);
            }
        }
        None
    };

    // Infer indent from next sibling if present, else previous sibling
    if let Some(ns) = next_sibling_id.as_deref() {
        if let Some(mi) = find_marker_idx(&lines, ns) {
            indent_len_opt = Some(indent_len(&lines[mi]));
        }
    }
    if indent_len_opt.is_none() {
        if let Some(ps) = prev_sibling_id.as_deref() {
            if let Some(mi) = find_marker_idx(&lines, ps) {
                indent_len_opt = Some(indent_len(&lines[mi]));
            }
        }
    }

    let indent_len_val = indent_len_opt.unwrap_or(0);
    let indent = " ".repeat(indent_len_val);

    // Build the inserted segment: bullet lines + marker line
    let mut insert_segment = bullet_content_to_segment_lines(&indent, &content);
    insert_segment.push(format!("{}  ID::{}", indent, created_block_id));

    // Find insertion index
    let mut insert_at: Option<usize> = None;

    if let Some(ns) = next_sibling_id.as_deref() {
        if let Some(ns_marker_idx) = find_marker_idx(&lines, ns) {
            // Insert before the next sibling's bullet segment start.
            // Walk upward from marker idx to find the bullet-start line at same indent.
            let target_indent_len = indent_len(&lines[ns_marker_idx]);
            let mut j = ns_marker_idx;
            while j > 0 {
                j -= 1;
                if indent_len(&lines[j]) != target_indent_len {
                    // If we crossed indent boundary without finding bullet start, file shape differs.
                    return Ok(false);
                }
                if lines[j].trim_start().starts_with("- ") {
                    insert_at = Some(j);
                    break;
                }
            }
            if insert_at.is_none() && ns_marker_idx == 0 {
                return Ok(false);
            }
        } else {
            return Ok(false);
        }
    } else if let Some(ps) = prev_sibling_id.as_deref() {
        if let Some(ps_marker_idx) = find_marker_idx(&lines, ps) {
            // Insert after the previous sibling's marker line.
            insert_at = Some(ps_marker_idx + 1);
        } else {
            return Ok(false);
        }
    } else {
        // No siblings: insert at end (or start if file is empty).
        insert_at = Some(lines.len());
    }

    let Some(idx) = insert_at else {
        return Ok(false);
    };

    // Ensure a blank line boundary if inserting at EOF on a non-empty file without trailing newline.
    // (lines vector is already split; trailing newline is handled on join)
    lines.splice(idx..idx, insert_segment);

    let mut new_text = lines.join("\n");
    if had_trailing_newline || !new_text.is_empty() {
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
        // Prefer insert patch when the block exists in DB.
        // If it doesn't exist (e.g. deletion), insertion patch will fail and we can try deletion/content.
        if try_patch_bullet_block_insertion(conn, workspace_path, page_id, block_id)? {
            return Ok(());
        }

        // Deletion may have already removed the block from DB; patch purely by file anchor when possible.
        if try_patch_bullet_block_deletion(conn, workspace_path, page_id, block_id)? {
            return Ok(());
        }

        // Content update patch (requires block present in DB).
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
