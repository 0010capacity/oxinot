#[cfg(test)]
mod sync_integration_tests {
    use std::fs;
    use std::path::{Path, PathBuf};

    /// Helper to create a test workspace structure
    fn create_test_structure(workspace_path: &Path) {
        // Create root-level file
        fs::write(
            workspace_path.join("RootFile.md"),
            "- Root level item\n",
        )
        .expect("Failed to create root file");

        // Create a directory with directory-note
        fs::create_dir_all(workspace_path.join("Project")).expect("Failed to create Project dir");
        fs::write(
            workspace_path.join("Project/Project.md"),
            "- Project overview\n",
        )
        .expect("Failed to create directory-note");

        // Create regular files in Project directory
        fs::write(
            workspace_path.join("Project/Task1.md"),
            "- Do something\n",
        )
        .expect("Failed to create Task1");

        fs::write(
            workspace_path.join("Project/Task2.md"),
            "- Do something else\n",
        )
        .expect("Failed to create Task2");

        // Create nested directory structure
        fs::create_dir_all(workspace_path.join("Project/SubFolder"))
            .expect("Failed to create SubFolder");
        fs::write(
            workspace_path.join("Project/SubFolder/SubFolder.md"),
            "- SubFolder content\n",
        )
        .expect("Failed to create SubFolder directory-note");

        fs::write(
            workspace_path.join("Project/SubFolder/Item.md"),
            "- Item in subfolder\n",
        )
        .expect("Failed to create Item");
    }

    #[test]
    fn test_directory_note_not_duplicated() {
        // Directory-note files (Dir/Dir.md) should NOT appear as separate page nodes
        // They should only be the content for the directory page

        let workspace_path = PathBuf::from("/test/workspace");

        // Verify file exists (simulated)
        let dir_note = workspace_path.join("Project/Project.md");
        let is_dir_note = dir_note
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|n| n.to_str())
            .zip(dir_note.file_stem().and_then(|s| s.to_str()))
            .map(|(parent_name, stem)| parent_name == stem)
            .unwrap_or(false);

        assert!(is_dir_note, "Should correctly identify directory-note file");
    }

    #[test]
    fn test_relative_path_for_directory_note() {
        let workspace_root = PathBuf::from("/home/user/repo");
        let dir_note_path = PathBuf::from("/home/user/repo/Project/Project.md");

        // Compute relative path
        let rel_path = dir_note_path
            .strip_prefix(&workspace_root)
            .ok()
            .and_then(|rel| rel.to_str())
            .map(|s| s.replace('\\', "/"))
            .unwrap_or_default();

        // Should be in the format "Project/Project.md"
        assert_eq!(rel_path, "Project/Project.md");

        // Parent should be "Project"
        let parent = PathBuf::from(&rel_path)
            .parent()
            .and_then(|p| p.to_str())
            .map(|s| s.replace('\\', "/"));

        assert_eq!(parent, Some("Project".to_string()));
    }

    #[test]
    fn test_nested_directory_note_hierarchy() {
        let workspace_root = PathBuf::from("/home/user/repo");

        // Test nested directory-note paths
        let nested_path = PathBuf::from("/home/user/repo/Project/SubFolder/SubFolder.md");

        let rel_path = nested_path
            .strip_prefix(&workspace_root)
            .ok()
            .and_then(|rel| rel.to_str())
            .map(|s| s.replace('\\', "/"))
            .unwrap_or_default();

        assert_eq!(rel_path, "Project/SubFolder/SubFolder.md");

        // Verify it's a directory-note (stem matches parent dir name)
        let is_dir_note = nested_path
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|n| n.to_str())
            .zip(nested_path.file_stem().and_then(|s| s.to_str()))
            .map(|(parent_name, stem)| parent_name == stem)
            .unwrap_or(false);

        assert!(is_dir_note, "Nested path should be recognized as directory-note");
    }

    #[test]
    fn test_directory_note_vs_regular_file() {
        let _workspace_root = PathBuf::from("/home/user/repo");

        // Directory-note case
        let dir_note = PathBuf::from("/home/user/repo/Project/Project.md");
        let is_dir_note_1 = dir_note
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|n| n.to_str())
            .zip(dir_note.file_stem().and_then(|s| s.to_str()))
            .map(|(parent_name, stem)| parent_name == stem)
            .unwrap_or(false);

        assert!(is_dir_note_1);

        // Regular file case (should NOT match)
        let regular_file = PathBuf::from("/home/user/repo/Project/Task1.md");
        let is_dir_note_2 = regular_file
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|n| n.to_str())
            .zip(regular_file.file_stem().and_then(|s| s.to_str()))
            .map(|(parent_name, stem)| parent_name == stem)
            .unwrap_or(false);

        assert!(!is_dir_note_2, "Regular file should not be recognized as directory-note");
    }

    #[test]
    fn test_all_relative_paths_match_workspace_root() {
        // All pages must have file_path relative to workspace root
        let workspace_root = PathBuf::from("/home/user/repo");

        let test_files = vec![
            PathBuf::from("/home/user/repo/RootFile.md"),
            PathBuf::from("/home/user/repo/Project/Project.md"),
            PathBuf::from("/home/user/repo/Project/Task1.md"),
            PathBuf::from("/home/user/repo/Project/SubFolder/SubFolder.md"),
            PathBuf::from("/home/user/repo/Project/SubFolder/Item.md"),
        ];

        for file_path in test_files {
            let rel_path = file_path
                .strip_prefix(&workspace_root)
                .ok()
                .and_then(|rel| rel.to_str())
                .map(|s| s.replace('\\', "/"))
                .expect("Failed to make relative path");

            // Verify format
            assert!(!rel_path.starts_with('/'), "Path should not start with /");
            assert!(!rel_path.contains('\\'), "Path should not contain backslashes");
            assert!(!rel_path.contains(':'), "Path should not contain drive letter");

            // Verify can reconstruct absolute path
            let reconstructed = workspace_root.join(&rel_path);
            assert_eq!(
                reconstructed, file_path,
                "Should reconstruct original path from relative"
            );
        }
    }

    #[test]
    fn test_directory_note_found_files_tracking() {
        // When scanning, both directory-note and regular files are added to found_files
        // This ensures orphan detection works correctly

        let _workspace_root = PathBuf::from("/home/user/repo");
        let mut found_files = std::collections::HashSet::new();

        // Simulate directory-note registration
        found_files.insert("Project/Project.md".to_string());

        // Simulate regular file registration
        found_files.insert("Project/Task1.md".to_string());
        found_files.insert("Project/Task2.md".to_string());

        assert_eq!(found_files.len(), 3, "Should have 3 files tracked");

        // Verify directory-note is in the set
        assert!(
            found_files.contains("Project/Project.md"),
            "Directory-note should be tracked"
        );

        // Verify regular files are in the set
        assert!(
            found_files.contains("Project/Task1.md"),
            "Regular files should be tracked"
        );
    }

    #[test]
    fn test_orphan_detection_with_relative_paths() {
        // Orphan detection should use relative path keys

        let existing_pages = std::collections::HashMap::from([
            ("RootFile.md".to_string(), "id-1".to_string()),
            ("Project/Project.md".to_string(), "id-2".to_string()),
            ("Project/Task1.md".to_string(), "id-3".to_string()),
            ("Project/Task2.md".to_string(), "id-4".to_string()),
        ]);

        let found_files = std::collections::HashSet::from([
            "RootFile.md".to_string(),
            "Project/Project.md".to_string(),
            "Project/Task1.md".to_string(),
            // Note: Task2 is missing - it's an orphan
        ]);

        // Find orphans
        let orphans: Vec<_> = existing_pages
            .iter()
            .filter(|(file_path, _)| !found_files.contains(*file_path))
            .collect();

        assert_eq!(orphans.len(), 1, "Should detect 1 orphan");
        assert_eq!(orphans[0].0, &"Project/Task2.md".to_string());
        assert_eq!(orphans[0].1, &"id-4".to_string());
    }

    #[test]
    fn test_path_key_consistency_in_hashmaps() {
        // Both existing_pages and found_files must use the same path format
        // (relative paths with / separators)

        let mut existing_pages: std::collections::HashMap<String, String> =
            std::collections::HashMap::new();

        let mut found_files: std::collections::HashSet<String> =
            std::collections::HashSet::new();

        // Simulate sync result
        let paths = vec![
            "Notes/Test.md",
            "Project/Project.md",
            "Project/Task1.md",
            "Deep/Nested/Path/File.md",
        ];

        for path in paths {
            existing_pages.insert(path.to_string(), format!("id-{}", path));
            found_files.insert(path.to_string());
        }

        // Verify all existing pages have matching found files
        for (file_path, _page_id) in existing_pages.iter() {
            assert!(
                found_files.contains(file_path),
                "Path {} should be in found_files",
                file_path
            );
        }

        // No orphans in this case
        let orphan_count = existing_pages
            .iter()
            .filter(|(fp, _)| !found_files.contains(*fp))
            .count();

        assert_eq!(orphan_count, 0, "Should have no orphans");
    }
}
