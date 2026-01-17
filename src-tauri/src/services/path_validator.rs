use std::path::{Path, PathBuf};

/// Path validator for filesystem sandboxing
/// Ensures all file operations stay within the workspace directory
pub struct PathValidator {
    workspace_root: PathBuf,
}

impl PathValidator {
    /// Create a new path validator
    pub fn new(workspace_root: impl Into<PathBuf>) -> Self {
        Self {
            workspace_root: workspace_root.into(),
        }
    }

    /// Validate that an absolute path is within the workspace
    ///
    /// # Arguments
    /// * `abs_path` - Absolute path to validate
    ///
    /// # Returns
    /// Ok(()) if path is within workspace, Err with message if outside
    pub fn validate_absolute_path(&self, abs_path: &Path) -> Result<(), String> {
        // Canonicalize both paths to resolve symlinks and relative components
        let canonical_root = self
            .workspace_root
            .canonicalize()
            .map_err(|e| format!("Failed to canonicalize workspace root: {}", e))?;

        let canonical_path = abs_path
            .canonicalize()
            .map_err(|e| format!("Failed to canonicalize path: {}", e))?;

        // Check if the canonical path is under the canonical root
        if !canonical_path.starts_with(&canonical_root) {
            return Err(format!(
                "Path {:?} is outside workspace root {:?}",
                canonical_path, canonical_root
            ));
        }

        Ok(())
    }

    /// Validate that a relative path is safe and construct absolute path
    ///
    /// # Arguments
    /// * `rel_path` - Relative path (with forward slashes)
    ///
    /// # Returns
    /// Ok(absolute_path) if valid, Err with message if invalid
    pub fn validate_relative_path(&self, rel_path: &str) -> Result<PathBuf, String> {
        // Check for path traversal attempts
        if rel_path.contains("..") {
            return Err("Path traversal (..) not allowed".to_string());
        }

        if rel_path.starts_with('/') {
            return Err("Absolute paths not allowed, use relative paths".to_string());
        }

        if rel_path.is_empty() {
            return Err("Empty path not allowed".to_string());
        }

        // Check for null bytes
        if rel_path.contains('\0') {
            return Err("Null bytes in path not allowed".to_string());
        }

        // Convert forward slashes to platform-specific separators
        let path_buf = PathBuf::from(rel_path.replace('/', std::path::MAIN_SEPARATOR_STR));

        // Construct absolute path
        let abs_path = self.workspace_root.join(&path_buf);

        // Validate the resulting absolute path is within workspace
        self.validate_absolute_path(&abs_path)?;

        Ok(abs_path)
    }

    /// Get workspace-relative path from absolute path
    ///
    /// # Arguments
    /// * `abs_path` - Absolute path to convert
    ///
    /// # Returns
    /// Ok(relative_path) with forward slashes, Err if outside workspace
    pub fn to_relative_path(&self, abs_path: &Path) -> Result<String, String> {
        // Validate the path is within workspace first
        self.validate_absolute_path(abs_path)?;

        // Strip workspace prefix
        let rel_path = abs_path
            .strip_prefix(&self.workspace_root)
            .map_err(|_| "Failed to strip workspace prefix".to_string())?;

        // Convert to string with forward slashes
        rel_path
            .to_str()
            .ok_or_else(|| "Path contains invalid UTF-8".to_string())
            .map(|s| s.replace('\\', "/"))
    }

    /// Validate and normalize a path for database storage
    ///
    /// # Arguments
    /// * `path` - Relative path with forward slashes
    ///
    /// # Returns
    /// Ok(normalized_path) if valid, Err with message if invalid
    pub fn validate_db_path(&self, path: &str) -> Result<String, String> {
        // This validates and allows us to use it for database storage
        let abs_path = self.validate_relative_path(path)?;

        // Return the normalized relative path
        self.to_relative_path(&abs_path)
    }

    /// Get the workspace root path
    pub fn workspace_root(&self) -> &Path {
        &self.workspace_root
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_valid_relative_path() {
        let temp_dir = TempDir::new().unwrap();
        let validator = PathValidator::new(temp_dir.path());

        let result = validator.validate_relative_path("test.md");
        assert!(result.is_ok());
    }

    #[test]
    fn test_relative_path_with_subdirectories() {
        let temp_dir = TempDir::new().unwrap();
        let validator = PathValidator::new(temp_dir.path());

        let result = validator.validate_relative_path("subdir/test.md");
        assert!(result.is_ok());
    }

    #[test]
    fn test_path_traversal_blocked() {
        let temp_dir = TempDir::new().unwrap();
        let validator = PathValidator::new(temp_dir.path());

        let result = validator.validate_relative_path("../etc/passwd");
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .contains("Path traversal (..) not allowed"));
    }

    #[test]
    fn test_absolute_path_rejected() {
        let temp_dir = TempDir::new().unwrap();
        let validator = PathValidator::new(temp_dir.path());

        let result = validator.validate_relative_path("/etc/passwd");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Absolute paths not allowed"));
    }

    #[test]
    fn test_null_byte_rejected() {
        let temp_dir = TempDir::new().unwrap();
        let validator = PathValidator::new(temp_dir.path());

        let result = validator.validate_relative_path("test\0.md");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Null bytes"));
    }

    #[test]
    fn test_to_relative_path() {
        let temp_dir = TempDir::new().unwrap();
        let validator = PathValidator::new(temp_dir.path());

        let abs_path = temp_dir.path().join("test.md");
        let result = validator.to_relative_path(&abs_path);

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "test.md");
    }

    #[test]
    fn test_validate_absolute_path_outside_workspace() {
        let temp_dir = TempDir::new().unwrap();
        let validator = PathValidator::new(temp_dir.path());

        // Try to validate a path outside workspace
        let outside_path = PathBuf::from("/etc/passwd");
        let result = validator.validate_absolute_path(&outside_path);

        assert!(result.is_err());
    }
}
