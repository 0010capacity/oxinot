use crate::models::block::BlockType;
use crate::services::markdown_to_blocks;
use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
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

    // Store workspace path in database
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT OR REPLACE INTO workspace (id, path, created_at) VALUES ('default', ?, ?)",
        params![&workspace_path, &now],
    )
    .map_err(|e| e.to_string())?;

    // Recursively scan and migrate all markdown files
    let workspace_root = PathBuf::from(&workspace_path);
    let result = scan_and_migrate_directory(
        &conn,
        &workspace_root,
        &workspace_root,
        None,
        &mut migrated_pages,
        &mut migrated_blocks,
    )?;

    Ok(MigrationResult {
        pages: migrated_pages,
        blocks: migrated_blocks,
    })
}

/// Recursively scan directory and migrate markdown files
fn scan_and_migrate_directory(
    conn: &rusqlite::Connection,
    workspace_root: &Path,
    current_dir: &Path,
    parent_page_id: Option<&str>,
    migrated_pages: &mut usize,
    migrated_blocks: &mut usize,
) -> Result<(), String> {
    let entries =
        fs::read_dir(current_dir).map_err(|e| format!("Error reading directory: {}", e))?;

    let mut items: Vec<_> = entries.filter_map(|e| e.ok()).collect();
    items.sort_by(|a, b| {
        let a_name = a.file_name();
        let b_name = b.file_name();
        a_name.cmp(&b_name)
    });

    for entry in items {
        let path = entry.path();
        let metadata = entry
            .metadata()
            .map_err(|e| format!("Error reading metadata: {}", e))?;

        if metadata.is_file() {
            if let Some(ext) = path.extension() {
                if ext == "md" {
                    migrate_file(
                        conn,
                        workspace_root,
                        &path,
                        parent_page_id,
                        false,
                        migrated_pages,
                        migrated_blocks,
                    )?;
                }
            }
        } else if metadata.is_dir() {
            // Check if this directory has a corresponding .md file
            let dir_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            let folder_note_path = path.join(format!("{}.md", dir_name));

            let page_id = if folder_note_path.exists() {
                // This is a folder with a folder note
                let id = migrate_file(
                    conn,
                    workspace_root,
                    &folder_note_path,
                    parent_page_id,
                    true,
                    migrated_pages,
                    migrated_blocks,
                )?;
                Some(id)
            } else {
                None
            };

            // Recursively scan subdirectory
            scan_and_migrate_directory(
                conn,
                workspace_root,
                &path,
                page_id.as_deref().or(parent_page_id),
                migrated_pages,
                migrated_blocks,
            )?;
        }
    }

    Ok(())
}

/// Migrate a single markdown file to the database
fn migrate_file(
    conn: &rusqlite::Connection,
    workspace_root: &Path,
    file_path: &Path,
    parent_page_id: Option<&str>,
    is_directory: bool,
    migrated_pages: &mut usize,
    migrated_blocks: &mut usize,
) -> Result<String, String> {
    let file_name = file_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Untitled");

    let content = fs::read_to_string(file_path).map_err(|e| e.to_string())?;

    // Create page
    let page_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO pages (id, title, parent_id, file_path, is_directory, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![
            &page_id,
            file_name,
            parent_page_id,
            file_path.to_string_lossy().to_string(),
            if is_directory { 1 } else { 0 },
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

    *migrated_pages += 1;
    *migrated_blocks += blocks.len();

    Ok(page_id)
}

fn block_type_to_string(bt: &BlockType) -> String {
    match bt {
        BlockType::Bullet => "bullet".to_string(),
        BlockType::Code => "code".to_string(),
        BlockType::Fence => "fence".to_string(),
    }
}

/// Set workspace path (called when workspace is selected)
#[tauri::command]
pub async fn set_workspace_path(
    db: tauri::State<'_, Arc<std::sync::Mutex<rusqlite::Connection>>>,
    workspace_path: String,
) -> Result<bool, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    // Insert or update workspace path
    conn.execute(
        "INSERT INTO workspace (id, path, created_at) VALUES ('default', ?, ?)
         ON CONFLICT(id) DO UPDATE SET path = excluded.path",
        params![&workspace_path, &now],
    )
    .map_err(|e| e.to_string())?;

    Ok(true)
}
