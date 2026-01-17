use crate::commands::workspace::open_workspace_db;
use crate::models::block::Block;
use crate::models::query::*;
use crate::services::query_service;
use rusqlite::ToSql;
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
    
    // 1. Construct the SQL Query dynamically
    let mut sql = String::new();
    let mut params: Vec<Box<dyn ToSql>> = Vec::new();

    // CTE for Depth if needed
    if filter.depth.is_some() {
        sql.push_str(
            "WITH RECURSIVE block_hierarchy(id, depth) AS (
                SELECT id, 0 FROM blocks WHERE parent_id IS NULL
                UNION ALL
                SELECT b.id, bh.depth + 1
                FROM blocks b
                JOIN block_hierarchy bh ON b.parent_id = bh.id
             ) "
        );
    }

    sql.push_str(
        "SELECT b.id, b.page_id, b.parent_id, b.content, b.order_weight,
                b.is_collapsed, b.block_type, b.language, b.created_at, b.updated_at,
                COALESCE(pp.path_text, '') "
    );

    if filter.depth.is_some() {
        sql.push_str(", bh.depth ");
    }

    sql.push_str(
        "FROM blocks b
         JOIN pages p ON b.page_id = p.id
         LEFT JOIN page_paths pp ON p.id = pp.page_id "
    );

    if filter.depth.is_some() {
        sql.push_str("JOIN block_hierarchy bh ON b.id = bh.id ");
    }

    let mut where_clauses = Vec::new();

    // 2. Filter: LIKE (Content)
    if let Some(ref like_text) = filter.like {
        where_clauses.push("b.content LIKE ?".to_string());
        params.push(Box::new(format!("%{}%", like_text)));
    }

    // 3. Filter: FROM (Page Paths)
    // We construct (pp.path_text GLOB ? OR pp.path_text GLOB ?)
    if !filter.from.paths.is_empty() {
        let mut path_conditions = Vec::new();
        for pattern in &filter.from.paths {
            path_conditions.push("COALESCE(pp.path_text, '') GLOB ?");
            params.push(Box::new(pattern.clone()));
        }
        if !path_conditions.is_empty() {
            where_clauses.push(format!("({})", path_conditions.join(" OR ")));
        }
    }

    // 4. Filter: DEPTH (Level)
    if let Some(ref depth_range) = filter.depth {
        where_clauses.push("bh.depth BETWEEN ? AND ?".to_string());
        params.push(Box::new(depth_range.min));
        params.push(Box::new(depth_range.max));
    }

    if !where_clauses.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&where_clauses.join(" AND "));
    }

    // 5. SORT
    if let Some(ref sort_type) = filter.sort {
        match sort_type {
            SortType::Random => sql.push_str(" ORDER BY RANDOM()"),
            SortType::Abc => sql.push_str(" ORDER BY b.content ASC"),
            SortType::Cba => sql.push_str(" ORDER BY b.content DESC"),
            SortType::Numeric123 => sql.push_str(" ORDER BY b.created_at ASC"),
            SortType::Numeric321 => sql.push_str(" ORDER BY b.created_at DESC"),
        }
    } else {
        // Default sort if none specified
        sql.push_str(" ORDER BY b.created_at");
    }

    // 6. LIMIT
    if let Some(limit) = filter.limit {
        sql.push_str(" LIMIT ?");
        params.push(Box::new(limit));
    }

    // Execute the query
    // We need to convert Vec<Box<dyn ToSql>> to &[&dyn ToSql] for rusqlite
    let param_refs: Vec<&dyn ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let mut stmt = conn.prepare(&sql).map_err(|e| format!("Failed to prepare query: {}", e))?;

    let rows = stmt.query_map(param_refs.as_slice(), |row| {
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
                metadata: HashMap::new(), // Placeholder, loaded in batch
            },
            row.get::<_, String>(10)?, // page_path
        ))
    }).map_err(|e| format!("Failed to execute query: {}", e))?;

    let mut results = Vec::new();
    let mut block_ids = Vec::new();

    for row_result in rows {
        let (block, page_path) = row_result.map_err(|e| format!("Failed to read row: {}", e))?;
        block_ids.push(block.id.clone());
        results.push(QueryResultBlock { block, page_path });
    }

    // 7. Batch Load Metadata
    // Avoid N+1 by loading all metadata for these blocks in one query
    if !block_ids.is_empty() {
        // Batch in chunks to avoid SQLite variable limit (usually 999 or 32766)
        // Using 500 as a safe chunk size
        for chunk in block_ids.chunks(500) {
             let placeholders: Vec<String> = chunk.iter().map(|_| "?".to_string()).collect();
             let metadata_sql = format!(
                 "SELECT block_id, key, value FROM block_metadata WHERE block_id IN ({})",
                 placeholders.join(",")
             );
             
             let chunk_params: Vec<&dyn ToSql> = chunk.iter().map(|id| id as &dyn ToSql).collect();
             
             let mut meta_stmt = conn.prepare(&metadata_sql)
                 .map_err(|e| format!("Failed to prepare metadata query: {}", e))?;
                 
             let meta_rows = meta_stmt.query_map(chunk_params.as_slice(), |row| {
                 Ok((
                     row.get::<_, String>(0)?, // block_id
                     row.get::<_, String>(1)?, // key
                     row.get::<_, String>(2)?, // value
                 ))
             }).map_err(|e| format!("Failed to query metadata batch: {}", e))?;

             // Distribute metadata to blocks
             // We first collect metadata into a temporary map to avoid O(N*M) lookup
             let mut meta_map: HashMap<String, HashMap<String, String>> = HashMap::new();
             
             for meta_res in meta_rows {
                 let (block_id, key, value) = meta_res.map_err(|e| format!("Failed to read metadata: {}", e))?;
                 meta_map.entry(block_id).or_default().insert(key, value);
             }

             // Assign back to results
             for result in results.iter_mut() {
                 if let Some(metadata) = meta_map.remove(&result.block.id) {
                     result.block.metadata = metadata;
                 }
             }
        }
    }

    Ok(results)
}

/// Parse block type from string
fn parse_block_type(s: String) -> crate::models::block::BlockType {
    match s.as_str() {
        "code" => crate::models::block::BlockType::Code,
        "fence" => crate::models::block::BlockType::Fence,
        _ => crate::models::block::BlockType::Bullet,
    }
}