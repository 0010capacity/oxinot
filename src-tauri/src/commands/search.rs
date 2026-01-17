use serde::{Deserialize, Serialize};

use crate::commands::workspace::open_workspace_db;

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub page_id: String,
    pub page_title: String,
    pub result_type: String, // "page" or "block"
    pub content: String,
    pub snippet: String, // Highlighted snippet with match
    pub rank: f64,       // Relevance score
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchOptions {
    pub use_phrase_search: bool,
    pub use_boolean_operators: bool,
    pub limit: u32,
}

impl Default for SearchOptions {
    fn default() -> Self {
        Self {
            use_phrase_search: true,
            use_boolean_operators: true,
            limit: 50,
        }
    }
}

/// Search content with advanced FTS5 features
#[tauri::command]
pub fn search_content(workspace_path: String, query: String) -> Result<Vec<SearchResult>, String> {
    search_content_with_options(workspace_path, query, SearchOptions::default())
}

/// Search content with custom options
#[tauri::command]
pub fn search_content_with_options(
    workspace_path: String,
    query: String,
    options: SearchOptions,
) -> Result<Vec<SearchResult>, String> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }

    let conn = open_workspace_db(&workspace_path)?;
    let mut results = Vec::new();

    // 1. Search in page titles (basic LIKE search)
    let search_pattern = format!("%{}%", query);
    let mut stmt = conn
        .prepare(
            "SELECT id, title, parent_id
             FROM pages
             WHERE title LIKE ?1 AND is_deleted = 0
             ORDER BY title COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;

    let page_results = stmt
        .query_map([&search_pattern], |row| {
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
                rank: 100.0, // Page title matches are high priority
            })
        })
        .map_err(|e| e.to_string())?;

    for result in page_results {
        if let Ok(r) = result {
            results.push(r);
        }
    }

    // 2. Search in block content using FTS5 with ranking
    let fts_query = build_fts_query(
        &query,
        options.use_phrase_search,
        options.use_boolean_operators,
    );

    let mut stmt = conn
        .prepare(
            "SELECT b.id, b.page_id, b.content, p.title, b.order_weight,
                    rank
             FROM blocks_fts fts
             JOIN blocks b ON fts.block_id = b.id
             JOIN pages p ON b.page_id = p.id
             WHERE blocks_fts MATCH ?1
             AND p.is_deleted = 0
             ORDER BY rank, p.title COLLATE NOCASE, b.order_weight
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let block_results = stmt
        .query_map([&fts_query, &options.limit.to_string()], |row| {
            let id: String = row.get(0)?;
            let page_id: String = row.get(1)?;
            let content: String = row.get(2)?;
            let page_title: String = row.get(3)?;
            let rank: f64 = row.get(5)?;

            // Create snippet with highlighted match
            let snippet = create_snippet(&content, &query);

            Ok(SearchResult {
                id,
                page_id,
                page_title,
                result_type: "block".to_string(),
                content,
                snippet,
                rank,
            })
        })
        .map_err(|e| e.to_string())?;

    for result in block_results {
        if let Ok(r) = result {
            results.push(r);
        }
    }

    Ok(results)
}

/// Build FTS5 query from user input
/// Supports:
/// - Phrase search: "exact phrase"
/// - Boolean operators: AND, OR, NOT
/// - Prefix search: word*
fn build_fts_query(query: &str, use_phrase_search: bool, use_boolean_operators: bool) -> String {
    let query = query.trim();

    // Check if query already contains FTS operators
    let has_operators = query.contains(" AND ")
        || query.contains(" OR ")
        || query.contains(" NOT ")
        || query.contains("\"");

    if has_operators {
        // User provided explicit FTS syntax, use it as-is (with validation)
        return validate_fts_query(query);
    }

    // Parse query for simple transformations
    if use_boolean_operators && is_multi_word(query) {
        // Multiple words without operators: convert to AND search for better precision
        let words: Vec<&str> = query.split_whitespace().collect();
        if words.len() > 1 {
            return words.join(" AND ");
        }
    }

    if use_phrase_search {
        // Wrap single query in quotes for phrase matching
        format!("\"{}\"", query)
    } else {
        // Use simple contains search
        query.to_string()
    }
}

/// Validate FTS5 query to prevent injection
fn validate_fts_query(query: &str) -> String {
    // FTS5 supports: AND, OR, NOT, (), "", * (prefix)
    // Remove any invalid characters but preserve valid operators
    let mut result = String::new();
    let mut in_quotes = false;
    let mut prev_was_space = false;

    for c in query.chars() {
        match c {
            '"' => {
                in_quotes = !in_quotes;
                result.push(c);
                prev_was_space = false;
            }
            ' ' => {
                if !prev_was_space || in_quotes {
                    result.push(c);
                    prev_was_space = true;
                }
            }
            'a'..='z' | 'A'..='Z' | '0'..='9' | '*' | '(' | ')' | '-' => {
                result.push(c);
                prev_was_space = false;
            }
            _ => {
                // Skip invalid characters
                prev_was_space = false;
            }
        }
    }

    // Ensure quotes are balanced
    let quote_count = result.matches('"').count();
    if quote_count % 2 != 0 {
        // Remove unmatched quote at the end
        if result.ends_with('"') {
            result.pop();
        }
    }

    // Default to phrase search if result is empty
    if result.trim().is_empty() {
        format!("\"{}\"", query)
    } else {
        result.trim().to_string()
    }
}

/// Check if query has multiple words
fn is_multi_word(query: &str) -> bool {
    query.split_whitespace().count() > 1
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_fts_query_single_word() {
        let query = build_fts_query("hello", true, true);
        assert_eq!(query, "\"hello\"");
    }

    #[test]
    fn test_build_fts_query_multi_word_with_phrase() {
        let query = build_fts_query("hello world", true, true);
        // Multi-word without operators converts to AND when use_boolean_operators is true
        assert_eq!(query, "hello AND world");
    }

    #[test]
    fn test_build_fts_query_explicit_and() {
        let query = build_fts_query("hello AND world", true, true);
        assert_eq!(query, "hello AND world");
    }

    #[test]
    fn test_build_fts_query_explicit_quote() {
        let query = build_fts_query("\"exact phrase\"", true, true);
        assert_eq!(query, "\"exact phrase\"");
    }

    #[test]
    fn test_build_fts_query_without_phrase_search() {
        let query = build_fts_query("hello", false, true);
        assert_eq!(query, "hello");
    }

    #[test]
    fn test_validate_fts_query_removes_invalid_chars() {
        let query = validate_fts_query("hello@world#123");
        assert_eq!(query, "helloworld123");
    }

    #[test]
    fn test_validate_fts_query_preserves_operators() {
        let query = validate_fts_query("hello AND world OR test");
        assert_eq!(query, "hello AND world OR test");
    }

    #[test]
    fn test_validate_fts_query_preserves_quotes() {
        let query = validate_fts_query("\"hello world\"");
        assert_eq!(query, "\"hello world\"");
    }

    #[test]
    fn test_validate_fts_query_balances_quotes() {
        let query = validate_fts_query("\"hello world");
        // Should handle unbalanced quotes gracefully
        assert!(!query.is_empty());
    }

    #[test]
    fn test_is_multi_word() {
        assert!(!is_multi_word("hello"));
        assert!(is_multi_word("hello world"));
        assert!(is_multi_word("hello world test"));
    }

    #[test]
    fn test_highlight_match() {
        let result = highlight_match("hello world", "world");
        assert_eq!(result, "hello **world**");
    }

    #[test]
    fn test_create_snippet() {
        let text = "The quick brown fox jumps over the lazy dog";
        let snippet = create_snippet(text, "fox");
        assert!(snippet.contains("**fox**"));
    }
}
