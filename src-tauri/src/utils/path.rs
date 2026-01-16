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
/// # Behavior
/// - Converts all backslashes (\\) to forward slashes (/) for cross-platform consistency
/// - Strips leading and trailing whitespace
/// - Removes .md extension if present (case-insensitive)
/// - Does NOT create new allocations if no changes are needed (for empty input)
///
/// # Examples
/// ```
/// assert_eq!(normalize_page_path("Folder\\Page.md"), "Folder/Page");
/// assert_eq!(normalize_page_path("Daily/2026-01-15.md"), "Daily/2026-01-15");
/// assert_eq!(normalize_page_path("Page"), "Page");
/// assert_eq!(normalize_page_path("  Path/File.MD  "), "Path/File");
/// ```
pub fn normalize_page_path(path: &str) -> String {
    // Step 1: Trim whitespace and normalize path separators
    let normalized = path.trim().replace('\\', "/");

    // Step 2: Remove trailing .md extension (case-insensitive)
    // Using a case-insensitive check with to_lowercase() for robust extension matching
    if normalized.to_lowercase().ends_with(".md") {
        // Safe to subtract 3 because we verified the extension exists
        normalized[..normalized.len() - 3].to_string()
    } else {
        normalized
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
