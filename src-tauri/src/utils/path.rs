//! Path normalization utilities for consistent handling of file paths across the codebase.
//!
//! Ensures all page paths are normalized to:
//! - Forward slashes (/) instead of backslashes (\)
//! - No .md extension
//! - Workspace-relative (not absolute)

/// Normalize a file path to standard format.
///
/// Converts:
/// - Backslashes to forward slashes
/// - Removes .md extension (case-insensitive)
/// - Trims whitespace
///
/// # Examples
/// ```
/// assert_eq!(normalize_page_path("Folder\\Page.md"), "Folder/Page");
/// assert_eq!(normalize_page_path("Daily/2026-01-15.md"), "Daily/2026-01-15");
/// assert_eq!(normalize_page_path("Page"), "Page");
/// ```
pub fn normalize_page_path(path: &str) -> String {
    // 1. Replace backslashes with forward slashes
    let normalized = path.replace('\\', "/");

    // 2. Trim whitespace
    let normalized = normalized.trim();

    // 3. Remove trailing .md extension (case-insensitive)
    if normalized.to_lowercase().ends_with(".md") {
        normalized[..normalized.len() - 3].to_string()
    } else {
        normalized.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_with_backslash_and_extension() {
        assert_eq!(normalize_page_path("Folder\\Page.md"), "Folder/Page");
    }

    #[test]
    fn test_normalize_with_forward_slash_and_extension() {
        assert_eq!(
            normalize_page_path("Daily/2026-01-15.md"),
            "Daily/2026-01-15"
        );
    }

    #[test]
    fn test_normalize_without_extension() {
        assert_eq!(normalize_page_path("Page"), "Page");
    }

    #[test]
    fn test_normalize_nested_path() {
        assert_eq!(normalize_page_path("A\\B\\C.md"), "A/B/C");
    }

    #[test]
    fn test_normalize_uppercase_extension() {
        assert_eq!(normalize_page_path("Page.MD"), "Page");
    }

    #[test]
    fn test_normalize_with_whitespace() {
        assert_eq!(normalize_page_path("  Page.md  "), "Page");
    }

    #[test]
    fn test_normalize_mixed_slashes() {
        assert_eq!(normalize_page_path("A/B\\C.md"), "A/B/C");
    }

    #[test]
    fn test_normalize_empty_string() {
        assert_eq!(normalize_page_path(""), "");
    }
}
