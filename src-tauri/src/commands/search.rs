use serde::{Deserialize, Serialize};

use crate::commands::workspace::open_workspace_db;
use crate::error::Result;

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub page_id: String,
    pub page_title: String,
    pub result_type: String, // "page" or "block"
    pub content: String,
    pub snippet: String, // Highlighted snippet with match
}

#[tauri::command]
pub fn search_content(workspace_path: String, query: String) -> Result<Vec<SearchResult>, String> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }

    search_content_internal(workspace_path, query).map_err(|e| e.to_string())
}

fn search_content_internal(workspace_path: String, query: String) -> Result<Vec<SearchResult>> {
    let conn = open_workspace_db(&workspace_path)?;
    let mut results = Vec::new();

    // Search query pattern for LIKE
    let search_pattern = format!("%{}%", query);

    // 1. Search in page titles
    let mut stmt = conn.prepare(
        "SELECT id, title, parent_id
         FROM pages
         WHERE title LIKE ?1 AND is_deleted = 0
         ORDER BY title COLLATE NOCASE",
    )?;

    let page_results = stmt.query_map([&search_pattern], |row| {
        let id: String = row.get(0)?;
        let title: String = row.get(1)?;

        // Create snippet with highlighted match
        let snippet = highlight_match(&title, &query);

        Ok(SearchResult {
            id: id.clone(),
            page_id: id,
            page_title: title.clone(),
            result_type: "page".to_string(),
            content: title,
            snippet,
        })
    })?;

    for result in page_results {
        if let Ok(r) = result {
            results.push(r);
        }
    }

    // 2. Search in block content
    let mut stmt = conn.prepare(
        "SELECT b.id, b.page_id, b.content, p.title
         FROM blocks b
         JOIN pages p ON b.page_id = p.id
         WHERE b.content LIKE ?1 AND p.is_deleted = 0
         ORDER BY p.title COLLATE NOCASE, b.order_weight",
    )?;

    let block_results = stmt.query_map([&search_pattern], |row| {
        let id: String = row.get(0)?;
        let page_id: String = row.get(1)?;
        let content: String = row.get(2)?;
        let page_title: String = row.get(3)?;

        // Create snippet with highlighted match
        let snippet = create_snippet(&content, &query);

        Ok(SearchResult {
            id,
            page_id,
            page_title,
            result_type: "block".to_string(),
            content,
            snippet,
        })
    })?;

    for result in block_results {
        if let Ok(r) = result {
            results.push(r);
        }
    }

    Ok(results)
}

/// Highlight the matching text in the content
fn highlight_match(text: &str, query: &str) -> String {
    let lower_text = text.to_lowercase();
    let lower_query = query.to_lowercase();

    if let Some(pos) = lower_text.find(&lower_query) {
        let before = &text[..pos];
        let matched = &text[pos..pos + query.len()];
        let after = &text[pos + query.len()..];
        format!("{}**{}**{}", before, matched, after)
    } else {
        text.to_string()
    }
}

/// Create a snippet around the matching text
fn create_snippet(text: &str, query: &str) -> String {
    let lower_text = text.to_lowercase();
    let lower_query = query.to_lowercase();

    if let Some(pos) = lower_text.find(&lower_query) {
        let snippet_length = 100;
        let start = if pos > snippet_length / 2 {
            pos - snippet_length / 2
        } else {
            0
        };

        let end = std::cmp::min(text.len(), pos + query.len() + snippet_length / 2);

        let mut snippet = String::new();
        if start > 0 {
            snippet.push_str("...");
        }

        // Get the snippet text
        let snippet_text = &text[start..end];

        // Find the query position within the snippet
        let query_pos_in_snippet = pos - start;
        let before = &snippet_text[..query_pos_in_snippet];
        let matched = &snippet_text[query_pos_in_snippet..query_pos_in_snippet + query.len()];
        let after = &snippet_text[query_pos_in_snippet + query.len()..];

        snippet.push_str(&format!("{}**{}**{}", before, matched, after));

        if end < text.len() {
            snippet.push_str("...");
        }

        snippet
    } else {
        // No match found, return first part of text
        let max_len = 100;
        if text.len() > max_len {
            format!("{}...", &text[..max_len])
        } else {
            text.to_string()
        }
    }
}
