use oxinot_lib::commands::{block, page, wiki_link, workspace};
use oxinot_lib::models::block::CreateBlockRequest;
use rusqlite::params;
use std::fs;
use uuid::Uuid;
use chrono::Utc;

#[test]
fn test_wiki_link_integration() {
    tauri::async_runtime::block_on(async {
        // Setup temp workspace
        let temp_dir = std::env::temp_dir().join(format!("oxinot_test_wiki_{}", Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).unwrap();
        let path_str = temp_dir.to_string_lossy().to_string();

        // Init workspace
        workspace::initialize_workspace(path_str.clone()).await.unwrap();
        let conn = workspace::open_workspace_db(&path_str).unwrap();

        // Create Page A
        let page_a_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO pages (id, title, file_path, is_directory, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)",
            params![page_a_id, "Page A", "Page A.md", Utc::now().to_rfc3339(), Utc::now().to_rfc3339()]
        ).unwrap();
        conn.execute(
            "INSERT INTO page_paths (page_id, path_text, updated_at) VALUES (?, ?, ?)",
            params![page_a_id, "Page A", Utc::now().to_rfc3339()]
        ).unwrap();
        fs::write(temp_dir.join("Page A.md"), "").unwrap();

        // Create Page B
        let page_b_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO pages (id, title, file_path, is_directory, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)",
            params![page_b_id, "Page B", "Page B.md", Utc::now().to_rfc3339(), Utc::now().to_rfc3339()]
        ).unwrap();
        conn.execute(
            "INSERT INTO page_paths (page_id, path_text, updated_at) VALUES (?, ?, ?)",
            params![page_b_id, "Page B", Utc::now().to_rfc3339()]
        ).unwrap();
        fs::write(temp_dir.join("Page B.md"), "").unwrap();

        // Create block in Page A linking to Page B
        let req = CreateBlockRequest {
            page_id: page_a_id.clone(),
            parent_id: None,
            content: Some("Link to [[Page B]]".to_string()),
            block_type: None,
            after_block_id: None,
        };
        block::create_block(path_str.clone(), req).await.unwrap();

        // Verify backlinks for Page B
        let backlinks = wiki_link::get_page_backlinks(path_str.clone(), page_b_id.clone()).await.unwrap();
        assert_eq!(backlinks.len(), 1);
        assert_eq!(backlinks[0].page_title, "Page A");
        assert_eq!(backlinks[0].blocks.len(), 1);
        assert!(backlinks[0].blocks[0].content.contains("Link to [[Page B]]"));

        // Create broken link in Page B
        let req_broken = CreateBlockRequest {
            page_id: page_b_id.clone(),
            parent_id: None,
            content: Some("Link to [[NonExistent]]".to_string()),
            block_type: None,
            after_block_id: None,
        };
        block::create_block(path_str.clone(), req_broken).await.unwrap();

        // Verify broken links
        let broken_links = wiki_link::get_broken_links(path_str.clone()).await.unwrap();
        assert_eq!(broken_links.len(), 1);
        assert_eq!(broken_links[0].target_path, "NonExistent");

        // Teardown
        fs::remove_dir_all(&temp_dir).unwrap();
    });
}
