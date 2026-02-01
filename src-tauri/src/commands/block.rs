use chrono::Utc;
use rusqlite::OptionalExtension;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use uuid::Uuid;

use crate::commands::workspace::open_workspace_db;
use crate::models::block::{
    Block, BlockType, CreateBlockRequest, MoveBlockRequest, UpdateBlockRequest,
};
use crate::services::wiki_link_index;
use crate::utils::fractional_index;
use crate::utils::page_sync::{
    sync_page_to_markdown, sync_page_to_markdown_after_create, sync_page_to_markdown_after_delete,
    sync_page_to_markdown_after_move, sync_page_to_markdown_after_update,
};

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
pub struct GetBlocksRequest {
    pub block_ids: Vec<String>,
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
    let block_opt = conn
        .query_row(
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
                    metadata: HashMap::new(),
                })
            },
        )
        .optional()
        .map_err(|e| e.to_string())?;

    // Load metadata if block exists
    if let Some(mut block) = block_opt {
        block.metadata = load_block_metadata(conn, &block.id)?;
        Ok(Some(block))
    } else {
        Ok(None)
    }
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
                    metadata: HashMap::new(),
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
    let mut block = rows.last().unwrap().0.clone();

    // Load metadata for the block
    block.metadata = load_block_metadata(conn, &block.id)?;

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

/// Get multiple blocks by id (used for batched fetching).
#[tauri::command]
pub async fn get_blocks(
    workspace_path: String,
    request: GetBlocksRequest,
) -> Result<Vec<Block>, String> {
    let conn = open_workspace_db(&workspace_path)?;

    if request.block_ids.is_empty() {
        return Ok(vec![]);
    }

    // Rusqlite doesn't support "IN (?)" with a vector easily without creating a query string dynamically.
    let placeholders = request
        .block_ids
        .iter()
        .map(|_| "?")
        .collect::<Vec<_>>()
        .join(",");
    let sql = format!(
        "SELECT id, page_id, parent_id, content, order_weight,
                is_collapsed, block_type, language, created_at, updated_at
         FROM blocks WHERE id IN ({})",
        placeholders
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let blocks = stmt
        .query_map(
            rusqlite::params_from_iter(request.block_ids.iter()),
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
                    metadata: HashMap::new(),
                })
            },
        )
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Load metadata for all blocks?
    // If we need metadata, we can add it. For now, let's keep it simple as preview usually just needs content.
    // If needed, we can do a second query or join.
    // Let's stick to basic block data for performance.

    Ok(blocks)
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
    let mut blocks = stmt
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
                metadata: HashMap::new(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Load metadata for all blocks in a single query
    let block_ids: Vec<String> = blocks.iter().map(|b| b.id.clone()).collect();
    let metadata_map = load_blocks_metadata(&conn, &block_ids)?;
    for block in &mut blocks {
        block.metadata = metadata_map.get(&block.id).cloned().unwrap_or_default();
    }

    Ok(blocks)
}

/// Get all blocks for a page
#[tauri::command]
pub async fn get_page_blocks(
    workspace_path: String,
    page_id: String,
) -> Result<Vec<Block>, String> {
    let mut conn = open_workspace_db(&workspace_path)?;

    // Check if page exists first
    let page_exists: bool = conn
        .query_row("SELECT 1 FROM pages WHERE id = ?", [&page_id], |_| Ok(true))
        .optional()
        .map_err(|e| e.to_string())?
        .unwrap_or(false);

    if !page_exists {
        // Return empty blocks for non-existent page instead of error
        return Ok(Vec::new());
    }

    // Try to query blocks, and repair if constraint violation occurs
    loop {
        // Collect blocks in a separate scope to drop statement before retry
        let query_result = query_blocks_for_page(&conn, &page_id);

        match query_result {
            Ok(mut blocks) => {
                // Load metadata for all blocks in a single query
                let block_ids: Vec<String> = blocks.iter().map(|b| b.id.clone()).collect();
                let metadata_map = load_blocks_metadata(&conn, &block_ids)?;
                for block in &mut blocks {
                    block.metadata = metadata_map.get(&block.id).cloned().unwrap_or_default();
                }

                return Ok(blocks);
            }
            Err(e) => {
                if e.contains("FOREIGN KEY constraint") {
                    eprintln!(
                        "[get_page_blocks] FOREIGN KEY constraint failed for page {}: {}",
                        page_id, e
                    );
                    eprintln!("[get_page_blocks] Attempting database repair...");
                    // Perform inline database repair
                    match perform_db_repair(&mut conn) {
                        Ok(()) => {
                            eprintln!("[get_page_blocks] Database repair completed successfully, retrying query");
                            // Retry the loop
                            continue;
                        }
                        Err(repair_err) => {
                            eprintln!("[get_page_blocks] Database repair failed: {}", repair_err);
                            return Err(format!(
                                "FOREIGN KEY constraint failed and repair unsuccessful: {}",
                                e
                            ));
                        }
                    }
                } else {
                    return Err(e);
                }
            }
        }
    }
}

/// Optimized page loading: get blocks without metadata for faster initial render
/// Metadata is loaded separately in the background via `get_page_blocks_metadata`
#[tauri::command]
pub async fn get_page_blocks_fast(
    workspace_path: String,
    page_id: String,
) -> Result<Vec<Block>, String> {
    let mut conn = open_workspace_db(&workspace_path)?;

    // Check if page exists first
    let page_exists: bool = conn
        .query_row("SELECT 1 FROM pages WHERE id = ?", [&page_id], |_| Ok(true))
        .optional()
        .map_err(|e| e.to_string())?
        .unwrap_or(false);

    if !page_exists {
        return Ok(Vec::new());
    }

    // Try to query blocks without metadata, and repair if constraint violation occurs
    loop {
        let query_result = query_blocks_for_page(&conn, &page_id);

        match query_result {
            Ok(blocks) => {
                // Return blocks WITHOUT metadata for fast initial load
                // Metadata will be loaded separately via get_page_blocks_metadata
                return Ok(blocks);
            }
            Err(e) => {
                if e.contains("FOREIGN KEY constraint") {
                    eprintln!(
                        "[get_page_blocks_fast] FOREIGN KEY constraint failed for page {}: {}",
                        page_id, e
                    );
                    eprintln!("[get_page_blocks_fast] Attempting database repair...");
                    match perform_db_repair(&mut conn) {
                        Ok(()) => {
                            eprintln!("[get_page_blocks_fast] Database repair completed successfully, retrying query");
                            continue;
                        }
                        Err(repair_err) => {
                            eprintln!("[get_page_blocks_fast] Database repair failed: {}", repair_err);
                            return Err(format!(
                                "FOREIGN KEY constraint failed and repair unsuccessful: {}",
                                e
                            ));
                        }
                    }
                } else {
                    return Err(e);
                }
            }
        }
    }
}

/// Load metadata for multiple blocks - called asynchronously after initial page load
#[tauri::command]
pub async fn get_page_blocks_metadata(
    workspace_path: String,
    block_ids: Vec<String>,
) -> Result<std::collections::HashMap<String, std::collections::HashMap<String, String>>, String> {
    let result = tokio::task::spawn_blocking(move || {
        let conn = open_workspace_db(&workspace_path)?;
        load_blocks_metadata(&conn, &block_ids)
    })
    .await
    .map_err(|e| format!("Metadata load task failed: {e}"))?;

    result
}

/// Progressive loading: Get only root blocks (parent_id = NULL) for immediate display
/// Children are loaded separately via `get_page_blocks_children`
#[tauri::command]
pub async fn get_page_blocks_root(
    workspace_path: String,
    page_id: String,
) -> Result<Vec<Block>, String> {
    let conn = open_workspace_db(&workspace_path)?;

    // Check if page exists first
    let page_exists: bool = conn
        .query_row("SELECT 1 FROM pages WHERE id = ?", [&page_id], |_| Ok(true))
        .optional()
        .map_err(|e| e.to_string())?
        .unwrap_or(false);

    if !page_exists {
        return Ok(Vec::new());
    }

    let mut stmt = conn
        .prepare(
            "SELECT id, page_id, parent_id, content, order_weight,
                is_collapsed, block_type, language, created_at, updated_at
             FROM blocks
             WHERE page_id = ? AND parent_id IS NULL
             ORDER BY order_weight",
        )
        .map_err(|e| e.to_string())?;

    let blocks = stmt
        .query_map([page_id], |row| {
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
                metadata: HashMap::new(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(blocks)
}

/// Get children for specific parent blocks - used for progressive loading
#[tauri::command]
pub async fn get_page_blocks_children(
    workspace_path: String,
    parent_ids: Vec<String>,
) -> Result<Vec<Block>, String> {
    let conn = open_workspace_db(&workspace_path)?;

    if parent_ids.is_empty() {
        return Ok(vec![]);
    }

    // Build placeholders: ?1, ?2, ?3, ...
    let placeholders = (1..=parent_ids.len())
        .map(|i| format!("?{}", i))
        .collect::<Vec<_>>()
        .join(",");

    let sql = format!(
        "SELECT id, page_id, parent_id, content, order_weight,
                is_collapsed, block_type, language, created_at, updated_at
         FROM blocks
         WHERE parent_id IN ({})
         ORDER BY parent_id, order_weight",
        placeholders
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let blocks = stmt
        .query_map(
            rusqlite::params_from_iter(parent_ids.iter()),
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
                    metadata: HashMap::new(),
                })
            },
        )
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(blocks)
}

/// Load page blocks with metadata and children hierarchy in a single database round-trip.
/// Combines three IPC calls into one for significantly better performance.
#[tauri::command]
pub async fn get_page_blocks_complete(
    workspace_path: String,
    page_id: String,
) -> Result<crate::models::block::PageBlocksComplete, String> {
    let result = tokio::task::spawn_blocking(move || {
        get_page_blocks_complete_impl(&workspace_path, &page_id)
    })
    .await
    .map_err(|e| format!("Block loading task failed: {e}"))?;

    result
}

fn get_page_blocks_complete_impl(
    workspace_path: &str,
    page_id: &str,
) -> Result<crate::models::block::PageBlocksComplete, String> {
    let mut conn = open_workspace_db(workspace_path)?;

    let page_exists: bool = conn
        .query_row("SELECT 1 FROM pages WHERE id = ?", [page_id], |_| Ok(true))
        .optional()
        .map_err(|e| e.to_string())?
        .unwrap_or(false);

    if !page_exists {
        return Ok(crate::models::block::PageBlocksComplete {
            root_blocks: Vec::new(),
            children_by_parent: HashMap::new(),
            metadata: HashMap::new(),
        });
    }

    loop {
        let query_result = query_blocks_for_page(&conn, page_id);

        match query_result {
            Ok(all_blocks) => {
                let block_ids: Vec<String> = all_blocks.iter().map(|b| b.id.clone()).collect();
                let mut metadata_map = load_blocks_metadata(&conn, &block_ids)?;

                let mut root_blocks = Vec::new();
                let mut children_by_parent: HashMap<String, Vec<Block>> = HashMap::new();

                for mut block in all_blocks {
                    block.metadata = metadata_map
                        .remove(&block.id)
                        .unwrap_or_default();

                    if block.parent_id.is_none() {
                        root_blocks.push(block);
                    } else if let Some(parent_id) = &block.parent_id {
                        children_by_parent
                            .entry(parent_id.clone())
                            .or_insert_with(Vec::new)
                            .push(block);
                    }
                }

                return Ok(crate::models::block::PageBlocksComplete {
                    root_blocks,
                    children_by_parent,
                    metadata: metadata_map,
                });
            }
            Err(e) => {
                if e.contains("FOREIGN KEY constraint") {
                    eprintln!(
                        "[get_page_blocks_complete] FOREIGN KEY constraint failed for page {}: {}",
                        page_id, e
                    );
                    eprintln!("[get_page_blocks_complete] Attempting database repair...");
                    match perform_db_repair(&mut conn) {
                        Ok(()) => {
                            eprintln!("[get_page_blocks_complete] Database repair completed successfully, retrying query");
                            continue;
                        }
                        Err(repair_err) => {
                            eprintln!("[get_page_blocks_complete] Database repair failed: {}", repair_err);
                            return Err(format!(
                                "FOREIGN KEY constraint failed and repair unsuccessful: {}",
                                e
                            ));
                        }
                    }
                } else {
                    return Err(e);
                }
            }
        }
    }
}

/// Helper function to query blocks for a page (avoids lifetime issues)
fn query_blocks_for_page(conn: &Connection, page_id: &str) -> Result<Vec<Block>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, page_id, parent_id, content, order_weight,
                is_collapsed, block_type, language, created_at, updated_at
            FROM blocks
            WHERE page_id = ?
            ORDER BY parent_id NULLS FIRST, order_weight",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([page_id], |row| {
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
                metadata: HashMap::new(),
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Helper function to repair database integrity
fn perform_db_repair(conn: &mut Connection) -> Result<(), String> {
    eprintln!("[perform_db_repair] Starting database repair...");

    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to start repair transaction: {}", e))?;

    // 1. Delete blocks with non-existent page_id
    let invalid_page_count = tx
        .execute(
            "DELETE FROM blocks WHERE page_id NOT IN (SELECT id FROM pages)",
            [],
        )
        .map_err(|e| e.to_string())?;
    if invalid_page_count > 0 {
        eprintln!(
            "[perform_db_repair] Deleted {} blocks with invalid page_id",
            invalid_page_count
        );
    }

    // 2. Delete blocks with parent_id that references non-existent block
    let invalid_parent_count = tx
        .execute(
            "DELETE FROM blocks WHERE parent_id IS NOT NULL AND parent_id NOT IN (SELECT id FROM blocks)",
            [],
        )
        .map_err(|e| e.to_string())?;
    if invalid_parent_count > 0 {
        eprintln!(
            "[perform_db_repair] Deleted {} blocks with invalid parent_id",
            invalid_parent_count
        );
    }

    // 3. Fix blocks with parent_id in different page (set to NULL)
    let cross_page_count = tx
        .execute(
            "UPDATE blocks SET parent_id = NULL
             WHERE parent_id IS NOT NULL
             AND EXISTS (
                SELECT 1 FROM blocks b2
                WHERE parent_id = b2.id AND blocks.page_id != b2.page_id
             )",
            [],
        )
        .map_err(|e| e.to_string())?;
    if cross_page_count > 0 {
        eprintln!(
            "[perform_db_repair] Fixed {} blocks with cross-page parent_id",
            cross_page_count
        );
    }

    // 4. Clean up orphaned metadata
    let metadata_count = tx
        .execute(
            "DELETE FROM block_metadata WHERE block_id NOT IN (SELECT id FROM blocks)",
            [],
        )
        .map_err(|e| e.to_string())?;
    if metadata_count > 0 {
        eprintln!(
            "[perform_db_repair] Deleted {} orphaned metadata records",
            metadata_count
        );
    }

    // 5. Clean up orphaned block_refs
    let refs_count = tx
        .execute(
            "DELETE FROM block_refs
             WHERE from_block_id NOT IN (SELECT id FROM blocks)
             OR to_block_id NOT IN (SELECT id FROM blocks)",
            [],
        )
        .map_err(|e| e.to_string())?;
    if refs_count > 0 {
        eprintln!(
            "[perform_db_repair] Deleted {} orphaned block_refs",
            refs_count
        );
    }

    // 6. Clean up orphaned wiki_links
    let wiki_links_count = tx
        .execute(
            "DELETE FROM wiki_links
             WHERE from_page_id NOT IN (SELECT id FROM pages)
             OR from_block_id NOT IN (SELECT id FROM blocks)",
            [],
        )
        .map_err(|e| e.to_string())?;
    if wiki_links_count > 0 {
        eprintln!(
            "[perform_db_repair] Deleted {} orphaned wiki_links",
            wiki_links_count
        );
    }

    // 7. Clean up orphaned block_paths
    let block_paths_count = tx
        .execute(
            "DELETE FROM block_paths
             WHERE block_id NOT IN (SELECT id FROM blocks)
             OR page_id NOT IN (SELECT id FROM pages)",
            [],
        )
        .map_err(|e| e.to_string())?;
    if block_paths_count > 0 {
        eprintln!(
            "[perform_db_repair] Deleted {} orphaned block_paths",
            block_paths_count
        );
    }

    // 8. Clean up orphaned page_paths
    let page_paths_count = tx
        .execute(
            "DELETE FROM page_paths WHERE page_id NOT IN (SELECT id FROM pages)",
            [],
        )
        .map_err(|e| e.to_string())?;
    if page_paths_count > 0 {
        eprintln!(
            "[perform_db_repair] Deleted {} orphaned page_paths",
            page_paths_count
        );
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit repair transaction: {}", e))?;

    eprintln!("[perform_db_repair] Database repair completed successfully");
    Ok(())
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
    app: tauri::AppHandle,
    workspace_path: String,
    request: CreateBlockRequest,
) -> Result<Block, String> {
    let conn = open_workspace_db(&workspace_path)?;
    let conn_mutex = Mutex::new(conn);

    // Calculate order_weight
    let order_weight = {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        calculate_new_order_weight(
            &conn,
            &request.page_id,
            request.parent_id.as_deref(),
            request.after_block_id.as_deref(),
        )?
    };

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let block_type = request.block_type.unwrap_or_default();
    let content = request.content.unwrap_or_default();

    {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
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

        // Index block in FTS5
        index_block_fts(&conn, &id, &request.page_id, &content)?;
    }

    let created_block = {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        get_block_by_id(&conn, &id)?
    };

    // Sync to markdown file (allow targeted patching for this create)
    sync_page_to_markdown_after_create(
        &conn_mutex,
        &workspace_path,
        &created_block.page_id,
        created_block.id.as_str(),
    )
    .await?;

    // Index wiki links
    {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        wiki_link_index::index_block_links(
            &conn,
            &created_block.id,
            &created_block.content,
            &created_block.page_id,
        )
        .map_err(|e| e.to_string())?;
    }

    // Emit workspace changed event for git monitoring
    crate::utils::events::emit_workspace_changed(&app, &workspace_path);

    Ok(created_block)
}

/// Update a block
#[tauri::command]
pub async fn update_block(
    app: tauri::AppHandle,
    workspace_path: String,
    request: UpdateBlockRequest,
) -> Result<Block, String> {
    let conn = open_workspace_db(&workspace_path)?;
    let conn_mutex = Mutex::new(conn);
    let now = Utc::now().to_rfc3339();

    let block = {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        get_block_by_id(&conn, &request.id)?
    };

    let new_content = request.content.unwrap_or(block.content);
    let new_collapsed = request.is_collapsed.unwrap_or(block.is_collapsed);
    let new_block_type = request.block_type.unwrap_or(block.block_type);
    let new_language = request.language.or(block.language);

    {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
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

        // Update FTS5 index with new content
        index_block_fts(&conn, &request.id, &block.page_id, &new_content)?;

        // Update metadata if provided
        if let Some(metadata) = &request.metadata {
            save_block_metadata(&conn, &request.id, metadata)?;
        }
    }

    let updated_block = {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        get_block_by_id(&conn, &request.id)?
    };

    // Sync to markdown file (allow targeted patching for this update)
    sync_page_to_markdown_after_update(
        &conn_mutex,
        &workspace_path,
        &updated_block.page_id,
        updated_block.id.as_str(),
    )
    .await?;

    // Index wiki links
    {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        wiki_link_index::index_block_links(
            &conn,
            &updated_block.id,
            &updated_block.content,
            &updated_block.page_id,
        )
        .map_err(|e| e.to_string())?;
    }

    // Emit workspace changed event for git monitoring
    crate::utils::events::emit_workspace_changed(&app, &workspace_path);

    Ok(updated_block)
}

/// Delete a block (and all descendants)
#[tauri::command]
pub async fn delete_block(
    app: tauri::AppHandle,
    workspace_path: String,
    block_id: String,
) -> Result<Vec<String>, String> {
    let conn = open_workspace_db(&workspace_path)?;
    let conn_mutex = Mutex::new(conn);

    let (page_id, parent_id) = {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        // Get page_id and parent_id before deletion
        conn.query_row(
            "SELECT page_id, parent_id FROM blocks WHERE id = ?",
            [&block_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?)),
        )
        .map_err(|e| e.to_string())?
    };

    // Check if this is the only block in the page (root block with no siblings)
    let is_last_block = {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM blocks WHERE page_id = ?",
                [&page_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        count == 1
    };

    // Get all direct children of the block to be deleted
    let children: Vec<String> = {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id FROM blocks WHERE parent_id = ? ORDER BY order_weight")
            .map_err(|e| e.to_string())?;

        let results: Vec<String> = stmt
            .query_map([&block_id], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<String>, _>>()
            .map_err(|e| e.to_string())?;
        results
    };

    let now = chrono::Utc::now().to_rfc3339();

    {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;

        // If this is the only block in the page, clear content instead of deleting
        if is_last_block {
            conn.execute(
                "UPDATE blocks SET content = '', updated_at = ? WHERE id = ?",
                params![&now, &block_id],
            )
            .map_err(|e| e.to_string())?;

            // Re-index block in FTS5
            index_block_fts(&conn, &block_id, &page_id, "")?;
        } else {
            // Move children to the deleted block's parent (merge/promote children)
            for child_id in children {
                conn.execute(
                    "UPDATE blocks SET parent_id = ?, updated_at = ? WHERE id = ?",
                    params![&parent_id, &now, &child_id],
                )
                .map_err(|e| e.to_string())?;
            }

            // Delete only the target block (children are now preserved and promoted)
            conn.execute("DELETE FROM blocks WHERE id = ?", [&block_id])
                .map_err(|e| e.to_string())?;

            // Remove block from FTS5 index
            deindex_block_fts(&conn, &block_id)?;
        }
    }

    // Sync to markdown file
    if is_last_block {
        sync_page_to_markdown_after_update(&conn_mutex, &workspace_path, &page_id, &block_id)
            .await?;
    } else {
        sync_page_to_markdown_after_delete(
            &conn_mutex,
            &workspace_path,
            &page_id,
            block_id.as_str(),
        )
        .await?;
    }

    // Emit workspace changed event for git monitoring
    crate::utils::events::emit_workspace_changed(&app, &workspace_path);

    // Return only the deleted block ID (not descendants since they're preserved)
    Ok(vec![block_id])
}

// NOTE: Page-to-markdown sync is implemented in `utils/page_sync.rs` as a shared helper.
// Block commands should call `sync_page_to_markdown` from that module.

// NOTE: `string_to_block_type` is now defined in `models/block.rs` so it can be reused by shared sync helpers.

/// Move a block (change parent and/or position)
#[tauri::command]
pub async fn move_block(
    app: tauri::AppHandle,
    workspace_path: String,
    request: MoveBlockRequest,
) -> Result<Block, String> {
    let conn = open_workspace_db(&workspace_path)?;
    let conn_mutex = Mutex::new(conn);

    let block = {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        get_block_by_id(&conn, &request.id)?
    };

    // Calculate new order_weight
    let new_order = {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        calculate_new_order_weight(
            &conn,
            &block.page_id,
            request.new_parent_id.as_deref(),
            request.after_block_id.as_deref(),
        )?
    };

    let now = Utc::now().to_rfc3339();

    {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE blocks SET parent_id = ?, order_weight = ?, updated_at = ? WHERE id = ?",
            params![&request.new_parent_id, new_order, &now, &request.id],
        )
        .map_err(|e| e.to_string())?;
    }

    let moved_block = {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        get_block_by_id(&conn, &request.id)?
    };

    // Sync to markdown file
    sync_page_to_markdown_after_move(
        &conn_mutex,
        &workspace_path,
        &moved_block.page_id,
        &moved_block.id,
    )
    .await?;

    // Emit workspace changed event for git monitoring
    crate::utils::events::emit_workspace_changed(&app, &workspace_path);

    Ok(moved_block)
}

/// Indent a block (make it a child of previous sibling)
#[tauri::command]
pub async fn indent_block(
    app: tauri::AppHandle,
    workspace_path: String,
    block_id: String,
) -> Result<Block, String> {
    let conn = open_workspace_db(&workspace_path)?;
    let conn_mutex = Mutex::new(conn);

    let block = {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        get_block_by_id(&conn, &block_id)?
    };

    // Find previous sibling
    let prev_sibling = {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        find_previous_sibling(&conn, &block)
            .map_err(|_| "Cannot indent: no previous sibling".to_string())?
    };

    // Calculate new order_weight as child of previous sibling
    let new_order = {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        calculate_new_order_weight(
            &conn,
            &block.page_id,
            Some(&prev_sibling.id),
            None, // Add at the end
        )?
    };

    let now = Utc::now().to_rfc3339();

    {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE blocks SET parent_id = ?, order_weight = ?, updated_at = ? WHERE id = ?",
            params![&prev_sibling.id, new_order, &now, &block_id],
        )
        .map_err(|e| e.to_string())?;
    }

    let updated_block = {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        get_block_by_id(&conn, &block_id)?
    };

    // Sync to markdown file
    sync_page_to_markdown_after_move(
        &conn_mutex,
        &workspace_path,
        &updated_block.page_id,
        &updated_block.id,
    )
    .await?;

    // Emit workspace changed event for git monitoring
    crate::utils::events::emit_workspace_changed(&app, &workspace_path);

    Ok(updated_block)
}

/// Outdent a block (make it a sibling of its parent)
#[tauri::command]
pub async fn outdent_block(
    app: tauri::AppHandle,
    workspace_path: String,
    block_id: String,
) -> Result<Block, String> {
    let conn = open_workspace_db(&workspace_path)?;
    let conn_mutex = Mutex::new(conn);

    let block = {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        get_block_by_id(&conn, &block_id)?
    };

    let parent_id = block
        .parent_id
        .as_ref()
        .ok_or("Cannot outdent: already at root level".to_string())?;

    let parent = {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        get_block_by_id(&conn, parent_id)?
    };

    // Calculate new order_weight as sibling of parent
    let new_order = {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        calculate_new_order_weight(
            &conn,
            &block.page_id,
            parent.parent_id.as_deref(),
            Some(parent_id),
        )?
    };

    let now = Utc::now().to_rfc3339();

    {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE blocks SET parent_id = ?, order_weight = ?, updated_at = ? WHERE id = ?",
            params![&parent.parent_id, new_order, &now, &block_id],
        )
        .map_err(|e| e.to_string())?;
    }

    let updated_block = {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        get_block_by_id(&conn, &block_id)?
    };

    // Sync to markdown file
    sync_page_to_markdown_after_move(
        &conn_mutex,
        &workspace_path,
        &updated_block.page_id,
        &updated_block.id,
    )
    .await?;

    // Emit workspace changed event for git monitoring
    crate::utils::events::emit_workspace_changed(&app, &workspace_path);

    Ok(updated_block)
}

/// Toggle collapse state of a block
#[tauri::command]
pub async fn toggle_collapse(
    app: tauri::AppHandle,
    workspace_path: String,
    block_id: String,
) -> Result<Block, String> {
    let conn = open_workspace_db(&workspace_path)?;
    let conn_mutex = Mutex::new(conn);

    let block = {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        get_block_by_id(&conn, &block_id)?
    };

    let now = Utc::now().to_rfc3339();

    {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE blocks SET is_collapsed = ?, updated_at = ? WHERE id = ?",
            params![(!block.is_collapsed) as i32, &now, &block_id],
        )
        .map_err(|e| e.to_string())?;
    }

    let updated_block = {
        let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
        get_block_by_id(&conn, &block_id)?
    };

    // Sync to markdown file
    // Sync to markdown file (collapse state is not reflected in markdown)
    sync_page_to_markdown(&conn_mutex, &workspace_path, &updated_block.page_id).await?;

    // Emit workspace changed event for git monitoring
    crate::utils::events::emit_workspace_changed(&app, &workspace_path);

    Ok(updated_block)
}

/// Merge a block into its previous sibling (move children, append content, delete block).
/// This is an atomic operation to prevent data loss.
#[tauri::command]
pub async fn merge_blocks(
    app: tauri::AppHandle,
    workspace_path: String,
    block_id: String,
    target_id: Option<String>,
) -> Result<Vec<Block>, String> {
    let mut conn = open_workspace_db(&workspace_path)?;

    // 1. Get current block
    let block = get_block_by_id(&conn, &block_id)?;

    // 2. Find target block (previous sibling or specified target)
    let target_block = match target_id {
        Some(tid) => {
            let target = get_block_by_id(&conn, &tid)?;
            if target.page_id != block.page_id {
                return Err("Cannot merge blocks from different pages".to_string());
            }
            target
        }
        None => find_previous_sibling(&conn, &block)
            .map_err(|_| "Cannot merge: no previous sibling".to_string())?,
    };

    // Collect IDs for later use before transaction scope
    let mut moved_child_ids = Vec::new();

    // Start RAII transaction - automatically rolls back on drop if not committed
    {
        let tx = conn
            .transaction()
            .map_err(|e| format!("Failed to start merge transaction: {}", e))?;

        // 3. Move all children of current block to target block
        // They should be appended to the end of target block's children

        // Get existing children of target block to find last order_weight
        let last_child_weight: Option<f64> = tx
            .query_row(
                "SELECT MAX(order_weight) FROM blocks WHERE parent_id = ?",
                params![&target_block.id],
                |row| row.get(0),
            )
            .ok()
            .flatten();

        // Get children of current block - use explicit loop to avoid statement lifetime issues
        let mut children_rows: Vec<(String, f64)> = Vec::new();
        {
            let mut stmt = tx
                .prepare(
                    "SELECT id, order_weight FROM blocks WHERE parent_id = ? ORDER BY order_weight",
                )
                .map_err(|e| e.to_string())?;

            let mut rows = stmt.query([&block_id]).map_err(|e| e.to_string())?;

            while let Some(row) = rows.next().map_err(|e| e.to_string())? {
                let child_id: String = row.get(0).map_err(|e| e.to_string())?;
                let order_weight: f64 = row.get(1).map_err(|e| e.to_string())?;
                children_rows.push((child_id, order_weight));
            }
        }

        let now = Utc::now().to_rfc3339();

        // Reparent each child
        let mut last_weight = last_child_weight;
        for (child_id, _) in children_rows {
            // Calculate new weight (append to end)
            let new_weight = fractional_index::calculate_middle(last_weight, None);
            last_weight = Some(new_weight);

            tx.execute(
                "UPDATE blocks SET parent_id = ?, order_weight = ?, updated_at = ? WHERE id = ?",
                params![&target_block.id, new_weight, &now, &child_id],
            )
            .map_err(|e| e.to_string())?;

            moved_child_ids.push(child_id);
        }

        // 4. Update target block content (append current block content)
        let new_content = format!("{}{}", target_block.content, block.content);

        tx.execute(
            "UPDATE blocks SET content = ?, updated_at = ? WHERE id = ?",
            params![&new_content, &now, &target_block.id],
        )
        .map_err(|e| e.to_string())?;

        // 5. Delete current block (it is now empty and childless)
        tx.execute("DELETE FROM blocks WHERE id = ?", [&block_id])
            .map_err(|e| e.to_string())?;

        // Commit transaction - auto-rollback if any error occurs before this
        tx.commit()
            .map_err(|e| format!("Failed to commit merge transaction: {}", e))?;
    }

    // 6. Sync to markdown (Full rewrite to be safe for complex structural changes)
    // Transaction is released, safe to await async operations now
    let conn_mutex = Mutex::new(open_workspace_db(&workspace_path)?);
    sync_page_to_markdown(&conn_mutex, &workspace_path, &block.page_id).await?;

    // Return all changed blocks (merged block + moved children)
    let mut changed_blocks = Vec::new();

    // Updated target block (merged)
    let conn = open_workspace_db(&workspace_path)?;
    let updated_target = get_block_by_id(&conn, &target_block.id)?;

    // Index wiki links for merged target block
    {
        let conn = open_workspace_db(&workspace_path)?;
        wiki_link_index::index_block_links(
            &conn,
            &updated_target.id,
            &updated_target.content,
            &updated_target.page_id,
        )
        .map_err(|e| e.to_string())?;
    }

    changed_blocks.push(updated_target);

    // Moved children
    for child_id in moved_child_ids {
        let conn = open_workspace_db(&workspace_path)?;
        let child = get_block_by_id(&conn, &child_id)?;
        changed_blocks.push(child);
    }

    // Emit workspace changed event for git monitoring
    crate::utils::events::emit_workspace_changed(&app, &workspace_path);

    Ok(changed_blocks)
}

// ============ Helper Functions ============

fn calculate_new_order_weight(
    conn: &Connection,
    page_id: &str,
    parent_id: Option<&str>,
    after_block_id: Option<&str>,
) -> Result<f64, String> {
    let (before, after) = get_neighbor_weights(conn, page_id, parent_id, after_block_id)?;

    // Check rebalancing
    let needs_rebalance = match (before, after) {
        (Some(b), Some(a)) => fractional_index::needs_rebalancing(b, a),
        (None, Some(a)) => a < 1e-5, // Heuristic: if first item is very close to 0
        (Some(b), None) => b > 1e15, // Heuristic: if last item is huge (near f64 mantissa limit)
        (None, None) => false,
    };

    if needs_rebalance {
        println!(
            "[calculate_new_order_weight] Rebalancing siblings for page {} parent {:?}",
            page_id, parent_id
        );
        rebalance_siblings(conn, page_id, parent_id)?;

        // Re-fetch
        let (before_new, after_new) =
            get_neighbor_weights(conn, page_id, parent_id, after_block_id)?;
        return Ok(fractional_index::calculate_middle(before_new, after_new));
    }

    Ok(fractional_index::calculate_middle(before, after))
}

fn get_neighbor_weights(
    conn: &Connection,
    page_id: &str,
    parent_id: Option<&str>,
    after_block_id: Option<&str>,
) -> Result<(Option<f64>, Option<f64>), String> {
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

            Ok((Some(after_block.order_weight), next_sibling))
        }
        None => {
            // If no after_block_id is provided, we insert at the BEGINNING of the siblings list.
            let first_order: Option<f64> = conn
                .query_row(
                    "SELECT MIN(order_weight) FROM blocks WHERE page_id = ? AND parent_id IS ?",
                    params![page_id, parent_id],
                    |row| row.get(0),
                )
                .ok()
                .flatten();

            Ok((None, first_order))
        }
    }
}

fn rebalance_siblings(
    conn: &Connection,
    page_id: &str,
    parent_id: Option<&str>,
) -> Result<(), String> {
    let mut stmt = conn
        .prepare("SELECT id FROM blocks WHERE page_id = ? AND parent_id IS ? ORDER BY order_weight")
        .map_err(|e| e.to_string())?;

    let sibling_ids: Vec<String> = stmt
        .query_map(params![page_id, parent_id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let new_weights = fractional_index::rebalance_order_weights(sibling_ids.len());
    let now = Utc::now().to_rfc3339();

    for (i, id) in sibling_ids.iter().enumerate() {
        conn.execute(
            "UPDATE blocks SET order_weight = ?, updated_at = ? WHERE id = ?",
            params![new_weights[i], &now, id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Load metadata for a block from the database
fn load_block_metadata(
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

/// Load metadata for multiple blocks in a single query
fn load_blocks_metadata(
    conn: &Connection,
    block_ids: &[String],
) -> Result<HashMap<String, HashMap<String, String>>, String> {
    if block_ids.is_empty() {
        return Ok(HashMap::new());
    }

    // Build placeholders: ?1, ?2, ?3, ...
    let placeholders = (1..=block_ids.len())
        .map(|i| format!("?{}", i))
        .collect::<Vec<_>>()
        .join(",");

    let sql = format!(
        "SELECT block_id, key, value FROM block_metadata WHERE block_id IN ({})",
        placeholders
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let mut metadata_map: HashMap<String, HashMap<String, String>> = HashMap::new();

    let mut rows = stmt
        .query(rusqlite::params_from_iter(block_ids.iter()))
        .map_err(|e| e.to_string())?;

    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let block_id: String = row.get(0).map_err(|e| e.to_string())?;
        let key: String = row.get(1).map_err(|e| e.to_string())?;
        let value: String = row.get(2).map_err(|e| e.to_string())?;

        metadata_map
            .entry(block_id)
            .or_insert_with(HashMap::new)
            .insert(key, value);
    }

    Ok(metadata_map)
}

/// Save metadata for a block to the database
fn save_block_metadata(
    conn: &Connection,
    block_id: &str,
    metadata: &HashMap<String, String>,
) -> Result<(), String> {
    // Delete existing metadata for this block
    conn.execute("DELETE FROM block_metadata WHERE block_id = ?", [block_id])
        .map_err(|e| e.to_string())?;

    // Insert new metadata
    for (key, value) in metadata {
        let metadata_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO block_metadata (id, block_id, key, value) VALUES (?, ?, ?, ?)",
            params![&metadata_id, block_id, key, value],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn get_block_by_id(conn: &Connection, id: &str) -> Result<Block, String> {
    let mut block = conn
        .query_row(
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
                    metadata: HashMap::new(),
                })
            },
        )
        .map_err(|e| format!("Block not found: {}", e))?;

    // Load metadata
    block.metadata = load_block_metadata(conn, &block.id)?;

    Ok(block)
}

#[allow(dead_code)]
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
                metadata: HashMap::new(),
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

/// Add or update a block in the FTS5 index
pub fn index_block_fts(
    conn: &Connection,
    block_id: &str,
    page_id: &str,
    content: &str,
) -> Result<(), String> {
    conn.execute(
        "INSERT OR REPLACE INTO blocks_fts (block_id, page_id, content, anchor_id, path_text)
         VALUES (?, ?, ?, ?, ?)",
        params![block_id, page_id, content, block_id, ""],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Remove a block from the FTS5 index
pub fn deindex_block_fts(conn: &Connection, block_id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM blocks_fts WHERE block_id = ?", [block_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateBlocksBatchRequest {
    pub page_id: String,
    pub blocks: Vec<CreateBlockRequest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateBlocksBatchResponse {
    pub blocks: Vec<Block>,
    pub created_count: usize,
}

#[tauri::command]
pub async fn create_blocks_batch(
    app: tauri::AppHandle,
    workspace_path: String,
    request: CreateBlocksBatchRequest,
) -> Result<CreateBlocksBatchResponse, String> {
    let conn = open_workspace_db(&workspace_path)?;
    let conn_mutex = Mutex::new(conn);

    let mut created_blocks = Vec::new();
    let mut last_block_id: Option<String> = None;

    for mut block_request in request.blocks {
        block_request.page_id = request.page_id.clone();

        let order_weight = {
            let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
            calculate_new_order_weight(
                &conn,
                &block_request.page_id,
                block_request.parent_id.as_deref(),
                last_block_id.as_deref(),
            )?
        };

        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let block_type = block_request.block_type.unwrap_or_default();
        let content = block_request.content.unwrap_or_default();

        {
            let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
            conn.execute(
                "INSERT INTO blocks (id, page_id, parent_id, content, order_weight, block_type, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                params![
                    &id,
                    &block_request.page_id,
                    &block_request.parent_id,
                    &content,
                    order_weight,
                    block_type_to_string(&block_type),
                    &now,
                    &now
                ],
            )
            .map_err(|e| e.to_string())?;

            index_block_fts(&conn, &id, &block_request.page_id, &content)?;
        }

        let created_block = {
            let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
            get_block_by_id(&conn, &id)?
        };

        {
            let conn = conn_mutex.lock().map_err(|e| e.to_string())?;
            wiki_link_index::index_block_links(
                &conn,
                &created_block.id,
                &created_block.content,
                &created_block.page_id,
            )
            .map_err(|e| e.to_string())?;
        }

        last_block_id = Some(created_block.id.clone());
        created_blocks.push(created_block);
    }

    sync_page_to_markdown(
        &conn_mutex,
        &workspace_path,
        &request.page_id,
    )
    .await?;

    crate::utils::events::emit_workspace_changed(&app, &workspace_path);

    Ok(CreateBlocksBatchResponse {
        created_count: created_blocks.len(),
        blocks: created_blocks,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::workspace;
    use crate::models::block::CreateBlockRequest;
    use std::fs;

    #[test]
    fn test_incremental_insertion() {
        tauri::async_runtime::block_on(async {
            // Setup temp workspace
            let temp_dir = std::env::temp_dir().join(format!("oxinot_test_{}", Uuid::new_v4()));
            fs::create_dir_all(&temp_dir).unwrap();
            let path_str = temp_dir.to_string_lossy().to_string();

            // Init workspace (creates .oxinot/db.sqlite)
            workspace::initialize_workspace(path_str.clone())
                .await
                .unwrap();

            // Manually insert a page into DB and create file
            let conn = open_workspace_db(&path_str).unwrap();
            let page_id = Uuid::new_v4().to_string();
            let page_file = "TestPage.md";

            conn.execute(
                "INSERT INTO pages (id, title, file_path, is_directory, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)",
                params![page_id, "TestPage", page_file, Utc::now().to_rfc3339(), Utc::now().to_rfc3339()]
            ).unwrap();

            fs::write(temp_dir.join(page_file), "").unwrap();

            // Sync metadata so mtime/size match (important for safe patching!)
            let metadata = fs::metadata(temp_dir.join(page_file)).unwrap();
            let mtime = metadata
                .modified()
                .unwrap()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64;
            let size = metadata.len() as i64;
            conn.execute(
                "UPDATE pages SET file_mtime = ?, file_size = ? WHERE id = ?",
                params![mtime, size, page_id],
            )
            .unwrap();

            // 1. Create first block
            let req1 = CreateBlockRequest {
                page_id: page_id.clone(),
                parent_id: None,
                content: Some("Block 1".to_string()),
                block_type: None,
                after_block_id: None,
            };
            let b1 = create_block(tauri::AppHandle::default(), path_str.clone(), req1)
                .await
                .unwrap();

            // Verify content
            let content = fs::read_to_string(temp_dir.join(page_file)).unwrap();
            assert!(content.contains("- Block 1"));
            assert!(content.contains(&format!("ID::{}", b1.id)));

            // 2. Create second block (sibling)
            let req2 = CreateBlockRequest {
                page_id: page_id.clone(),
                parent_id: None,
                content: Some("Block 2".to_string()),
                block_type: None,
                after_block_id: Some(b1.id.clone()),
            };
            let b2 = create_block(tauri::AppHandle::default(), path_str.clone(), req2)
                .await
                .unwrap();

            // Verify content
            let content = fs::read_to_string(temp_dir.join(page_file)).unwrap();
            assert!(content.contains("- Block 1"));
            assert!(content.contains("- Block 2"));
            // Check order
            let lines: Vec<&str> = content.lines().collect();
            let b1_idx = lines.iter().position(|l| l.contains("Block 1")).unwrap();
            let b2_idx = lines.iter().position(|l| l.contains("Block 2")).unwrap();
            assert!(b1_idx < b2_idx);

            // Check no duplication
            assert_eq!(content.matches(&format!("ID::{}", b2.id)).count(), 1);

            // Teardown
            fs::remove_dir_all(&temp_dir).unwrap();
        });
    }

    #[test]
    fn test_incremental_relocation() {
        tauri::async_runtime::block_on(async {
            // Setup temp workspace
            let temp_dir =
                std::env::temp_dir().join(format!("oxinot_test_move_{}", Uuid::new_v4()));
            fs::create_dir_all(&temp_dir).unwrap();
            let path_str = temp_dir.to_string_lossy().to_string();

            workspace::initialize_workspace(path_str.clone())
                .await
                .unwrap();

            let conn = open_workspace_db(&path_str).unwrap();
            let page_id = Uuid::new_v4().to_string();
            let page_file = "MovePage.md";

            conn.execute(
                "INSERT INTO pages (id, title, file_path, is_directory, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)",
                params![page_id, "MovePage", page_file, Utc::now().to_rfc3339(), Utc::now().to_rfc3339()]
            ).unwrap();

            fs::write(temp_dir.join(page_file), "").unwrap();
            let update_meta = || {
                let metadata = fs::metadata(temp_dir.join(page_file)).unwrap();
                let mtime = metadata
                    .modified()
                    .unwrap()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs() as i64;
                let size = metadata.len() as i64;
                let conn = open_workspace_db(&path_str).unwrap();
                conn.execute(
                    "UPDATE pages SET file_mtime = ?, file_size = ? WHERE id = ?",
                    params![mtime, size, page_id],
                )
                .unwrap();
            };
            update_meta();

            // Setup:
            // - B1
            // - B2
            let b1 = create_block(
                tauri::AppHandle::default(),
                path_str.clone(),
                CreateBlockRequest {
                    page_id: page_id.clone(),
                    parent_id: None,
                    content: Some("B1".to_string()),
                    block_type: None,
                    after_block_id: None,
                },
            )
            .await
            .unwrap();
            update_meta();
            let b2 = create_block(
                tauri::AppHandle::default(),
                path_str.clone(),
                CreateBlockRequest {
                    page_id: page_id.clone(),
                    parent_id: None,
                    content: Some("B2".to_string()),
                    block_type: None,
                    after_block_id: Some(b1.id.clone()),
                },
            )
            .await
            .unwrap();
            update_meta();

            // 1. Indent B2 under B1
            indent_block(tauri::AppHandle::default(), path_str.clone(), b2.id.clone())
                .await
                .unwrap();
            update_meta();

            let content = fs::read_to_string(temp_dir.join(page_file)).unwrap();
            assert!(content.contains("- B1"));
            assert!(content.contains("  - B2"));
            // Check that B2 marker is more indented
            let lines: Vec<&str> = content.lines().collect();
            let _b1_m_idx = lines
                .iter()
                .position(|l| l.contains(&format!("ID::{}", b1.id)))
                .unwrap();
            let b2_m_idx = lines
                .iter()
                .position(|l| l.contains(&format!("ID::{}", b2.id)))
                .unwrap();
            assert!(lines[b2_m_idx].starts_with("    ID:: ")); // 4 spaces

            // 2. Outdent B2
            outdent_block(tauri::AppHandle::default(), path_str.clone(), b2.id.clone())
                .await
                .unwrap();
            update_meta();

            let content = fs::read_to_string(temp_dir.join(page_file)).unwrap();
            assert!(content.contains("- B1"));
            assert!(content.contains("- B2"));
            assert!(!content.contains("  - B2"));

            // 3. Move B1 after B2
            move_block(
                tauri::AppHandle::default(),
                path_str.clone(),
                MoveBlockRequest {
                    id: b1.id.clone(),
                    new_parent_id: None,
                    after_block_id: Some(b2.id.clone()),
                },
            )
            .await
            .unwrap();
            update_meta();

            let content = fs::read_to_string(temp_dir.join(page_file)).unwrap();
            let lines: Vec<&str> = content.lines().collect();
            let b1_idx = lines.iter().position(|l| l.contains("B1")).unwrap();
            let b2_idx = lines.iter().position(|l| l.contains("B2")).unwrap();
            assert!(b2_idx < b1_idx);

            // Teardown
            fs::remove_dir_all(&temp_dir).unwrap();
        });
    }

    #[test]
    fn test_complex_subtree_relocation() {
        tauri::async_runtime::block_on(async {
            // Setup
            let temp_dir =
                std::env::temp_dir().join(format!("oxinot_test_subtree_{}", Uuid::new_v4()));
            fs::create_dir_all(&temp_dir).unwrap();
            let path_str = temp_dir.to_string_lossy().to_string();
            workspace::initialize_workspace(path_str.clone())
                .await
                .unwrap();

            let conn = open_workspace_db(&path_str).unwrap();
            let page_id = Uuid::new_v4().to_string();
            let page_file = "SubtreePage.md";
            conn.execute(
                "INSERT INTO pages (id, title, file_path, is_directory, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)",
                params![page_id, "SubtreePage", page_file, Utc::now().to_rfc3339(), Utc::now().to_rfc3339()]
            ).unwrap();
            fs::write(temp_dir.join(page_file), "").unwrap();
            let update_meta = || {
                let metadata = fs::metadata(temp_dir.join(page_file)).unwrap();
                let mtime = metadata
                    .modified()
                    .unwrap()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs() as i64;
                let size = metadata.len() as i64;
                let conn = open_workspace_db(&path_str).unwrap();
                conn.execute(
                    "UPDATE pages SET file_mtime = ?, file_size = ? WHERE id = ?",
                    params![mtime, size, page_id],
                )
                .unwrap();
            };
            update_meta();

            // Structure:
            // - Parent1
            //   - Child1
            // - Parent2
            let p1 = create_block(
                tauri::AppHandle::default(),
                path_str.clone(),
                CreateBlockRequest {
                    page_id: page_id.clone(),
                    parent_id: None,
                    content: Some("Parent1".to_string()),
                    block_type: None,
                    after_block_id: None,
                },
            )
            .await
            .unwrap();
            update_meta();
            let _c1 = create_block(
                tauri::AppHandle::default(),
                path_str.clone(),
                CreateBlockRequest {
                    page_id: page_id.clone(),
                    parent_id: Some(p1.id.clone()),
                    content: Some("Child1".to_string()),
                    block_type: None,
                    after_block_id: None,
                },
            )
            .await
            .unwrap();
            update_meta();
            let p2 = create_block(
                tauri::AppHandle::default(),
                path_str.clone(),
                CreateBlockRequest {
                    page_id: page_id.clone(),
                    parent_id: None,
                    content: Some("Parent2".to_string()),
                    block_type: None,
                    after_block_id: Some(p1.id.clone()),
                },
            )
            .await
            .unwrap();
            update_meta();

            // Move Parent1 (and Child1) under Parent2
            move_block(
                tauri::AppHandle::default(),
                path_str.clone(),
                MoveBlockRequest {
                    id: p1.id.clone(),
                    new_parent_id: Some(p2.id.clone()),
                    after_block_id: None,
                },
            )
            .await
            .unwrap();
            update_meta();

            let content = fs::read_to_string(temp_dir.join(page_file)).unwrap();
            assert!(content.contains("- Parent2"));
            assert!(content.contains("  - Parent1"));
            assert!(content.contains("    - Child1"));

            // Verify indent levels
            let lines: Vec<&str> = content.lines().collect();
            let p2_idx = lines.iter().position(|l| l.contains("Parent2")).unwrap();
            let p1_idx = lines.iter().position(|l| l.contains("Parent1")).unwrap();
            let c1_idx = lines.iter().position(|l| l.contains("Child1")).unwrap();

            assert!(p2_idx < p1_idx);
            assert!(p1_idx < c1_idx);
            assert!(lines[p1_idx].starts_with("  - Parent1"));
            assert!(lines[c1_idx].starts_with("    - Child1"));

            // Teardown
            fs::remove_dir_all(&temp_dir).unwrap();
        });
    }

    #[test]
    fn test_merge_blocks() {
        tauri::async_runtime::block_on(async {
            // Setup
            let temp_dir =
                std::env::temp_dir().join(format!("oxinot_test_merge_{}", Uuid::new_v4()));
            fs::create_dir_all(&temp_dir).unwrap();
            let path_str = temp_dir.to_string_lossy().to_string();
            workspace::initialize_workspace(path_str.clone())
                .await
                .unwrap();

            let conn = open_workspace_db(&path_str).unwrap();
            let page_id = Uuid::new_v4().to_string();
            let page_file = "MergePage.md";
            conn.execute(
                "INSERT INTO pages (id, title, file_path, is_directory, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)",
                params![page_id, "MergePage", page_file, Utc::now().to_rfc3339(), Utc::now().to_rfc3339()]
            ).unwrap();
            fs::write(temp_dir.join(page_file), "").unwrap();
            let update_meta = || {
                let metadata = fs::metadata(temp_dir.join(page_file)).unwrap();
                let mtime = metadata
                    .modified()
                    .unwrap()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs() as i64;
                let size = metadata.len() as i64;
                let conn = open_workspace_db(&path_str).unwrap();
                conn.execute(
                    "UPDATE pages SET file_mtime = ?, file_size = ? WHERE id = ?",
                    params![mtime, size, page_id],
                )
                .unwrap();
            };
            update_meta();

            // Structure:
            // - Block1 (content: "A")
            // - Block2 (content: "B")
            //   - Child2_1
            //   - Child2_2
            let b1 = create_block(
                tauri::AppHandle::default(),
                path_str.clone(),
                CreateBlockRequest {
                    page_id: page_id.clone(),
                    parent_id: None,
                    content: Some("A".to_string()),
                    block_type: None,
                    after_block_id: None,
                },
            )
            .await
            .unwrap();
            update_meta();

            let b2 = create_block(
                tauri::AppHandle::default(),
                path_str.clone(),
                CreateBlockRequest {
                    page_id: page_id.clone(),
                    parent_id: None,
                    content: Some("B".to_string()),
                    block_type: None,
                    after_block_id: Some(b1.id.clone()),
                },
            )
            .await
            .unwrap();
            update_meta();

            let c1 = create_block(
                tauri::AppHandle::default(),
                path_str.clone(),
                CreateBlockRequest {
                    page_id: page_id.clone(),
                    parent_id: Some(b2.id.clone()),
                    content: Some("C1".to_string()),
                    block_type: None,
                    after_block_id: None,
                },
            )
            .await
            .unwrap();
            update_meta();

            let _c2 = create_block(
                tauri::AppHandle::default(),
                path_str.clone(),
                CreateBlockRequest {
                    page_id: page_id.clone(),
                    parent_id: Some(b2.id.clone()),
                    content: Some("C2".to_string()),
                    block_type: None,
                    after_block_id: Some(c1.id.clone()),
                },
            )
            .await
            .unwrap();
            update_meta();

            // Merge Block2 into Block1
            // Expected:
            // - Block1 content: "AB"
            // - Block1 children: Child2_1, Child2_2
            // - Block2 deleted
            merge_blocks(
                tauri::AppHandle::default(),
                path_str.clone(),
                b2.id.clone(),
                None,
            )
            .await
            .unwrap();
            update_meta();

            let content = fs::read_to_string(temp_dir.join(page_file)).unwrap();
            assert!(content.contains("- AB"));
            assert!(!content.contains("- B")); // Original B gone (merged)
            assert!(content.contains("  - C1")); // Indented under AB
            assert!(content.contains("  - C2"));

            // Verify DB state
            let conn = open_workspace_db(&path_str).unwrap();
            let b1_new: Block = conn
                .query_row("SELECT * FROM blocks WHERE id = ?", [&b1.id], |r| {
                    Ok(Block {
                        id: r.get(0)?,
                        page_id: r.get(1)?,
                        parent_id: r.get(2)?,
                        content: r.get(3)?,
                        order_weight: r.get(4)?,
                        is_collapsed: r.get::<_, i32>(5)? != 0,
                        block_type: parse_block_type(r.get::<_, String>(6)?),
                        language: r.get(7)?,
                        created_at: r.get(8)?,
                        updated_at: r.get(9)?,
                        metadata: HashMap::new(),
                    })
                })
                .unwrap();

            assert_eq!(b1_new.content, "AB");

            let children_count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM blocks WHERE parent_id = ?",
                    [&b1.id],
                    |r| r.get(0),
                )
                .unwrap();
            assert_eq!(children_count, 2);

            // Teardown
            fs::remove_dir_all(&temp_dir).unwrap();
        });
    }
}
