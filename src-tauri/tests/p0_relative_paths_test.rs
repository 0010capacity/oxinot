#[cfg(test)]
mod p0_relative_paths_tests {
    use std::path::PathBuf;

    // Helper to compute relative path (mirrors the production code)
    fn compute_rel_path(abs_path: &std::path::Path, workspace_root: &std::path::Path) -> Result<String, String> {
        abs_path
            .strip_prefix(workspace_root)
            .map_err(|_| format!("Path {:?} is not under workspace root {:?}", abs_path, workspace_root))
            .and_then(|rel| {
                rel.to_str()
                    .map(|s| {
                        // Convert backslashes to forward slashes for cross-platform consistency
                        s.replace('\\', "/")
                    })
                    .ok_or_else(|| "Path contains invalid UTF-8".to_string())
            })
    }

    #[test]
    fn test_relative_path_format() {
        let workspace_path = PathBuf::from("/home/user/repo");
        let file_path = PathBuf::from("/home/user/repo/Notes/Test.md");

        let rel_path = compute_rel_path(&file_path, &workspace_path).expect("Failed to compute relative path");

        assert_eq!(rel_path, "Notes/Test.md", "Relative path should use forward slashes");
    }

    #[test]
    fn test_no_absolute_paths_in_format() {
        let workspace_path = PathBuf::from("/home/user/repo");
        let file_path = PathBuf::from("/home/user/repo/Notes/Test.md");

        let rel_path = compute_rel_path(&file_path, &workspace_path).expect("Failed to compute relative path");

        // Should not start with / or contain drive letters (Windows)
        assert!(!rel_path.starts_with('/'), "Relative path should not start with /");
        assert!(!rel_path.contains(':'), "Relative path should not contain drive letter");
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn test_windows_style_path_conversion() {
        // Test that backslashes are converted to forward slashes on Windows
        let workspace_path = PathBuf::from("C:\\Users\\user\\repo");
        let file_path = PathBuf::from("C:\\Users\\user\\repo\\Notes\\Test.md");

        let rel_path = compute_rel_path(&file_path, &workspace_path).expect("Failed to compute relative path");

        // All paths should use forward slashes regardless of OS
        assert!(!rel_path.contains('\\'), "Path separators should be normalized to /");
        assert_eq!(rel_path, "Notes/Test.md");
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn test_windows_path_with_backslash_normalization() {
        // Additional test for Windows-specific backslash normalization
        let workspace_path = PathBuf::from("C:\\workspace");
        let file_path = PathBuf::from("C:\\workspace\\dir\\subdir\\file.md");

        let rel_path = compute_rel_path(&file_path, &workspace_path).expect("Failed to compute relative path");

        // Backslashes should be converted to forward slashes
        assert_eq!(rel_path, "dir/subdir/file.md");
        assert!(!rel_path.contains('\\'), "Should not contain backslashes");
    }

    #[test]
    fn test_nested_directory_path() {
        let workspace_path = PathBuf::from("/home/user/repo");
        let nested_path = PathBuf::from("/home/user/repo/Dir1/Dir2/Dir3/Document.md");

        let rel_path = compute_rel_path(&nested_path, &workspace_path).expect("Failed to compute relative path");

        assert_eq!(rel_path, "Dir1/Dir2/Dir3/Document.md");
    }

    #[test]
    fn test_root_level_file_path() {
        let workspace_path = PathBuf::from("/home/user/repo");
        let root_file = PathBuf::from("/home/user/repo/RootFile.md");

        let rel_path = compute_rel_path(&root_file, &workspace_path).expect("Failed to compute relative path");

        assert_eq!(rel_path, "RootFile.md");
        assert!(!rel_path.contains('/'), "Root-level file should have no path separators");
    }

    #[test]
    fn test_directory_note_path() {
        // Directory note follows pattern: DirName/DirName.md
        let workspace_path = PathBuf::from("/home/user/repo");
        let dir_note_path = PathBuf::from("/home/user/repo/Project/Project.md");

        let rel_path = compute_rel_path(&dir_note_path, &workspace_path).expect("Failed to compute relative path");

        assert_eq!(rel_path, "Project/Project.md");
    }

    #[test]
    fn test_path_outside_workspace_fails() {
        let workspace_path = PathBuf::from("/home/user/repo");
        let external_path = PathBuf::from("/home/other/file.md");

        let result = compute_rel_path(&external_path, &workspace_path);

        assert!(result.is_err(), "Should fail for paths outside workspace");
    }

    #[test]
    fn test_unicode_path_handling() {
        let workspace_path = PathBuf::from("/home/user/repo");
        let unicode_path = PathBuf::from("/home/user/repo/日本語/ファイル.md");

        let rel_path = compute_rel_path(&unicode_path, &workspace_path).expect("Failed to compute relative path");

        assert_eq!(rel_path, "日本語/ファイル.md");
    }
}
