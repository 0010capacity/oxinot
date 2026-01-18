use crate::commands::workspace::open_workspace_db;
use crate::models::graph::{GraphData, GraphEdge, GraphNode};
use rusqlite::params;
use std::collections::{HashMap, HashSet};

#[tauri::command]
pub async fn get_graph_data(workspace_path: String) -> Result<GraphData, String> {
    let conn = open_workspace_db(&workspace_path)?;

    // Fetch all pages
    let mut stmt = conn
        .prepare("SELECT id, title FROM pages ORDER BY title")
        .map_err(|e| e.to_string())?;

    let mut nodes = Vec::new();
    let mut page_ids = HashSet::new();

    let pages = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Create page nodes
    for (page_id, title) in pages.iter() {
        page_ids.insert(page_id.clone());
        nodes.push(GraphNode {
            id: page_id.clone(),
            label: title.clone(),
            node_type: "page".to_string(),
            page_id: page_id.clone(),
            block_id: None,
        });
    }

    // Fetch wiki links and create edges
    let mut stmt = conn
        .prepare(
            r#"
        SELECT DISTINCT w.from_page_id, w.to_page_id, w.link_type, w.is_embed
        FROM wiki_links w
        WHERE w.to_page_id IS NOT NULL
        ORDER BY w.from_page_id, w.to_page_id
        "#,
        )
        .map_err(|e| e.to_string())?;

    let mut edges = Vec::new();
    let edge_rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,         // from_page_id
                row.get::<_, Option<String>>(1)?, // to_page_id
                row.get::<_, String>(2)?,         // link_type
                row.get::<_, i32>(3)? != 0,       // is_embed
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    for (from_page_id, to_page_id, link_type, is_embed) in edge_rows {
        if let Some(to_id) = to_page_id {
            // Only create edges between existing pages
            if page_ids.contains(&to_id) {
                edges.push(GraphEdge {
                    source: from_page_id,
                    target: to_id,
                    relation_type: link_type,
                    is_embed,
                });
            }
        }
    }

    Ok(GraphData { nodes, edges })
}

#[tauri::command]
pub async fn get_page_graph_data(
    workspace_path: String,
    page_id: String,
    depth: Option<i32>,
) -> Result<GraphData, String> {
    let conn = open_workspace_db(&workspace_path)?;
    let max_depth = depth.unwrap_or(2);

    // Start with the target page
    let mut visited_pages = HashSet::new();
    let mut current_level = vec![page_id.clone()];
    let mut all_pages = HashSet::new();

    all_pages.insert(page_id.clone());

    // BFS to find all connected pages within depth
    for _ in 0..max_depth {
        let mut next_level = Vec::new();

        for page in &current_level {
            if visited_pages.contains(page) {
                continue;
            }
            visited_pages.insert(page.clone());

            // Find outgoing links
            let mut stmt = conn
                .prepare(
                    "SELECT DISTINCT to_page_id FROM wiki_links
                 WHERE from_page_id = ? AND to_page_id IS NOT NULL",
                )
                .map_err(|e| e.to_string())?;

            let linked_pages: Vec<String> = stmt
                .query_map(params![page], |row| row.get(0))
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;

            for linked_page in linked_pages {
                if !all_pages.contains(&linked_page) {
                    all_pages.insert(linked_page.clone());
                    next_level.push(linked_page);
                }
            }

            // Find incoming links (backlinks)
            let mut stmt = conn
                .prepare(
                    "SELECT DISTINCT from_page_id FROM wiki_links
                 WHERE to_page_id = ? AND from_page_id IS NOT NULL",
                )
                .map_err(|e| e.to_string())?;

            let backlinked_pages: Vec<String> = stmt
                .query_map(params![page], |row| row.get(0))
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;

            for backlinked_page in backlinked_pages {
                if !all_pages.contains(&backlinked_page) {
                    all_pages.insert(backlinked_page.clone());
                    next_level.push(backlinked_page);
                }
            }
        }

        current_level = next_level;
        if current_level.is_empty() {
            break;
        }
    }

    // Fetch page details for all connected pages
    let mut stmt = conn
        .prepare("SELECT id, title FROM pages WHERE id = ? ORDER BY title")
        .map_err(|e| e.to_string())?;

    let mut nodes = Vec::new();

    for page_id in &all_pages {
        let result = stmt
            .query_row(params![page_id], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?;

        let (id, title) = result;
        nodes.push(GraphNode {
            id: id.clone(),
            label: title,
            node_type: "page".to_string(),
            page_id: id,
            block_id: None,
        });
    }

    // Fetch edges between all connected pages
    let mut stmt = conn
        .prepare(
            r#"
        SELECT DISTINCT w.from_page_id, w.to_page_id, w.link_type, w.is_embed
        FROM wiki_links w
        WHERE w.to_page_id IS NOT NULL
        "#,
        )
        .map_err(|e| e.to_string())?;

    let mut edges = Vec::new();

    let edge_rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,         // from_page_id
                row.get::<_, Option<String>>(1)?, // to_page_id
                row.get::<_, String>(2)?,         // link_type
                row.get::<_, i32>(3)? != 0,       // is_embed
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    for (from_page_id, to_page_id, link_type, is_embed) in edge_rows {
        if let Some(to_id) = to_page_id {
            // Only include edges where both pages are in our connected set
            if all_pages.contains(&from_page_id) && all_pages.contains(&to_id) {
                edges.push(GraphEdge {
                    source: from_page_id,
                    target: to_id,
                    relation_type: link_type,
                    is_embed,
                });
            }
        }
    }

    Ok(GraphData { nodes, edges })
}
