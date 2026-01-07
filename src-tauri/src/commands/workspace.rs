use crate::models::block::BlockType;
use crate::services::markdown_to_blocks;
use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct MigrationResult {
    pub pages: usize,
    pub blocks: usize,
}

/// Initialize database for a workspace
#[tauri::command]
pub async fn init_workspace_db(
    db: tauri::State<'_, Arc<std::sync::Mutex<rusqlite::Connection>>>,
) -> Result<bool, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    // Initialize database schema if not already done
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS workspace (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS pages (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            file_path TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS blocks (
            id TEXT PRIMARY KEY,
            page_id TEXT NOT NULL,
            parent_id TEXT,
            content TEXT NOT NULL,
            order_weight REAL NOT NULL,
            is_collapsed INTEGER NOT NULL DEFAULT 0,
            block_type TEXT NOT NULL DEFAULT 'bullet',
            language TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
            FOREIGN KEY (parent_id) REFERENCES blocks(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_blocks_page_id ON blocks(page_id);
        CREATE INDEX IF NOT EXISTS idx_blocks_parent_id ON blocks(parent_id);
        CREATE INDEX IF NOT EXISTS idx_blocks_order ON blocks(page_id, parent_id, order_weight);

        CREATE TABLE IF NOT EXISTS block_refs (
            id TEXT PRIMARY KEY,
            block_id TEXT NOT NULL,
            ref_block_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE,
            FOREIGN KEY (ref_block_id) REFERENCES blocks(id) ON DELETE CASCADE
        );",
    )
    .map_err(|e| e.to_string())?;

    Ok(true)
}

/// Migrate markdown files from workspace to SQLite database
#[tauri::command]
pub async fn migrate_workspace(
    db: tauri::State<'_, Arc<std::sync::Mutex<rusqlite::Connection>>>,
    workspace_path: String,
) -> Result<MigrationResult, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut migrated_pages = 0;
    let mut migrated_blocks = 0;

    // Find all .md files
    let md_files: Vec<_> = std::fs::read_dir(&workspace_path)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .and_then(|s| s.to_str())
                .map(|s| s == "md")
                .unwrap_or(false)
        })
        .collect();

    for entry in md_files {
        let path = entry.path();
        let file_name = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled");

        let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;

        // Create page
        let page_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO pages (id, title, file_path, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)",
            params![
                &page_id,
                file_name,
                path.to_string_lossy().to_string(),
                &now,
                &now
            ],
        )
        .map_err(|e| e.to_string())?;

        // Parse and create blocks
        let blocks = markdown_to_blocks(&content, &page_id);

        for block in &blocks {
            conn.execute(
                "INSERT INTO blocks (id, page_id, parent_id, content, order_weight,
                                    block_type, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                params![
                    &block.id,
                    &block.page_id,
                    &block.parent_id,
                    &block.content,
                    block.order_weight,
                    block_type_to_string(&block.block_type),
                    &block.created_at,
                    &block.updated_at
                ],
            )
            .map_err(|e| e.to_string())?;
        }

        migrated_pages += 1;
        migrated_blocks += blocks.len();
    }

    Ok(MigrationResult {
        pages: migrated_pages,
        blocks: migrated_blocks,
    })
}

fn block_type_to_string(bt: &BlockType) -> String {
    match bt {
        BlockType::Bullet => "bullet".to_string(),
        BlockType::Code => "code".to_string(),
        BlockType::Fence => "fence".to_string(),
    }
}
