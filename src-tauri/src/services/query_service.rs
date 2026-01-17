use crate::models::query::*;
use regex::Regex;
use std::collections::HashMap;

/// Parse a query macro string (the content inside {{ }})
pub fn parse_query_macro(input: &str) -> Result<QueryMacro, QueryError> {
    let trimmed = input.trim();

    // Extract macro type (QUERY is the only one for now)
    let macro_type = extract_macro_type(trimmed)?;

    // Parse the query filter
    let query_filter = parse_query_filter(trimmed)?;

    Ok(QueryMacro {
        macro_type,
        query_filter,
    })
}

/// Extract the macro type (currently only QUERY)
fn extract_macro_type(input: &str) -> Result<MacroType, QueryError> {
    let upper = input.to_uppercase();
    if upper.starts_with("QUERY:") {
        Ok(MacroType::Query)
    } else {
        Err(QueryError::new("Macro must start with QUERY:"))
    }
}

/// Parse all clauses from the query string
fn parse_query_filter(input: &str) -> Result<QueryFilter, QueryError> {
    let upper = input.to_uppercase();

    // Remove "QUERY:" prefix
    let query_part = if upper.starts_with("QUERY:") {
        &input[6..].trim()
    } else {
        input
    };

    let from = parse_from_clause(query_part)?;
    let like = parse_like_clause(query_part);
    let depth = parse_depth_clause(query_part)?;
    let limit = parse_limit_clause(query_part)?;
    let sort = parse_sort_clause(query_part)?;

    Ok(QueryFilter {
        from,
        like,
        depth,
        limit,
        sort,
    })
}

/// Parse FROM clause: FROM [path1] [path2] ...
fn parse_from_clause(input: &str) -> Result<FromClause, QueryError> {
    let re = Regex::new(r"(?i)FROM\s+(\[.*?\](?:\s+\[.*?\])*)")
        .map_err(|_| QueryError::new("Regex error"))?;

    if let Some(captures) = re.captures(input) {
        let paths_str = &captures[1];
        let paths = extract_bracketed_paths(paths_str)?;

        if paths.is_empty() {
            return Err(QueryError::new("FROM clause requires at least one path"));
        }

        Ok(FromClause { paths })
    } else {
        Err(QueryError::new("FROM clause is required"))
    }
}

/// Extract paths from bracketed format: [path1] [path2]
fn extract_bracketed_paths(input: &str) -> Result<Vec<String>, QueryError> {
    let re = Regex::new(r"\[([^\]]+)\]").map_err(|_| QueryError::new("Regex error"))?;

    let paths: Vec<String> = re
        .captures_iter(input)
        .map(|cap| cap[1].to_string())
        .collect();

    if paths.is_empty() {
        return Err(QueryError::new("No paths found in FROM clause"));
    }

    Ok(paths)
}

/// Parse LIKE clause: LIKE "text"
fn parse_like_clause(input: &str) -> Option<String> {
    let re = Regex::new(r#"(?i)LIKE\s+"([^"]*)""#).ok()?;
    re.captures(input).map(|cap| cap[1].to_string())
}

/// Parse DEPTH clause: DEPTH 0 or DEPTH 1..10
fn parse_depth_clause(input: &str) -> Result<Option<DepthRange>, QueryError> {
    let re = Regex::new(r"(?i)DEPTH\s+(\d+)(?:\.\.(\d+))?")
        .map_err(|_| QueryError::new("Regex error"))?;

    if let Some(captures) = re.captures(input) {
        let min = captures
            .get(1)
            .and_then(|m| m.as_str().parse::<u32>().ok())
            .ok_or_else(|| QueryError::new("Invalid DEPTH min value"))?;

        let max = if let Some(max_match) = captures.get(2) {
            max_match
                .as_str()
                .parse::<u32>()
                .map_err(|_| QueryError::new("Invalid DEPTH max value"))?
        } else {
            min
        };

        if min > max {
            return Err(QueryError::new(
                "DEPTH min must be less than or equal to max",
            ));
        }

        Ok(Some(DepthRange { min, max }))
    } else {
        Ok(None)
    }
}

/// Parse LIMIT clause: LIMIT 10
fn parse_limit_clause(input: &str) -> Result<Option<u32>, QueryError> {
    let re = Regex::new(r"(?i)LIMIT\s+(\d+)").map_err(|_| QueryError::new("Regex error"))?;

    if let Some(captures) = re.captures(input) {
        let limit = captures
            .get(1)
            .and_then(|m| m.as_str().parse::<u32>().ok())
            .ok_or_else(|| QueryError::new("Invalid LIMIT value"))?;

        Ok(Some(limit))
    } else {
        Ok(None)
    }
}

/// Parse SORT clause: SORT RANDOM|ABC|CBA|123|321
fn parse_sort_clause(input: &str) -> Result<Option<SortType>, QueryError> {
    let re = Regex::new(r"(?i)SORT\s+(\w+)").map_err(|_| QueryError::new("Regex error"))?;

    if let Some(captures) = re.captures(input) {
        let sort_str = &captures[1];
        let sort_type = SortType::from_str(sort_str)
            .ok_or_else(|| QueryError::new(format!("Invalid SORT type: {}", sort_str)))?;
        Ok(Some(sort_type))
    } else {
        Ok(None)
    }
}

/// Check if a page path matches a pattern (supports * wildcard)
pub fn matches_path_pattern(pattern: &str, path: &str) -> bool {
    if pattern == "*" {
        return true;
    }

    if !pattern.contains('*') {
        return pattern == path;
    }

    // Convert glob pattern to regex
    let regex_pattern = pattern.replace(".", r"\.").replace("*", ".*");

    if let Ok(re) = Regex::new(&format!("^{}$", regex_pattern)) {
        re.is_match(path)
    } else {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_query() {
        let input = r#"QUERY: FROM [page/test] LIKE "content" DEPTH 1..3 LIMIT 10 SORT RANDOM"#;
        let result = parse_query_macro(input);
        assert!(result.is_ok());

        let macro_obj = result.unwrap();
        assert_eq!(macro_obj.macro_type, MacroType::Query);
        assert_eq!(
            macro_obj.query_filter.from.paths,
            vec!["page/test".to_string()]
        );
        assert_eq!(macro_obj.query_filter.like, Some("content".to_string()));
        assert!(macro_obj.query_filter.depth.is_some());
        assert_eq!(macro_obj.query_filter.limit, Some(10));
        assert_eq!(macro_obj.query_filter.sort, Some(SortType::Random));
    }

    #[test]
    fn test_parse_case_insensitive() {
        let input = r#"query: FROM [test] like "hello" depth 2 limit 5 sort abc"#;
        let result = parse_query_macro(input);
        assert!(result.is_ok());

        let macro_obj = result.unwrap();
        assert_eq!(macro_obj.query_filter.like, Some("hello".to_string()));
        assert_eq!(macro_obj.query_filter.sort, Some(SortType::Abc));
    }

    #[test]
    fn test_parse_multiple_paths() {
        let input = r#"QUERY: FROM [notes/project1] [notes/project2] [docs/*] LIKE "todo""#;
        let result = parse_query_macro(input);
        assert!(result.is_ok());

        let macro_obj = result.unwrap();
        assert_eq!(macro_obj.query_filter.from.paths.len(), 3);
        assert!(macro_obj
            .query_filter
            .from
            .paths
            .contains(&"notes/project1".to_string()));
        assert!(macro_obj
            .query_filter
            .from
            .paths
            .contains(&"docs/*".to_string()));
    }

    #[test]
    fn test_parse_depth_single() {
        let input = r#"QUERY: FROM [test] DEPTH 2"#;
        let result = parse_query_macro(input);
        assert!(result.is_ok());

        let macro_obj = result.unwrap();
        let depth = macro_obj.query_filter.depth.unwrap();
        assert_eq!(depth.min, 2);
        assert_eq!(depth.max, 2);
    }

    #[test]
    fn test_parse_depth_range() {
        let input = r#"QUERY: FROM [test] DEPTH 1..5"#;
        let result = parse_query_macro(input);
        assert!(result.is_ok());

        let macro_obj = result.unwrap();
        let depth = macro_obj.query_filter.depth.unwrap();
        assert_eq!(depth.min, 1);
        assert_eq!(depth.max, 5);
    }

    #[test]
    fn test_matches_path_pattern() {
        assert!(matches_path_pattern("*", "any/path"));
        assert!(matches_path_pattern("notes", "notes"));
        assert!(matches_path_pattern("notes/*", "notes/file"));
        assert!(matches_path_pattern("notes/*", "notes/deep/file"));
        assert!(!matches_path_pattern("notes", "other"));
        assert!(!matches_path_pattern("notes/*", "other/file"));
    }

    #[test]
    fn test_missing_from_clause() {
        let input = r#"QUERY: LIKE "test""#;
        let result = parse_query_macro(input);
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_macro_type() {
        let input = r#"INVALID: FROM [test]"#;
        let result = parse_query_macro(input);
        assert!(result.is_err());
    }
}
