use rusqlite::{params, Connection};
use std::collections::HashMap;

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

/// Read the page markdown file and return its lines + whether it had a trailing '\n'.
fn read_page_lines(full_path: &std::path::Path) -> Result<(Vec<String>, bool), String> {
    let file_text =
        std::fs::read_to_string(full_path).map_err(|e| format!("Failed to read file: {}", e))?;
    let had_trailing_newline = file_text.ends_with('\n');
    let lines: Vec<String> = file_text.lines().map(|s| s.to_string()).collect();
    Ok((lines, had_trailing_newline))
}

/// Write lines back to the page markdown file, preserving whether it originally had a trailing '\n'
/// when possible. (We keep a trailing newline for non-empty files.)
fn write_page_lines(
    full_path: &std::path::Path,
    lines: Vec<String>,
    had_trailing_newline: bool,
) -> Result<(), String> {
    let mut new_text = lines.join("\n");
    if had_trailing_newline || !new_text.is_empty() {
        new_text.push('\n');
    }
    std::fs::write(full_path, new_text).map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(())
}

/// External modification guard based on pages.file_mtime/file_size.
/// Returns `Ok(true)` if safe to patch, `Ok(false)` if caller should fall back.
fn is_safe_to_patch_file(
    conn: &Connection,
    full_path: &std::path::Path,
    page_id: &str,
) -> Result<bool, String> {
    let (db_mtime, db_size): (Option<i64>, Option<i64>) = conn
        .query_row(
            "SELECT file_mtime, file_size FROM pages WHERE id = ?",
            [page_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap_or((None, None));

    if let (Some(expected_mtime), Some(expected_size)) = (db_mtime, db_size) {
        if let Ok(metadata) = std::fs::metadata(full_path) {
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

    Ok(true)
}

/// Update page metadata (mtime/size) after patch write.
fn update_page_file_metadata(
    conn: &Connection,
    full_path: &std::path::Path,
    page_id: &str,
) -> Result<(), String> {
    if let Ok(metadata) = std::fs::metadata(full_path) {
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
    Ok(())
}

/// Find the `ID::<uuid>` marker line index for the given block id.
fn find_marker_idx(lines: &[String], block_id: &str) -> Option<usize> {
    let marker = format!("ID::{}", block_id);
    for (idx, line) in lines.iter().enumerate() {
        if line.trim_start() == marker {
            return Some(idx);
        }
    }
    None
}

/// From a marker line index, walk upward to find the bullet-start line (`- `) at the same indent.
/// Returns the start index of the segment.
fn find_bullet_segment_start(lines: &[String], marker_idx: usize) -> Option<usize> {
    if marker_idx == 0 {
        return None;
    }

    let indent_len_val = indent_len(&lines[marker_idx]);

    let mut j = marker_idx;
    while j > 0 {
        j -= 1;
        if indent_len(&lines[j]) != indent_len_val {
            return None;
        }
        if lines[j].trim_start().starts_with("- ") {
            return Some(j);
        }
    }

    None
}

/// Find the end of a bullet subtree (inclusive line index), given the root segment start and marker.
/// A subtree contains:
/// - the root segment [root_start..=root_marker]
/// - all following segments that are more indented than the root marker indent, until we hit
///   the next segment at indent <= root indent.
fn find_bullet_subtree_end(
    lines: &[String],
    root_start: usize,
    root_marker_idx: usize,
) -> Option<usize> {
    if root_start > root_marker_idx || root_marker_idx >= lines.len() {
        return None;
    }

    let root_indent = indent_len(&lines[root_marker_idx]);
    let mut i = root_marker_idx + 1;

    while i < lines.len() {
        let line = &lines[i];
        let trimmed = line.trim_start();

        // Only treat ID markers as segment boundaries; everything else is within a segment.
        if trimmed.starts_with("ID::") {
            let seg_indent = indent_len(line);
            if seg_indent <= root_indent {
                // Next sibling/ancestor segment; subtree ends just before this segment.
                return Some(i - 1);
            }
        }

        i += 1;
    }

    // Subtree reaches EOF
    Some(lines.len() - 1)
}

/// Re-indent a subtree by adjusting leading spaces on each line by `indent_delta` (can be negative).
/// This assumes indent is represented with spaces (canonical serializer uses two spaces per depth).
fn reindent_subtree_lines(subtree_lines: &mut [String], indent_delta: isize) -> Result<(), String> {
    if indent_delta == 0 {
        return Ok(());
    }

    for line in subtree_lines.iter_mut() {
        let current = indent_len(line) as isize;
        let new_indent = current + indent_delta;
        if new_indent < 0 {
            return Err("Invalid negative indent during subtree reindent".to_string());
        }
        let trimmed = line.trim_start().to_string();
        *line = format!("{}{}", " ".repeat(new_indent as usize), trimmed);
    }

    Ok(())
}

/// Attempt to relocate a Bullet subtree (move/indent/outdent) using a multi-hunk patch:
/// 1) Cut the subtree block region anchored by `ID::<block_id>`
/// 2) Adjust indentation based on the destination parent depth (derived from sibling anchors)
/// 3) Insert the subtree near destination siblings based on DB `order_weight`
///
/// Conservative behavior:
/// - Only acts when the block exists in DB and is Bullet.
/// - Requires on-disk file to match DB mtime/size.
/// - Requires anchors (ID markers) to exist for both source and destination neighborhood.
/// - Returns `Ok(false)` on any ambiguity, allowing full rewrite fallback.
fn try_patch_bullet_subtree_relocation(
    conn: &Connection,
    workspace_path: &str,
    page_id: &str,
    moved_block_id: &str,
) -> Result<bool, String> {
    let file_path: Option<String> = conn
        .query_row(
            "SELECT file_path FROM pages WHERE id = ?",
            [page_id],
            |row| row.get(0),
        )
        .ok();

    let Some(rel_path) = file_path else {
        return Ok(false);
    };

    let full_path = std::path::Path::new(workspace_path).join(&rel_path);

    if !is_safe_to_patch_file(conn, &full_path, page_id)? {
        return Ok(false);
    }

    // Must exist in DB to derive destination/ordering
    let (parent_id, order_weight, block_type): (Option<String>, f64, String) = conn
        .query_row(
            "SELECT parent_id, order_weight, block_type
             FROM blocks
             WHERE id = ? AND page_id = ?",
            params![moved_block_id, page_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|e| e.to_string())?;

    if block_type.to_lowercase() != "bullet" {
        return Ok(false);
    }

    // Determine destination neighbors under the NEW parent (DB already reflects move/indent/outdent).
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

    let (mut lines, had_trailing_newline) = read_page_lines(&full_path)?;

    // ---- Cut subtree from source location (anchored by moved_block_id marker) ----
    let Some(src_marker_idx) = find_marker_idx(&lines, moved_block_id) else {
        return Ok(false);
    };
    let Some(src_start_idx) = find_bullet_segment_start(&lines, src_marker_idx) else {
        return Ok(false);
    };
    let Some(src_end_idx) = find_bullet_subtree_end(&lines, src_start_idx, src_marker_idx) else {
        return Ok(false);
    };

    let src_root_indent = indent_len(&lines[src_marker_idx]);

    // Extract subtree lines [src_start_idx..=src_end_idx]
    let mut subtree_lines: Vec<String> = lines[src_start_idx..=src_end_idx].to_vec();

    // Remove original subtree from the document
    lines.drain(src_start_idx..=src_end_idx);

    // ---- Determine destination indent from sibling/parent anchors ----
    // We infer desired root indent from destination siblings' marker lines (preferred), otherwise:
    // - if parent is None => root indent 0
    // - else find parent marker indent and add +2 spaces
    let mut dest_root_indent_opt: Option<usize> = None;

    if let Some(ns) = next_sibling_id.as_deref() {
        if let Some(mi) = find_marker_idx(&lines, ns) {
            dest_root_indent_opt = Some(indent_len(&lines[mi]));
        } else {
            return Ok(false);
        }
    }

    if dest_root_indent_opt.is_none() {
        if let Some(ps) = prev_sibling_id.as_deref() {
            if let Some(mi) = find_marker_idx(&lines, ps) {
                dest_root_indent_opt = Some(indent_len(&lines[mi]));
            } else {
                return Ok(false);
            }
        }
    }

    if dest_root_indent_opt.is_none() {
        // No siblings under destination parent; infer from parent anchor
        if let Some(pid) = parent_id.as_deref() {
            let Some(pmi) = find_marker_idx(&lines, pid) else {
                return Ok(false);
            };
            let parent_marker_indent = indent_len(&lines[pmi]);
            // Child bullet indent should match parent marker indent (parent bullet indent + 2)
            dest_root_indent_opt = Some(parent_marker_indent);
        } else {
            dest_root_indent_opt = Some(0);
        }
    }

    let dest_root_indent = dest_root_indent_opt.unwrap_or(0);

    // Apply reindent to the entire subtree
    let indent_delta = dest_root_indent as isize - src_root_indent as isize;
    reindent_subtree_lines(&mut subtree_lines, indent_delta)?;

    // ---- Compute insertion point in updated document lines ----
    // Insert before next sibling segment start, else after prev sibling subtree end,
    // else after parent marker (if first child), else end of file.
    let insert_at: usize = if let Some(ns) = next_sibling_id.as_deref() {
        let Some(ns_marker_idx) = find_marker_idx(&lines, ns) else {
            return Ok(false);
        };
        let Some(ns_start_idx) = find_bullet_segment_start(&lines, ns_marker_idx) else {
            return Ok(false);
        };
        ns_start_idx
    } else if let Some(ps) = prev_sibling_id.as_deref() {
        let Some(ps_marker_idx) = find_marker_idx(&lines, ps) else {
            return Ok(false);
        };
        let Some(ps_start_idx) = find_bullet_segment_start(&lines, ps_marker_idx) else {
            return Ok(false);
        };
        let Some(ps_end_idx) = find_bullet_subtree_end(&lines, ps_start_idx, ps_marker_idx) else {
            return Ok(false);
        };
        ps_end_idx + 1
    } else if let Some(pid) = parent_id.as_deref() {
        let Some(p_marker_idx) = find_marker_idx(&lines, pid) else {
            return Ok(false);
        };
        p_marker_idx + 1
    } else {
        lines.len()
    };

    // Insert relocated subtree (multi-hunk complete)
    lines.splice(insert_at..insert_at, subtree_lines);

    write_page_lines(&full_path, lines, had_trailing_newline)?;
    update_page_file_metadata(conn, &full_path, page_id)?;

    Ok(true)
}

/// Attempt to delete a Bullet block from the page markdown file by removing its full bullet segment
/// (one or more lines) and its `ID::<uuid>` marker line, without rewriting the full page.
fn try_patch_bullet_block_deletion(
    conn: &Connection,
    workspace_path: &str,
    page_id: &str,
    deleted_block_id: &str,
) -> Result<bool, String> {
    let file_path: Option<String> = conn
        .query_row(
            "SELECT file_path FROM pages WHERE id = ?",
            [page_id],
            |row| row.get(0),
        )
        .ok();

    let Some(rel_path) = file_path else {
        return Ok(false);
    };

    let full_path = std::path::Path::new(workspace_path).join(&rel_path);

    if !is_safe_to_patch_file(conn, &full_path, page_id)? {
        return Ok(false);
    }

    // Determine block type from DB if it still exists (it may already be deleted from DB).
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

    let (mut lines, had_trailing_newline) = read_page_lines(&full_path)?;

    let Some(mi) = find_marker_idx(&lines, deleted_block_id) else {
        return Ok(false);
    };
    let Some(si) = find_bullet_segment_start(&lines, mi) else {
        return Ok(false);
    };

    lines.drain(si..=mi);

    write_page_lines(&full_path, lines, had_trailing_newline)?;
    update_page_file_metadata(conn, &full_path, page_id)?;

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
    let file_path: Option<String> = conn
        .query_row(
            "SELECT file_path FROM pages WHERE id = ?",
            [page_id],
            |row| row.get(0),
        )
        .ok();

    let Some(rel_path) = file_path else {
        return Ok(false);
    };

    let full_path = std::path::Path::new(workspace_path).join(&rel_path);

    if !is_safe_to_patch_file(conn, &full_path, page_id)? {
        return Ok(false);
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

    let (mut lines, had_trailing_newline) = read_page_lines(&full_path)?;

    let Some(mi) = find_marker_idx(&lines, updated_block_id) else {
        return Ok(false);
    };
    let Some(si) = find_bullet_segment_start(&lines, mi) else {
        return Ok(false);
    };

    // Marker line indent determines the bullet's depth.
    let marker_line = &lines[mi];
    let indent_len_val = indent_len(marker_line);
    let indent = " ".repeat(indent_len_val);

    // Replace [si, mi) with the newly serialized bullet content lines.
    let replacement = bullet_content_to_segment_lines(&indent, &content);

    // Splice in replacement. Keep marker line intact.
    lines.splice(si..mi, replacement);

    write_page_lines(&full_path, lines, had_trailing_newline)?;
    update_page_file_metadata(conn, &full_path, page_id)?;

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
///   - Else (first root block / first child), insert at EOF.
/// - If any shape assumptions fail, returns `Ok(false)` to allow full rewrite fallback.
/// - If the on-disk file appears externally modified (mtime/size differ from DB), returns `Ok(false)`.
fn try_patch_bullet_block_insertion(
    conn: &Connection,
    workspace_path: &str,
    page_id: &str,
    created_block_id: &str,
) -> Result<bool, String> {
    let file_path: Option<String> = conn
        .query_row(
            "SELECT file_path FROM pages WHERE id = ?",
            [page_id],
            |row| row.get(0),
        )
        .ok();

    let Some(rel_path) = file_path else {
        return Ok(false);
    };

    let full_path = std::path::Path::new(workspace_path).join(&rel_path);

    if !is_safe_to_patch_file(conn, &full_path, page_id)? {
        return Ok(false);
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

    let (mut lines, had_trailing_newline) = read_page_lines(&full_path)?;

    // Safety check: ensure the block ID is not already in the file (prevent duplication)
    if find_marker_idx(&lines, created_block_id).is_some() {
        return Ok(false);
    }

    // Infer indent from siblings; default to root indent.
    let mut indent_len_opt: Option<usize> = None;
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

    // Build inserted segment: bullet segment + marker
    let mut insert_segment = bullet_content_to_segment_lines(&indent, &content);
    insert_segment.push(format!("{}  ID::{}", indent, created_block_id));

    // Find insertion index
    let insert_at: usize = if let Some(ns) = next_sibling_id.as_deref() {
        let Some(ns_marker_idx) = find_marker_idx(&lines, ns) else {
            return Ok(false);
        };
        let Some(ns_start_idx) = find_bullet_segment_start(&lines, ns_marker_idx) else {
            return Ok(false);
        };
        ns_start_idx
    } else if let Some(ps) = prev_sibling_id.as_deref() {
        let Some(ps_marker_idx) = find_marker_idx(&lines, ps) else {
            return Ok(false);
        };
        ps_marker_idx + 1
    } else {
        lines.len()
    };

    lines.splice(insert_at..insert_at, insert_segment);

    write_page_lines(&full_path, lines, had_trailing_newline)?;
    update_page_file_metadata(conn, &full_path, page_id)?;

    Ok(true)
}

/// Sync a page after a block creation, attempting safe incremental insertion.
pub fn sync_page_to_markdown_after_create(
    conn: &Connection,
    workspace_path: &str,
    page_id: &str,
    created_block_id: &str,
) -> Result<(), String> {
    if try_patch_bullet_block_insertion(conn, workspace_path, page_id, created_block_id)? {
        return Ok(());
    }
    sync_page_to_markdown(conn, workspace_path, page_id)
}

/// Sync a page after a block update, attempting safe incremental content patch.
pub fn sync_page_to_markdown_after_update(
    conn: &Connection,
    workspace_path: &str,
    page_id: &str,
    updated_block_id: &str,
) -> Result<(), String> {
    if try_patch_bullet_block_content(conn, workspace_path, page_id, updated_block_id)? {
        return Ok(());
    }
    sync_page_to_markdown(conn, workspace_path, page_id)
}

/// Sync a page after a block deletion, attempting safe incremental deletion.
pub fn sync_page_to_markdown_after_delete(
    conn: &Connection,
    workspace_path: &str,
    page_id: &str,
    deleted_block_id: &str,
) -> Result<(), String> {
    if try_patch_bullet_block_deletion(conn, workspace_path, page_id, deleted_block_id)? {
        return Ok(());
    }
    sync_page_to_markdown(conn, workspace_path, page_id)
}

/// Sync a page after a block move/indent/outdent, attempting safe incremental relocation.
pub fn sync_page_to_markdown_after_move(
    conn: &Connection,
    workspace_path: &str,
    page_id: &str,
    moved_block_id: &str,
) -> Result<(), String> {
    if try_patch_bullet_subtree_relocation(conn, workspace_path, page_id, moved_block_id)? {
        return Ok(());
    }
    sync_page_to_markdown(conn, workspace_path, page_id)
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
/// - If `changed_block_id` is `Some`, we attempt safe incremental patching for:
///   - insertions (single-hunk)
///   - deletions (single-hunk)
///   - content edits (single-hunk)
///   - subtree moves/reindents (multi-hunk; best-effort, with conservative fallback)
/// - If patching is not possible or unsafe, we fall back to a full rewrite (current behavior).
///
/// Note:
/// This helper is intended to be called by commands that mutate blocks (create/update/delete/move/etc)
/// so they can pass the specific block id they touched.
pub fn sync_page_to_markdown_after_block_change(
    conn: &Connection,
    workspace_path: &str,
    page_id: &str,
    changed_block_id: Option<&str>,
) -> Result<(), String> {
    // Resolve file path up-front so we can make patch decisions based on on-disk state.
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

    // NOTE: `full_path` was previously used for insertion-patch heuristics. Insertion patching is
    // currently disabled, so we don't need a precomputed `full_path` here.

    if let Some(block_id) = changed_block_id {
        // Deletion patch (may run even if block already removed from DB).
        if try_patch_bullet_block_deletion(conn, workspace_path, page_id, block_id)? {
            return Ok(());
        }

        // Content update patch (requires block present in DB).
        if try_patch_bullet_block_content(conn, workspace_path, page_id, block_id)? {
            return Ok(());
        }
    }

    // --- Full rewrite fallback (canonical behavior) ---

    // Get all blocks for this page
    let mut stmt = conn
        .prepare(
            "SELECT id, page_id, parent_id, content, order_weight,
                is_collapsed, block_type, language, created_at, updated_at
         FROM blocks WHERE page_id = ? ORDER BY order_weight",
        )
        .map_err(|e| e.to_string())?;

    let mut blocks: Vec<Block> = stmt
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
                metadata: HashMap::new(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Load metadata for all blocks
    for block in &mut blocks {
        let metadata = load_block_metadata_for_sync(conn, &block.id)?;
        block.metadata = metadata;
    }

    // Convert blocks to markdown (now includes metadata)
    let markdown = blocks_to_markdown(&blocks);

    // Write to file
    let full_path = std::path::Path::new(workspace_path).join(file_path.unwrap());
    std::fs::write(&full_path, markdown).map_err(|e| format!("Failed to write file: {}", e))?;

    update_page_file_metadata(conn, &full_path, page_id)?;

    Ok(())
}

/// Load metadata for a block (helper for page_sync)
fn load_block_metadata_for_sync(
    conn: &Connection,
    block_id: &str,
) -> Result<HashMap<String, String>, String> {
    let mut stmt = conn
        .prepare("SELECT key, value FROM block_metadata WHERE block_id = ? ORDER BY key")
        .map_err(|e| e.to_string())?;

    let metadata = stmt
        .query_map([block_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<HashMap<_, _>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(metadata)
}
