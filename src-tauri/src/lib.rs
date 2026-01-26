use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::Manager;
use tokio::fs as tokio_fs;

pub mod commands;
pub mod config;
pub mod db;
pub mod error;
pub mod models;
pub mod services;
pub mod utils;

use utils::path::{validate_filename, validate_no_path_traversal, validate_workspace_containment};

#[derive(Debug, Serialize, Deserialize)]
pub struct FileSystemItem {
    name: String,
    path: String,
    is_directory: bool,
    is_file: bool,
    modified_time: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PathInfo {
    is_directory: bool,
    is_file: bool,
    size: u64,
    modified_time: String,
    created_time: String,
}

#[tauri::command]
async fn select_workspace(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let folder = app
        .dialog()
        .file()
        .set_title("Select Workspace Folder")
        .blocking_pick_folder();

    if let Some(folder_path) = folder {
        let path_str = folder_path.to_string();

        // Initialize workspace metadata (.oxinot folder)
        commands::workspace::initialize_workspace(path_str.clone())
            .map_err(|e| format!("Failed to initialize workspace: {}", e))?;

        // Initialize git repository if not already initialized
        let _ = commands::git::git_init(path_str.clone());

        // Run incremental sync to index workspace files
        let _ = commands::workspace::sync_workspace_incremental(path_str.clone());

        Ok(Some(path_str))
    } else {
        Ok(None)
    }
}

#[tauri::command]
async fn read_directory(dir_path: String) -> Result<Vec<FileSystemItem>, String> {
    // Validate input - reject absolute paths and path traversal
    validate_no_path_traversal(&dir_path, "dir_path")?;

    let mut entries = tokio_fs::read_dir(&dir_path)
        .await
        .map_err(|e| format!("Error reading directory: {}", e))?;

    let mut items = Vec::new();

    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        let metadata = entry
            .metadata()
            .await
            .map_err(|e| format!("Error reading metadata: {}", e))?;

        let modified_time = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs().to_string())
            .unwrap_or_else(|| "0".to_string());

        items.push(FileSystemItem {
            name: entry.file_name().to_string_lossy().to_string(),
            path: path.to_string_lossy().to_string(),
            is_directory: metadata.is_dir(),
            is_file: metadata.is_file(),
            modified_time,
        });
    }

    // Sort: directories first, then files, alphabetically
    items.sort_by(|a, b| {
        if a.is_directory && !b.is_directory {
            std::cmp::Ordering::Less
        } else if !a.is_directory && b.is_directory {
            std::cmp::Ordering::Greater
        } else {
            a.name.cmp(&b.name)
        }
    });

    Ok(items)
}

#[tauri::command]
async fn read_file(file_path: String) -> Result<String, String> {
    // Validate input - reject absolute paths and path traversal
    validate_no_path_traversal(&file_path, "file_path")?;

    tokio_fs::read_to_string(&file_path)
        .await
        .map_err(|e| format!("Error reading file: {}", e))
}

#[tauri::command]
async fn write_file(file_path: String, content: String) -> Result<bool, String> {
    // Validate input - reject absolute paths and path traversal
    validate_no_path_traversal(&file_path, "file_path")?;

    tokio_fs::write(&file_path, content)
        .await
        .map_err(|e| format!("Error writing file: {}", e))?;
    Ok(true)
}

#[tauri::command]
async fn create_file(dir_path: String, file_name: String) -> Result<String, String> {
    // Validate inputs - reject absolute paths and path traversal
    validate_no_path_traversal(&dir_path, "dir_path")?;
    validate_filename(&file_name)?;

    let file_path = PathBuf::from(&dir_path).join(&file_name);

    if file_path.exists() {
        return Err("File already exists".to_string());
    }

    let name_without_ext = file_name.trim_end_matches(".md");
    let initial_content = format!(
        "# {}

",
        name_without_ext
    );

    tokio_fs::write(&file_path, initial_content)
        .await
        .map_err(|e| format!("Error creating file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn create_directory(parent_path: String, dir_name: String) -> Result<String, String> {
    // Validate inputs - reject absolute paths and path traversal
    validate_no_path_traversal(&parent_path, "parent_path")?;
    validate_filename(&dir_name)?;

    let dir_path = PathBuf::from(&parent_path).join(&dir_name);

    tokio_fs::create_dir_all(&dir_path)
        .await
        .map_err(|e| format!("Error creating directory: {}", e))?;

    // Create folder note
    let folder_note_path = dir_path.join(format!("{}.md", dir_name));
    let folder_note_content = format!(
        "# {}

This is the folder note for {}.\n",
        dir_name, dir_name
    );

    tokio_fs::write(&folder_note_path, folder_note_content)
        .await
        .map_err(|e| format!("Error creating folder note: {}", e))?;

    Ok(dir_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn delete_path(target_path: String) -> Result<bool, String> {
    // Validate input - reject absolute paths
    validate_no_path_traversal(&target_path, "target_path")?;

    let path = Path::new(&target_path);
    let metadata = tokio_fs::metadata(path)
        .await
        .map_err(|e| format!("Error getting path info: {}", e))?;

    if metadata.is_dir() {
        tokio_fs::remove_dir_all(path)
            .await
            .map_err(|e| format!("Error deleting directory: {}", e))?;
    } else {
        tokio_fs::remove_file(path)
            .await
            .map_err(|e| format!("Error deleting file: {}", e))?;
    }

    Ok(true)
}

#[tauri::command]
async fn delete_path_with_db(workspace_path: String, target_path: String) -> Result<bool, String> {
    // Validate workspace path exists
    validate_no_path_traversal(&workspace_path, "workspace_path")?;

    // Validate target path is within workspace boundaries using canonicalization
    validate_workspace_containment(&workspace_path, &target_path)?;

    let mut conn = commands::workspace::open_workspace_db(&workspace_path)
        .map_err(|e| format!("Failed to open workspace database: {}", e))?;

    // Find pages with matching file path
    // Normalize path separators for consistent database queries (Windows uses \, others use /)
    let target_path_normalized = PathBuf::from(&target_path)
        .to_string_lossy()
        .replace('\\', "/");

    // Get all pages matching this path
    let page_ids: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT id FROM pages WHERE file_path = ? OR file_path LIKE ?")
            .map_err(|e| e.to_string())?;

        let results: Vec<String> = stmt
            .query_map(
                [
                    &target_path_normalized,
                    &format!("{}/%", target_path_normalized),
                ],
                |row| row.get::<_, String>(0),
            )
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        results
    };

    // Start RAII transaction - automatically rolls back on drop if not committed
    {
        let tx = conn
            .transaction()
            .map_err(|e| format!("Failed to start transaction: {}", e))?;

        // Step 1: Mark pages as deleting (soft delete) to indicate deletion is in progress
        for page_id in page_ids.iter() {
            tx.execute(
                "UPDATE pages SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [page_id],
            )
            .map_err(|e| format!("Failed to mark page as deleted: {}", e))?;
        }

        // Commit transaction before async operations
        tx.commit()
            .map_err(|e| format!("Failed to commit soft delete transaction: {}", e))?;
    }

    // Step 2: Delete from filesystem (async operation after transaction is released)
    let path = Path::new(&target_path);

    let delete_result = async {
        let metadata = tokio_fs::metadata(path)
            .await
            .map_err(|e| format!("Error getting path info: {}", e))?;

        if metadata.is_dir() {
            tokio_fs::remove_dir_all(path)
                .await
                .map_err(|e| format!("Error deleting directory: {}", e))?;
        } else {
            tokio_fs::remove_file(path)
                .await
                .map_err(|e| format!("Error deleting file: {}", e))?;
        }
        Ok::<(), String>(())
    }
    .await;

    // Step 3: Handle result
    match delete_result {
        Ok(()) => {
            // Filesystem deletion succeeded, now permanently delete from DB in a new transaction
            let tx = conn
                .transaction()
                .map_err(|e| format!("Failed to start final delete transaction: {}", e))?;

            for page_id in page_ids {
                tx.execute("DELETE FROM pages WHERE id = ?", [&page_id])
                    .map_err(|e| format!("Failed to delete page from database: {}", e))?;
            }

            // Commit transaction - auto-rollback if any error occurs before this
            tx.commit()
                .map_err(|e| format!("Failed to commit final delete transaction: {}", e))?;

            Ok(true)
        }
        Err(e) => {
            // Filesystem deletion failed - soft delete marked, transaction was already committed
            // The pages are marked as deleted but not physically removed
            Err(format!(
                "Failed to delete from filesystem, pages marked as deleted but not removed: {}",
                e
            ))
        }
    }
}

#[tauri::command]
async fn rename_path(old_path: String, new_name: String) -> Result<String, String> {
    // Validate inputs - reject absolute paths and path traversal
    validate_no_path_traversal(&old_path, "old_path")?;
    validate_filename(&new_name)?;

    let old = Path::new(&old_path);
    let parent = old
        .parent()
        .ok_or_else(|| "Cannot get parent directory".to_string())?;
    let new_path = parent.join(&new_name);

    tokio_fs::rename(old, &new_path)
        .await
        .map_err(|e| format!("Error renaming: {}", e))?;

    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn move_path(source_path: String, target_parent_path: String) -> Result<String, String> {
    // Validate inputs - reject absolute paths and path traversal
    validate_no_path_traversal(&source_path, "source_path")?;
    validate_no_path_traversal(&target_parent_path, "target_parent_path")?;

    let source = Path::new(&source_path);
    let file_name = source
        .file_name()
        .ok_or_else(|| "Cannot get file name".to_string())?;

    let target_parent = Path::new(&target_parent_path);
    if !target_parent.exists() {
        return Err("Target parent directory does not exist".to_string());
    }

    let new_path = target_parent.join(file_name);

    tokio_fs::rename(source, &new_path)
        .await
        .map_err(|e| format!("Error moving: {}", e))?;

    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn convert_file_to_directory(file_path: String) -> Result<String, String> {
    // Validate input - reject absolute paths and path traversal
    validate_no_path_traversal(&file_path, "file_path")?;

    let file = Path::new(&file_path);

    // Read the file content first
    let content = tokio_fs::read_to_string(file)
        .await
        .map_err(|e| format!("Error reading file: {}", e))?;

    // Get the file name without extension
    let file_stem = file
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or_else(|| "Invalid file name".to_string())?;

    let parent = file
        .parent()
        .ok_or_else(|| "Cannot get parent directory".to_string())?;

    // Create directory with the same name as the file (without .md)
    let dir_path = parent.join(file_stem);
    tokio_fs::create_dir_all(&dir_path)
        .await
        .map_err(|e| format!("Error creating directory: {}", e))?;

    // Move the content to a file inside the directory with the same name
    let new_file_path = dir_path.join(format!("{}.md", file_stem));
    tokio_fs::write(&new_file_path, content)
        .await
        .map_err(|e| format!("Error writing file: {}", e))?;

    // Delete the original file
    tokio_fs::remove_file(file)
        .await
        .map_err(|e| format!("Error removing original file: {}", e))?;

    Ok(dir_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn get_path_info(target_path: String) -> Result<PathInfo, String> {
    // Validate input - reject absolute paths and path traversal
    validate_no_path_traversal(&target_path, "target_path")?;

    let metadata = tokio_fs::metadata(&target_path)
        .await
        .map_err(|e| format!("Error getting path info: {}", e))?;

    let modified_time = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|| "0".to_string());

    let created_time = metadata
        .created()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|| "0".to_string());

    Ok(PathInfo {
        is_directory: metadata.is_dir(),
        is_file: metadata.is_file(),
        size: metadata.len(),
        modified_time,
        created_time,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // No global DB - each command will open workspace-specific DB as needed

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            #[cfg(target_os = "macos")]
            {
                use tauri::WindowEvent;
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    window.hide().ok();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            select_workspace, // Renamed to avoid conflict
            read_directory,
            read_file,
            write_file,
            create_file,
            create_directory,
            delete_path,
            delete_path_with_db,
            rename_path,
            move_path,
            convert_file_to_directory,
            get_path_info,
            // Block commands
            commands::block::get_page_blocks,
            commands::block::create_block,
            commands::block::create_blocks_batch,
            commands::block::update_block,
            commands::block::delete_block,
            commands::block::move_block,
            commands::block::indent_block,
            commands::block::outdent_block,
            commands::block::toggle_collapse,
            commands::block::merge_blocks,
            // Block search/navigation commands
            commands::block::search_blocks,
            commands::block::resolve_block_path,
            commands::block::get_block,
            commands::block::get_blocks,
            commands::block::get_block_ancestors,
            commands::block::get_block_subtree,
            // Page commands
            commands::page::get_pages,
            commands::page::create_page,
            commands::page::update_page_title,
            commands::page::delete_page,
            commands::page::get_page,
            commands::page::get_page_tree,
            commands::page::convert_page_to_directory,
            commands::page::move_page,
            commands::page::convert_directory_to_file,
            commands::page::reindex_page_markdown,
            // Workspace commands
            commands::workspace::initialize_workspace,
            commands::workspace::sync_workspace,
            commands::workspace::sync_workspace_incremental,
            commands::workspace::reindex_workspace,
            // DB maintenance commands
            commands::db::vacuum_db,
            commands::db::optimize_db,
            commands::db::repair_db,
            commands::db::get_fts_stats,
            commands::db::rebuild_fts_index,
            commands::db::verify_fts_index,
            commands::db::optimize_fts_index,
            commands::db::rebuild_page_fts_index,
            // Search commands
            commands::search::search_content,
            // Git commands
            commands::git::git_init,
            commands::git::git_is_repo,
            commands::git::git_status,
            commands::git::git_commit,
            commands::git::git_push,
            commands::git::git_pull,
            commands::git::git_log,
            commands::git::git_get_remote_url,
            commands::git::git_set_remote_url,
            commands::git::git_remove_remote,
            commands::workspace::close_workspace,
            commands::workspace::reveal_in_finder,
            commands::wiki_link::get_page_backlinks,
            commands::wiki_link::get_broken_links,
            commands::wiki_link::reindex_wiki_links,
            // Graph commands
            commands::graph::get_graph_data,
            commands::graph::get_page_graph_data,
            // Query commands
            commands::query::execute_query_macro,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    #[cfg(target_os = "macos")]
    app.run(|app_handle, event| {
        use tauri::RunEvent;

        if let RunEvent::Reopen { .. } = event {
            // Dock 아이콘 클릭 시 모든 숨겨진 창을 표시
            let windows = app_handle.webview_windows();
            for (_label, window) in windows {
                if !window.is_visible().unwrap_or(false) {
                    window.show().ok();
                    window.set_focus().ok();
                }
            }
        }
    });

    #[cfg(not(target_os = "macos"))]
    app.run(|_app_handle, _event| {});
}
