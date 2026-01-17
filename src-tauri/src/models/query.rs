use serde::{Deserialize, Serialize};

/// Represents a single query macro: {{ QUERY: ... }}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryMacro {
    pub macro_type: MacroType,
    pub query_filter: QueryFilter,
}

/// Type of macro (currently only QUERY, but extensible for future types)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MacroType {
    Query,
}

/// Complete query filter with all clauses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryFilter {
    pub from: FromClause,
    pub like: Option<String>,
    pub depth: Option<DepthRange>,
    pub limit: Option<u32>,
    pub sort: Option<SortType>,
}

/// FROM clause - specifies which pages to search in
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FromClause {
    /// List of page paths, can include wildcards (*)
    pub paths: Vec<String>,
}

/// Depth range for filtering blocks by hierarchy level
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DepthRange {
    pub min: u32,
    pub max: u32,
}

/// Sorting options for query results
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SortType {
    /// Random order
    Random,
    /// Alphabetical ascending (A-Z)
    Abc,
    /// Alphabetical descending (Z-A)
    Cba,
    /// By creation date ascending (oldest first)
    Numeric123,
    /// By creation date descending (newest first)
    Numeric321,
}

impl SortType {
    /// Parse sort type from string (case-insensitive)
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_uppercase().as_str() {
            "RANDOM" => Some(SortType::Random),
            "ABC" => Some(SortType::Abc),
            "CBA" => Some(SortType::Cba),
            "123" => Some(SortType::Numeric123),
            "321" => Some(SortType::Numeric321),
            _ => None,
        }
    }
}

/// Error type for query parsing and execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryError {
    pub message: String,
}

impl QueryError {
    pub fn new(message: impl Into<String>) -> Self {
        QueryError {
            message: message.into(),
        }
    }
}

impl std::fmt::Display for QueryError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

/// Parsed query macro from {{...}} syntax
pub struct ParsedQueryMacro {
    pub raw_input: String,
    pub query_macro: QueryMacro,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sort_type_from_str_case_insensitive() {
        assert_eq!(SortType::from_str("random"), Some(SortType::Random));
        assert_eq!(SortType::from_str("RANDOM"), Some(SortType::Random));
        assert_eq!(SortType::from_str("Random"), Some(SortType::Random));
        assert_eq!(SortType::from_str("abc"), Some(SortType::Abc));
        assert_eq!(SortType::from_str("ABC"), Some(SortType::Abc));
        assert_eq!(SortType::from_str("123"), Some(SortType::Numeric123));
        assert_eq!(SortType::from_str("321"), Some(SortType::Numeric321));
        assert_eq!(SortType::from_str("invalid"), None);
    }

    #[test]
    fn test_depth_range() {
        let depth = DepthRange { min: 1, max: 3 };
        assert_eq!(depth.min, 1);
        assert_eq!(depth.max, 3);
    }
}
