use crate::commands::workspace::open_workspace_db;
use crate::error::{OxinotError, Result};
use crate::models::wiki_link::{BacklinkBlock, BacklinkGroup, WikiLink};
use crate::services::wiki_link_index;
use rusqlite::params;
use std::collections::HashMap;

#[tauri::command]
pub async fn get_page_backlinks(
    workspace_path: String,
    page_id: String,
) -> Result<Vec<BacklinkGroup>, String> {
    get_page_backlinks_internal(workspace_path, page_id).map_err(|e| e.to_string())
}

fn get_page_backlinks_internal(
    workspace_path: String,
    page_id: String,
) -> Result<Vec<BacklinkGroup>> {
    let conn = open_workspace_db(&workspace_path)?;

    let sql = r#"
        SELECT w.from_page_id, p.title, w.from_block_id, b.content, b.created_at
        FROM wiki_links w
        JOIN pages p ON w.from_page_id = p.id
        JOIN blocks b ON w.from_block_id = b.id
        WHERE w.to_page_id = ? AND p.is_deleted = 0
        ORDER BY p.title, b.created_at
    "#;

    let mut stmt = conn.prepare(sql)?;

    let block_rows = stmt.query_map(params![page_id], |row| {
        Ok((
            row.get::<_, String>(0)?, // from_page_id
            row.get::<_, String>(1)?, // title
            row.get::<_, String>(2)?, // from_block_id
            row.get::<_, String>(3)?, // content
            row.get::<_, String>(4)?, // created_at
        ))
    })?;

    let mut groups: HashMap<String, BacklinkGroup> = HashMap::new();

    for row in block_rows {
        let (p_id, title, b_id, content, created_at) = row?;

        groups
            .entry(p_id.clone())
            .or_insert_with(|| BacklinkGroup {
                page_id: p_id,
                page_title: title,
                blocks: Vec::new(),
            })
            .blocks
            .push(BacklinkBlock {
                block_id: b_id,
                content,
                created_at,
            });
    }

    // Convert to Vec and sort by title
    let mut result: Vec<BacklinkGroup> = groups.into_values().collect();
    result.sort_by(|a, b| a.page_title.cmp(&b.page_title));

    Ok(result)
}

#[tauri::command]
pub async fn get_broken_links(workspace_path: String) -> Result<Vec<WikiLink>, String> {
    get_broken_links_internal(workspace_path).map_err(|e| e.to_string())
}

fn get_broken_links_internal(workspace_path: String) -> Result<Vec<WikiLink>> {
    let conn = open_workspace_db(&workspace_path)?;

    let mut stmt = conn.prepare(
        "SELECT id, from_page_id, from_block_id, to_page_id, link_type, target_path, raw_target, alias, heading, block_ref, is_embed
         FROM wiki_links WHERE to_page_id IS NULL"
    )?;

    let links = stmt
        .query_map([], |row| {
            Ok(WikiLink {
                id: row.get(0)?,
                from_page_id: row.get(1)?,
                from_block_id: row.get(2)?,
                to_page_id: row.get(3)?,
                link_type: row.get(4)?,
                target_path: row.get(5)?,
                raw_target: row.get(6)?,
                alias: row.get(7)?,
                heading: row.get(8)?,
                block_ref: row.get(9)?,
                is_embed: row.get::<_, i32>(10)? != 0,
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(links)
}

#[tauri::command]
pub async fn reindex_wiki_links(workspace_path: String) -> Result<(), String> {
    reindex_wiki_links_internal(workspace_path).map_err(|e| e.to_string())
}

fn reindex_wiki_links_internal(workspace_path: String) -> Result<()> {
    let mut conn = open_workspace_db(&workspace_path)?;
    wiki_link_index::reindex_all_links(&mut conn)?;
    Ok(())
}
