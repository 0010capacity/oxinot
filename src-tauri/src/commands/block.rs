use chrono::Utc;
use rusqlite::OptionalExtension;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::commands::workspace::open_workspace_db;
use crate::models::block::{
    Block, BlockType, CreateBlockRequest, MoveBlockRequest, UpdateBlockRequest,
};
use crate::utils::fractional_index;
use crate::utils::page_sync::sync_page_to_markdown;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockWithPath {
    pub block: Block,
    pub ancestor_ids: Vec<String>, // root -> ... -> self
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetBlockRequest {
    pub block_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetBlockSubtreeRequest {
    pub block_id: String,
    /// Optional max depth relative to the requested root (0 = root only).
    pub max_depth: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetBlockAncestorsRequest {
    pub block_id: String,
}

/// Helper: load a single block from DB, or return None.
fn get_block_by_id_opt(conn: &Connection, id: &str) -> Result<Option<Block>, String> {
    conn.query_row(
        "SELECT id, page_id, parent_id, content, order_weight,
                is_collapsed, block_type, language, created_at, updated_at
         FROM blocks WHERE id = ?",
        [id],
        |row| {
            Ok(Block {
                id: row.get(0)?,
                page_id: row.get(1)?,
                parent_id: row.get(2)?,
                content: row.get(3)?,
                order_weight: row.get(4)?,
                is_collapsed: row.get::<_, i32>(5)? != 0,
                block_type: parse_block_type(row.get::<_, String>(6)?),
                language: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        },
    )
    .optional()
    .map_err(|e| e.to_string())
}

/// Helper: return ancestor chain (root -> ... -> self) for a given block_id.
/// Also returns the block itself, if found.
fn get_block_with_ancestors(
    conn: &Connection,
    block_id: &str,
) -> Result<Option<BlockWithPath>, String> {
    let sql = r#"
WITH RECURSIVE
anc(id, page_id, parent_id, content, order_weight, is_collapsed, block_type, language, created_at, updated_at, depth) AS (
    SELECT id, page_id, parent_id, content, order_weight, is_collapsed, block_type, language, created_at, updated_at, 0
    FROM blocks
    WHERE id = ?1
    UNION ALL
    SELECT b.id, b.page_id, b.parent_id, b.content, b.order_weight, b.is_collapsed, b.block_type, b.language, b.created_at, b.updated_at, anc.depth + 1
    FROM blocks b
    JOIN anc ON anc.parent_id = b.id
)
SELECT id, page_id, parent_id, content, order_weight, is_collapsed, block_type, language, created_at, updated_at, depth
FROM anc
ORDER BY depth DESC
"#;

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![block_id], |row| {
            Ok((
                Block {
                    id: row.get(0)?,
                    page_id: row.get(1)?,
                    parent_id: row.get(2)?,
                    content: row.get(3)?,
                    order_weight: row.get(4)?,
                    is_collapsed: row.get::<_, i32>(5)? != 0,
                    block_type: parse_block_type(row.get::<_, String>(6)?),
                    language: row.get(7)?,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                },
                row.get::<_, i64>(10)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    if rows.is_empty() {
        return Ok(None);
    }

    // rows are ordered root..self; last is the requested block
    let ancestor_ids = rows.iter().map(|(b, _)| b.id.clone()).collect::<Vec<_>>();
    let block = rows.last().unwrap().0.clone();

    Ok(Some(BlockWithPath {
        block,
        ancestor_ids,
    }))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockSearchResult {
    pub id: String,
    pub page_id: String,
    pub parent_id: Option<String>,
    pub content: String,
    pub depth: i32,
    pub page_path: String,
    pub block_path: String,
    pub full_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchBlocksRequest {
    pub query: String,
    pub limit: Option<i64>,
}

/// Resolve a block by a breadcrumb-like path within a page:
/// Example input: ["X", "Y"] resolves the child block named "X" under root,
/// then child "Y" under "X", matching by exact content equality (trimmed).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolveBlockPathRequest {
    pub page_id: String,
    pub segments: Vec<String>,
}

//
// Navigation / embed helpers
//

/// Get a single block by id (used for (()) navigation).
#[tauri::command]
pub async fn get_block(
    workspace_path: String,
    request: GetBlockRequest,
) -> Result<Option<BlockWithPath>, String> {
    let conn = open_workspace_db(&workspace_path)?;
    get_block_with_ancestors(&conn, &request.block_id)
}

/// Get a block’s ancestor chain (zoom path) as block IDs (root -> ... -> self).
#[tauri::command]
pub async fn get_block_ancestors(
    workspace_path: String,
    request: GetBlockAncestorsRequest,
) -> Result<Vec<String>, String> {
    let conn = open_workspace_db(&workspace_path)?;
    let Some(bwp) = get_block_with_ancestors(&conn, &request.block_id)? else {
        return Ok(vec![]);
    };
    Ok(bwp.ancestor_ids)
}

/// Get the subtree blocks for embedding (root block + all descendants).
/// Returns blocks in unspecified order; caller can group by parent/order_weight.
#[tauri::command]
pub async fn get_block_subtree(
    workspace_path: String,
    request: GetBlockSubtreeRequest,
) -> Result<Vec<Block>, String> {
    let conn = open_workspace_db(&workspace_path)?;

    // First, ensure the root exists (and capture page_id so we can scope recursion if needed).
    let root = get_block_by_id_opt(&conn, &request.block_id)?
        .ok_or_else(|| "Block not found".to_string())?;

    let max_depth = request.max_depth.unwrap_or(1000).clamp(0, 10_000);

    let sql = r#"
WITH RECURSIVE descendants AS (
    SELECT
        id, page_id, parent_id, content, order_weight, is_collapsed, block_type, language, created_at, updated_at,
        0 as depth
    FROM blocks
    WHERE id = ?1

    UNION ALL

    SELECT
        b.id, b.page_id, b.parent_id, b.content, b.order_weight, b.is_collapsed, b.block_type, b.language, b.created_at, b.updated_at,
        d.depth + 1
    FROM blocks b
    JOIN descendants d ON b.parent_id = d.id
    WHERE d.depth < ?2
)
SELECT id, page_id, parent_id, content, order_weight, is_collapsed, block_type, language, created_at, updated_at
FROM descendants
"#;

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let blocks = stmt
        .query_map(params![root.id, max_depth], |row| {
            Ok(Block {
                id: row.get(0)?,
                page_id: row.get(1)?,
                parent_id: row.get(2)?,
                content: row.get(3)?,
                order_weight: row.get(4)?,
                is_collapsed: row.get::<_, i32>(5)? != 0,
                block_type: parse_block_type(row.get::<_, String>(6)?),
                language: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(blocks)
}

/// Get all blocks for a page
#[tauri::command]
pub async fn get_page_blocks(
    workspace_path: String,
    page_id: String,
) -> Result<Vec<Block>, String> {
    let conn = open_workspace_db(&workspace_path)?;

    let mut stmt = conn
        .prepare(
            "SELECT id, page_id, parent_id, content, order_weight,
                is_collapsed, block_type, language, created_at, updated_at
            FROM blocks
            WHERE page_id = ?
            ORDER BY parent_id NULLS FIRST, order_weight",
        )
        .map_err(|e| e.to_string())?;

    let blocks = stmt
        .query_map([&page_id], |row| {
            Ok(Block {
                id: row.get(0)?,
                page_id: row.get(1)?,
                parent_id: row.get(2)?,
                content: row.get(3)?,
                order_weight: row.get(4)?,
                is_collapsed: row.get::<_, i32>(5)? != 0,
                block_type: parse_block_type(row.get::<_, String>(6)?),
                language: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(blocks)
}

/// Search blocks across the whole workspace DB by content substring.
/// Returns breadcrumb-like paths (page path + block path) for completion/navigation.
///
/// NOTE:
/// - This uses `LIKE` matching for now. You can later replace with FTS.
/// - Depth/path are computed via recursive CTEs.
/// - Path segments are derived from block content (trimmed, newlines collapsed).
#[tauri::command]
pub async fn search_blocks(
    workspace_path: String,
    request: SearchBlocksRequest,
) -> Result<Vec<BlockSearchResult>, String> {
    let conn = open_workspace_db(&workspace_path)?;

    let q = request.query.trim();
    if q.is_empty() {
        return Ok(vec![]);
    }
    let limit = request.limit.unwrap_or(50).clamp(1, 200);
    let like = format!("%{}%", q);

    // Recursive CTE to:
    // - build page path as "A/B/C" by walking pages.parent_id
    // - build block path as "X/Y" by walking blocks.parent_id within a page
    //
    // We compute paths only for matching blocks, but use CTEs to get ancestor chains.
    let sql = r#"
WITH RECURSIVE
page_chain(id, title, parent_id, path) AS (
    SELECT p.id, p.title, p.parent_id, p.title as path
    FROM pages p
    WHERE p.parent_id IS NULL
    UNION ALL
    SELECT c.id, c.title, c.parent_id, (pc.path || '/' || c.title) as path
    FROM pages c
    JOIN page_chain pc ON pc.id = c.parent_id
),
-- normalize content for path segments: trim + collapse internal whitespace
norm_blocks AS (
    SELECT
        b.id,
        b.page_id,
        b.parent_id,
        TRIM(REPLACE(REPLACE(b.content, CHAR(10), ' '), CHAR(13), ' ')) as content
    FROM blocks b
),
-- block path via parent traversal, within the same page
block_chain(id, page_id, parent_id, content, depth, path) AS (
    SELECT
        nb.id,
        nb.page_id,
        nb.parent_id,
        nb.content,
        0 as depth,
        nb.content as path
    FROM norm_blocks nb
    WHERE nb.parent_id IS NULL

    UNION ALL

    SELECT
        nb.id,
        nb.page_id,
        nb.parent_id,
        nb.content,
        bc.depth + 1 as depth,
        (bc.path || '/' || nb.content) as path
    FROM norm_blocks nb
    JOIN block_chain bc ON bc.id = nb.parent_id
    WHERE nb.page_id = bc.page_id
)
SELECT
    nb.id,
    nb.page_id,
    nb.parent_id,
    nb.content,
    COALESCE(bc.depth, 0) as depth,
    COALESCE(pc.path, '') as page_path,
    COALESCE(bc.path, nb.content) as block_path,
    CASE
        WHEN COALESCE(pc.path, '') = '' THEN COALESCE(bc.path, nb.content)
        ELSE (pc.path || '/' || COALESCE(bc.path, nb.content))
    END as full_path
FROM norm_blocks nb
LEFT JOIN block_chain bc ON bc.id = nb.id
LEFT JOIN page_chain pc ON pc.id = nb.page_id
WHERE nb.content LIKE ?1
ORDER BY LENGTH(nb.content) ASC
LIMIT ?2
"#;

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![like, limit], |row| {
            Ok(BlockSearchResult {
                id: row.get(0)?,
                page_id: row.get(1)?,
                parent_id: row.get(2)?,
                content: row.get(3)?,
                depth: row.get(4)?,
                page_path: row.get(5)?,
                block_path: row.get(6)?,
                full_path: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

/// Resolve block path segments within a page by exact content match at each level.
/// Assumes uniqueness per parent is enforced at the editor level (per your design).
#[tauri::command]
pub async fn resolve_block_path(
    workspace_path: String,
    request: ResolveBlockPathRequest,
) -> Result<Option<String>, String> {
    let conn = open_workspace_db(&workspace_path)?;

    let mut current_parent: Option<String> = None;

    for seg in request.segments {
        let seg = seg.trim();
        if seg.is_empty() {
            return Ok(None);
        }

        // Exact match on content under the current parent in this page.
        // Normalize line breaks to spaces to align with serialization expectations.
        let normalized = seg.replace('\n', " ").replace('\r', " ");

        let found: Option<String> = conn
            .query_row(
                "SELECT id
                 FROM blocks
                 WHERE page_id = ?1
                   AND parent_id IS ?2
                   AND TRIM(REPLACE(REPLACE(content, CHAR(10), ' '), CHAR(13), ' ')) = TRIM(?3)
                 LIMIT 1",
                params![request.page_id, current_parent, normalized],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;

        let Some(id) = found else {
            return Ok(None);
        };

        current_parent = Some(id);
    }

    Ok(current_parent)
}

/// Create a new block
#[tauri::command]
pub async fn create_block(
    workspace_path: String,
    request: CreateBlockRequest,
) -> Result<Block, String> {
    let conn = open_workspace_db(&workspace_path)?;

    // Calculate order_weight
    let order_weight = calculate_new_order_weight(
        &conn,
        &request.page_id,
        request.parent_id.as_deref(),
        request.after_block_id.as_deref(),
    )?;

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let block_type = request.block_type.unwrap_or_default();
    let content = request.content.unwrap_or_default();

    conn.execute(
        "INSERT INTO blocks (id, page_id, parent_id, content, order_weight, block_type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            &id,
            &request.page_id,
            &request.parent_id,
            &content,
            order_weight,
            block_type_to_string(&block_type),
            &now,
            &now
        ],
    )
    .map_err(|e| e.to_string())?;

    let created_block = get_block_by_id(&conn, &id)?;

    // Sync to markdown file
    sync_page_to_markdown(&conn, &workspace_path, &created_block.page_id)?;

    Ok(created_block)
}

/// Update a block
#[tauri::command]
pub async fn update_block(
    workspace_path: String,
    request: UpdateBlockRequest,
) -> Result<Block, String> {
    let conn = open_workspace_db(&workspace_path)?;
    let now = Utc::now().to_rfc3339();

    let block = get_block_by_id(&conn, &request.id)?;

    let new_content = request.content.unwrap_or(block.content);
    let new_collapsed = request.is_collapsed.unwrap_or(block.is_collapsed);
    let new_block_type = request.block_type.unwrap_or(block.block_type);
    let new_language = request.language.or(block.language);

    conn.execute(
        "UPDATE blocks SET content = ?, is_collapsed = ?, block_type = ?, language = ?, updated_at = ? WHERE id = ?",
        params![
            &new_content,
            new_collapsed as i32,
            block_type_to_string(&new_block_type),
            &new_language,
            &now,
            &request.id
        ],
    )
    .map_err(|e| e.to_string())?;

    let updated_block = get_block_by_id(&conn, &request.id)?;

    // Sync to markdown file
    sync_page_to_markdown(&conn, &workspace_path, &updated_block.page_id)?;

    Ok(updated_block)
}

/// Delete a block (and all descendants)
#[tauri::command]
pub async fn delete_block(workspace_path: String, block_id: String) -> Result<Vec<String>, String> {
    let conn = open_workspace_db(&workspace_path)?;

    // Get page_id before deletion
    let page_id: String = conn
        .query_row(
            "SELECT page_id FROM blocks WHERE id = ?",
            [&block_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // Collect all descendant IDs
    let deleted_ids = collect_descendant_ids(&conn, &block_id)?;

    // Delete the block and all descendants (CASCADE from schema)
    conn.execute("DELETE FROM blocks WHERE id = ?", [&block_id])
        .map_err(|e| e.to_string())?;

    // Sync to markdown file
    sync_page_to_markdown(&conn, &workspace_path, &page_id)?;

    Ok(deleted_ids)
}

// NOTE: Page-to-markdown sync is implemented in `utils/page_sync.rs` as a shared helper.
// Block commands should call `sync_page_to_markdown` from that module.

// NOTE: `string_to_block_type` is now defined in `models/block.rs` so it can be reused by shared sync helpers.

/// Move a block (change parent and/or position)
#[tauri::command]
pub async fn move_block(
    workspace_path: String,
    request: MoveBlockRequest,
) -> Result<Block, String> {
    let conn = open_workspace_db(&workspace_path)?;

    let block = get_block_by_id(&conn, &request.id)?;

    // Calculate new order_weight
    let new_order = calculate_new_order_weight(
        &conn,
        &block.page_id,
        request.new_parent_id.as_deref(),
        request.after_block_id.as_deref(),
    )?;

    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE blocks SET parent_id = ?, order_weight = ?, updated_at = ? WHERE id = ?",
        params![&request.new_parent_id, new_order, &now, &request.id],
    )
    .map_err(|e| e.to_string())?;

    let moved_block = get_block_by_id(&conn, &request.id)?;

    // Sync to markdown file
    sync_page_to_markdown(&conn, &workspace_path, &moved_block.page_id)?;

    Ok(moved_block)
}

/// Indent a block (make it a child of previous sibling)
#[tauri::command]
pub async fn indent_block(workspace_path: String, block_id: String) -> Result<Block, String> {
    let conn = open_workspace_db(&workspace_path)?;
    let block = get_block_by_id(&conn, &block_id)?;

    // Find previous sibling
    let prev_sibling = find_previous_sibling(&conn, &block)
        .map_err(|_| "Cannot indent: no previous sibling".to_string())?;

    // Calculate new order_weight as child of previous sibling
    let new_order = calculate_new_order_weight(
        &conn,
        &block.page_id,
        Some(&prev_sibling.id),
        None, // Add at the end
    )?;

    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE blocks SET parent_id = ?, order_weight = ?, updated_at = ? WHERE id = ?",
        params![&prev_sibling.id, new_order, &now, &block_id],
    )
    .map_err(|e| e.to_string())?;

    let updated_block = get_block_by_id(&conn, &block_id)?;

    // Sync to markdown file
    sync_page_to_markdown(&conn, &workspace_path, &updated_block.page_id)?;

    Ok(updated_block)
}

/// Outdent a block (make it a sibling of its parent)
#[tauri::command]
pub async fn outdent_block(workspace_path: String, block_id: String) -> Result<Block, String> {
    let conn = open_workspace_db(&workspace_path)?;
    let block = get_block_by_id(&conn, &block_id)?;

    let parent_id = block
        .parent_id
        .as_ref()
        .ok_or("Cannot outdent: already at root level".to_string())?;

    let parent = get_block_by_id(&conn, parent_id)?;

    // Calculate new order_weight as sibling of parent
    let new_order = calculate_new_order_weight(
        &conn,
        &block.page_id,
        parent.parent_id.as_deref(),
        Some(parent_id),
    )?;

    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE blocks SET parent_id = ?, order_weight = ?, updated_at = ? WHERE id = ?",
        params![&parent.parent_id, new_order, &now, &block_id],
    )
    .map_err(|e| e.to_string())?;

    let updated_block = get_block_by_id(&conn, &block_id)?;

    // Sync to markdown file
    sync_page_to_markdown(&conn, &workspace_path, &updated_block.page_id)?;

    Ok(updated_block)
}

/// Toggle collapse state of a block
#[tauri::command]
pub async fn toggle_collapse(workspace_path: String, block_id: String) -> Result<Block, String> {
    let conn = open_workspace_db(&workspace_path)?;
    let block = get_block_by_id(&conn, &block_id)?;

    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE blocks SET is_collapsed = ?, updated_at = ? WHERE id = ?",
        params![(!block.is_collapsed) as i32, &now, &block_id],
    )
    .map_err(|e| e.to_string())?;

    let updated_block = get_block_by_id(&conn, &block_id)?;

    // Sync to markdown file
    sync_page_to_markdown(&conn, &workspace_path, &updated_block.page_id)?;

    Ok(updated_block)
}

// ============ Helper Functions ============

fn calculate_new_order_weight(
    conn: &Connection,
    page_id: &str,
    parent_id: Option<&str>,
    after_block_id: Option<&str>,
) -> Result<f64, String> {
    match after_block_id {
        Some(after_id) => {
            let after_block = get_block_by_id(conn, after_id)?;

            // Find next sibling after the target block
            let next_sibling: Option<f64> = conn
                .query_row(
                    "SELECT order_weight FROM blocks
                     WHERE page_id = ? AND parent_id IS ? AND order_weight > ?
                     ORDER BY order_weight LIMIT 1",
                    params![page_id, parent_id, after_block.order_weight],
                    |row| row.get(0),
                )
                .ok();

            Ok(fractional_index::calculate_middle(
                Some(after_block.order_weight),
                next_sibling,
            ))
        }
        None => {
            // Add at the end
            let last_order: Option<f64> = conn
                .query_row(
                    "SELECT MAX(order_weight) FROM blocks WHERE page_id = ? AND parent_id IS ?",
                    params![page_id, parent_id],
                    |row| row.get(0),
                )
                .ok()
                .flatten();

            Ok(fractional_index::calculate_middle(last_order, None))
        }
    }
}

fn get_block_by_id(conn: &Connection, id: &str) -> Result<Block, String> {
    conn.query_row(
        "SELECT id, page_id, parent_id, content, order_weight,
                is_collapsed, block_type, language, created_at, updated_at
         FROM blocks WHERE id = ?",
        [id],
        |row| {
            Ok(Block {
                id: row.get(0)?,
                page_id: row.get(1)?,
                parent_id: row.get(2)?,
                content: row.get(3)?,
                order_weight: row.get(4)?,
                is_collapsed: row.get::<_, i32>(5)? != 0,
                block_type: parse_block_type(row.get::<_, String>(6)?),
                language: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        },
    )
    .map_err(|e| format!("Block not found: {}", e))
}

fn collect_descendant_ids(conn: &Connection, block_id: &str) -> Result<Vec<String>, String> {
    // Recursive CTE to collect all descendants
    let mut stmt = conn
        .prepare(
            "WITH RECURSIVE descendants AS (
            SELECT id FROM blocks WHERE id = ?
            UNION ALL
            SELECT b.id FROM blocks b
            INNER JOIN descendants d ON b.parent_id = d.id
        )
        SELECT id FROM descendants",
        )
        .map_err(|e| e.to_string())?;

    let ids = stmt
        .query_map([block_id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(ids)
}

fn find_previous_sibling(conn: &Connection, block: &Block) -> Result<Block, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, page_id, parent_id, content, order_weight,
                is_collapsed, block_type, language, created_at, updated_at
             FROM blocks
             WHERE page_id = ? AND parent_id IS ? AND order_weight < ?
             ORDER BY order_weight DESC
             LIMIT 1",
        )
        .map_err(|e| e.to_string())?;

    stmt.query_row(
        params![&block.page_id, &block.parent_id, block.order_weight],
        |row| {
            Ok(Block {
                id: row.get(0)?,
                page_id: row.get(1)?,
                parent_id: row.get(2)?,
                content: row.get(3)?,
                order_weight: row.get(4)?,
                is_collapsed: row.get::<_, i32>(5)? != 0,
                block_type: parse_block_type(row.get::<_, String>(6)?),
                language: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        },
    )
    .map_err(|e| format!("Previous sibling not found: {}", e))
}

pub fn parse_block_type(s: String) -> BlockType {
    match s.to_lowercase().as_str() {
        "code" => BlockType::Code,
        "fence" => BlockType::Fence,
        _ => BlockType::Bullet,
    }
}

pub fn block_type_to_string(bt: &BlockType) -> String {
    match bt {
        BlockType::Bullet => "bullet".to_string(),
        BlockType::Code => "code".to_string(),
        BlockType::Fence => "fence".to_string(),
    }
}
