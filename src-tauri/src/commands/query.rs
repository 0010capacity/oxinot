use crate::commands::workspace::open_workspace_db;
use crate::models::block::Block;
use crate::models::query::*;
use crate::services::query_service;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QueryResultBlock {
    #[serde(flatten)]
    pub block: Block,
    pub page_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QueryResult {
    pub blocks: Vec<QueryResultBlock>,
    pub total_count: usize,
    pub error: Option<String>,
}

/// Execute a query macro and return matching blocks
#[tauri::command]
pub async fn execute_query_macro(
    workspace_path: String,
    query_string: String,
) -> Result<QueryResult, String> {
    // Parse the query macro
    let query_macro = match query_service::parse_query_macro(&query_string) {
        Ok(macro_obj) => macro_obj,
        Err(e) => {
            return Ok(QueryResult {
                blocks: vec![],
                total_count: 0,
                error: Some(e.message),
            })
        }
    };

    // Open database connection
    let conn = open_workspace_db(&workspace_path).map_err(|e| format!("Database error: {}", e))?;

    // Execute query
    match execute_query(&conn, &workspace_path, query_macro) {
        Ok(blocks) => {
            let total_count = blocks.len();
            Ok(QueryResult {
                blocks,
                total_count,
                error: None,
            })
        }
        Err(e) => Ok(QueryResult {
            blocks: vec![],
            total_count: 0,
            error: Some(e),
        }),
    }
}

/// Execute the parsed query and return matching blocks
fn execute_query(
    conn: &rusqlite::Connection,
    _workspace_path: &str,
    query_macro: QueryMacro,
) -> Result<Vec<QueryResultBlock>, String> {
    let filter = &query_macro.query_filter;

    // Query all blocks with their page information
    let mut stmt = conn
        .prepare(
            "SELECT b.id, b.page_id, b.parent_id, b.content, b.order_weight,
                    b.is_collapsed, b.block_type, b.language, b.created_at, b.updated_at,
                    p.page_path
             FROM blocks b
             JOIN pages p ON b.page_id = p.id
             ORDER BY b.created_at",
        )
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let mut results = Vec::new();

    let rows = stmt
        .query_map([], |row| {
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
                row.get::<_, String>(10)?, // page_path
            ))
        })
        .map_err(|e| format!("Failed to query blocks: {}", e))?;

    for row_result in rows {
        let (block, page_path) = row_result.map_err(|e| format!("Failed to read row: {}", e))?;

        // Filter by FROM clause (page paths)
        let matches_path = filter
            .from
            .paths
            .iter()
            .any(|pattern| query_service::matches_path_pattern(pattern, &page_path));

        if !matches_path {
            continue;
        }

        // Filter by LIKE clause (text search)
        if let Some(ref like_text) = filter.like {
            if !block.content.contains(like_text) {
                continue;
            }
        }

        // Filter by DEPTH clause (hierarchy level)
        if let Some(ref depth_range) = filter.depth {
            let level = get_block_depth(conn, &block.id).unwrap_or(0);
            if level < depth_range.min || level > depth_range.max {
                continue;
            }
        }

        results.push(QueryResultBlock { block, page_path });
    }

    // Apply SORT
    if let Some(ref sort_type) = filter.sort {
        match sort_type {
            SortType::Random => {
                use rand::seq::SliceRandom;
                let mut rng = rand::thread_rng();
                results.shuffle(&mut rng);
            }
            SortType::Abc => {
                results.sort_by(|a, b| a.block.content.cmp(&b.block.content));
            }
            SortType::Cba => {
                results.sort_by(|a, b| b.block.content.cmp(&a.block.content));
            }
            SortType::Numeric123 => {
                results.sort_by(|a, b| a.block.created_at.cmp(&b.block.created_at));
            }
            SortType::Numeric321 => {
                results.sort_by(|a, b| b.block.created_at.cmp(&a.block.created_at));
            }
        }
    }

    // Apply LIMIT
    if let Some(limit) = filter.limit {
        results.truncate(limit as usize);
    }

    Ok(results)
}

/// Get the depth (hierarchy level) of a block by counting ancestors
fn get_block_depth(conn: &rusqlite::Connection, block_id: &str) -> Result<u32, String> {
    let mut depth = 0;
    let mut current_id = block_id.to_string();

    loop {
        let parent_id: Option<String> = conn
            .query_row(
                "SELECT parent_id FROM blocks WHERE id = ?",
                [&current_id],
                |row| row.get(0),
            )
            .map_err(|_| "Failed to query block".to_string())?;

        match parent_id {
            Some(parent) => {
                depth += 1;
                current_id = parent;
            }
            None => break,
        }
    }

    Ok(depth)
}

/// Parse block type from string
fn parse_block_type(s: String) -> crate::models::block::BlockType {
    match s.as_str() {
        "code" => crate::models::block::BlockType::Code,
        "fence" => crate::models::block::BlockType::Fence,
        _ => crate::models::block::BlockType::Bullet,
    }
}
