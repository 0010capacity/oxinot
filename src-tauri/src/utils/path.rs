//! Path normalization and security validation utilities for consistent handling of file paths across the codebase.
//!
//! Ensures all page paths are normalized to:
//! - Forward slashes (/) instead of backslashes (\)
//! - No .md extension
//! - Workspace-relative (not absolute)
//!
//! Security features:
//! - Path traversal prevention (blocking ../ sequences)
//! - Workspace containment validation
//! - Filename sanitization

use std::path::PathBuf;

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

/// Validates that a path does not contain path traversal sequences.
///
/// Blocks attempts to escape directories using `..` components.
/// Absolute paths ARE allowed.
///
/// # Arguments
/// * `path` - The path string to validate
/// * `param_name` - Name of the parameter (for error messages)
///
/// # Returns
/// `Ok(())` if the path is safe, `Err(String)` with error message if validation fails.
///
/// # Examples
/// ```
/// assert!(validate_no_path_traversal("folder/file.md", "path").is_ok());
/// assert!(validate_no_path_traversal("/etc/passwd", "path").is_ok());
/// assert!(validate_no_path_traversal("../etc/passwd", "path").is_err());
/// ```
pub fn validate_no_path_traversal(path: &str, param_name: &str) -> Result<(), String> {
    if path.is_empty() {
        return Err(format!("{} must not be empty", param_name));
    }

    // Check for explicit .. components
    if path.contains("..") {
        return Err(format!(
            "{} contains invalid path traversal sequence (..)",
            param_name
        ));
    }

    Ok(())
}

/// Validates that a path is contained within a workspace directory.
///
/// Ensures the resolved absolute path stays within the workspace boundaries
/// using canonicalization to prevent symlink and path traversal attacks.
///
/// # Arguments
/// * `workspace_path` - The workspace root directory (must exist)
/// * `target_path` - The path to validate (can be relative to workspace)
///
/// # Returns
/// `Ok(())` if the path is contained within workspace, `Err(String)` otherwise.
///
/// # Security
/// This function uses `canonicalize()` to resolve all symlinks and `..` sequences,
/// providing defense against:
/// - Path traversal attacks using `..` sequences
/// - Symlink-based escape attempts
/// - Relative path manipulation
pub fn validate_workspace_containment(
    workspace_path: &str,
    target_path: &str,
) -> Result<(), String> {
    // Reject absolute paths immediately
    if target_path.starts_with('/')
        || target_path.starts_with('\\')
        || PathBuf::from(target_path).is_absolute()
    {
        return Err("Target path must be relative to workspace, not absolute".to_string());
    }

    let workspace = PathBuf::from(workspace_path)
        .canonicalize()
        .map_err(|e| format!("Workspace path does not exist or cannot be accessed: {}", e))?;

    // For target path, first try to resolve it relative to the workspace
    let full_target_path = workspace.join(target_path);

    // Canonicalize the full path to resolve symlinks and .. sequences
    let target = full_target_path
        .canonicalize()
        .map_err(|e| format!("Target path does not exist or cannot be accessed: {}", e))?;

    // Verify the canonicalized target is within the workspace
    if !target.starts_with(&workspace) {
        return Err("Resolved path is outside workspace boundaries".to_string());
    }

    Ok(())
}

/// Validates a filename for illegal characters and path separators.
///
/// Prevents directory traversal and OS-specific illegal characters.
///
/// # Arguments
/// * `filename` - The filename to validate
///
/// # Returns
/// `Ok(())` if filename is valid, `Err(String)` with error message if validation fails.
///
/// # Examples
/// ```
/// assert!(validate_filename("document.md").is_ok());
/// assert!(validate_filename("../secret.md").is_err());
/// assert!(validate_filename("file/name.md").is_err());
/// ```
pub fn validate_filename(filename: &str) -> Result<(), String> {
    if filename.is_empty() {
        return Err("Filename must not be empty".to_string());
    }

    // Check for path separators
    if filename.contains('/') || filename.contains('\\') {
        return Err("Filename must not contain path separators".to_string());
    }

    // Check for illegal characters (common across Windows, macOS, Linux)
    // < > : " | ? * and control characters (0x00-0x1F)
    for ch in filename.chars() {
        if matches!(ch, '<' | '>' | ':' | '"' | '|' | '?' | '*') || ch.is_ascii_control() {
            return Err(format!("Filename contains illegal character: '{}'", ch));
        }
    }

    // Check for reserved names on Windows
    let name_upper = filename.to_uppercase();
    let reserved = [
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
        "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ];

    for reserved_name in &reserved {
        if name_upper == *reserved_name || name_upper.starts_with(&format!("{}.", reserved_name)) {
            return Err(format!("Filename uses reserved name: {}", reserved_name));
        }
    }

    Ok(())
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

    #[test]
    fn test_validate_no_path_traversal_valid() {
        assert!(validate_no_path_traversal("folder/file.md", "path").is_ok());
        assert!(validate_no_path_traversal("a/b/c/file.md", "path").is_ok());
    }

    #[test]
    fn test_validate_no_path_traversal_invalid() {
        assert!(validate_no_path_traversal("../etc/passwd", "path").is_err());
        assert!(validate_no_path_traversal("folder/../../../etc/passwd", "path").is_err());
        assert!(validate_no_path_traversal("..", "path").is_err());
    }

    #[test]
    fn test_validate_no_path_traversal_empty() {
        assert!(validate_no_path_traversal("", "path").is_err());
    }

    #[test]
    fn test_validate_filename_valid() {
        assert!(validate_filename("document.md").is_ok());
        assert!(validate_filename("My File.txt").is_ok());
        assert!(validate_filename("file-name_123.md").is_ok());
    }

    #[test]
    fn test_validate_filename_invalid_separators() {
        assert!(validate_filename("folder/file.md").is_err());
        assert!(validate_filename("folder\\file.md").is_err());
        assert!(validate_filename("../file.md").is_err());
    }

    #[test]
    fn test_validate_filename_invalid_characters() {
        assert!(validate_filename("file<name>.md").is_err());
        assert!(validate_filename("file:name.md").is_err());
        assert!(validate_filename("file|name.md").is_err());
        assert!(validate_filename("file?name.md").is_err());
        assert!(validate_filename("file*name.md").is_err());
    }

    #[test]
    fn test_validate_filename_reserved_names() {
        assert!(validate_filename("CON").is_err());
        assert!(validate_filename("con.txt").is_err());
        assert!(validate_filename("PRN.md").is_err());
        assert!(validate_filename("AUX").is_err());
    }

    #[test]
    fn test_validate_filename_empty() {
        assert!(validate_filename("").is_err());
    }

    #[test]
    fn test_validate_no_path_traversal_absolute_valid() {
        assert!(validate_no_path_traversal("/etc/passwd", "path").is_ok());
        assert!(validate_no_path_traversal("/home/user/file.md", "path").is_ok());
    }

    #[test]
    fn test_validate_no_path_traversal_absolute_windows_valid() {
        // Simple string checks since we can't reliably test pathbuf behavior cross-platform for valid abs paths
        // but the function logic only checks for ".." now.
        assert!(validate_no_path_traversal("\\etc\\passwd", "path").is_ok());
        assert!(validate_no_path_traversal("C:\\Users\\file.md", "path").is_ok());
    }

    #[test]
    fn test_validate_no_path_traversal_relative_valid() {
        assert!(validate_no_path_traversal("folder/file.md", "path").is_ok());
        assert!(validate_no_path_traversal("a/b/c/file.md", "path").is_ok());
        assert!(validate_no_path_traversal("file.md", "path").is_ok());
    }
}
