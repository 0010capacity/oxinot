use chrono::Utc;
use rusqlite::{params, Connection};
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

use crate::models::block::{
    Block, BlockType, CreateBlockRequest, MoveBlockRequest, UpdateBlockRequest,
};
use crate::services::MarkdownMirrorService;
use crate::utils::fractional_index;

/// Get all blocks for a page
#[tauri::command]
pub async fn get_page_blocks(
    db: State<'_, Arc<std::sync::Mutex<Connection>>>,
    page_id: String,
) -> Result<Vec<Block>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

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

/// Create a new block
#[tauri::command]
pub async fn create_block(
    db: State<'_, Arc<std::sync::Mutex<Connection>>>,
    request: CreateBlockRequest,
) -> Result<Block, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

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

    get_block_by_id(&conn, &id)
}

/// Update a block
#[tauri::command]
pub async fn update_block(
    db: State<'_, Arc<std::sync::Mutex<Connection>>>,
    request: UpdateBlockRequest,
) -> Result<Block, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
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

    get_block_by_id(&conn, &request.id)
}

/// Delete a block (and all descendants)
#[tauri::command]
pub async fn delete_block(
    db: State<'_, Arc<std::sync::Mutex<Connection>>>,
    block_id: String,
) -> Result<Vec<String>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    // Collect all descendant IDs
    let deleted_ids = collect_descendant_ids(&conn, &block_id)?;

    // Delete the block and all descendants (CASCADE from schema)
    conn.execute("DELETE FROM blocks WHERE id = ?", [&block_id])
        .map_err(|e| e.to_string())?;

    Ok(deleted_ids)
}

/// Move a block (change parent and/or position)
#[tauri::command]
pub async fn move_block(
    db: State<'_, Arc<std::sync::Mutex<Connection>>>,
    request: MoveBlockRequest,
) -> Result<Block, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

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

    get_block_by_id(&conn, &request.id)
}

/// Indent a block (make it a child of previous sibling)
#[tauri::command]
pub async fn indent_block(
    db: State<'_, Arc<std::sync::Mutex<Connection>>>,
    block_id: String,
) -> Result<Block, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
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

    get_block_by_id(&conn, &block_id)
}

/// Outdent a block (make it a sibling of its parent)
#[tauri::command]
pub async fn outdent_block(
    db: State<'_, Arc<std::sync::Mutex<Connection>>>,
    block_id: String,
) -> Result<Block, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
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

    get_block_by_id(&conn, &block_id)
}

/// Toggle collapse state of a block
#[tauri::command]
pub async fn toggle_collapse(
    db: State<'_, Arc<std::sync::Mutex<Connection>>>,
    block_id: String,
) -> Result<Block, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let block = get_block_by_id(&conn, &block_id)?;

    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE blocks SET is_collapsed = ?, updated_at = ? WHERE id = ?",
        params![(!block.is_collapsed) as i32, &now, &block_id],
    )
    .map_err(|e| e.to_string())?;

    get_block_by_id(&conn, &block_id)
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

/// Queue a page for markdown mirroring
#[tauri::command]
pub async fn queue_mirror(
    mirror_service: State<'_, MarkdownMirrorService>,
    page_id: String,
) -> Result<bool, String> {
    mirror_service.queue_mirror(page_id);
    Ok(true)
}
