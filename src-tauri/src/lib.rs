use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

pub mod commands;
pub mod config;
pub mod db;
pub mod error;
pub mod models;
pub mod services;
pub mod utils;

use utils::path::{validate_filename, validate_no_path_traversal};

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
fn select_workspace(app: tauri::AppHandle) -> Result<Option<String>, String> {
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
fn read_directory(dir_path: String) -> Result<Vec<FileSystemItem>, String> {
    // Validate input
    validate_no_path_traversal(&dir_path, "dir_path")?;

    let entries = fs::read_dir(&dir_path).map_err(|e| format!("Error reading directory: {}", e))?;

    let mut items = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("Error reading entry: {}", e))?;
        let path = entry.path();
        let metadata = entry
            .metadata()
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
fn read_file(file_path: String) -> Result<String, String> {
    // Validate input
    validate_no_path_traversal(&file_path, "file_path")?;

    fs::read_to_string(&file_path).map_err(|e| format!("Error reading file: {}", e))
}

#[tauri::command]
fn write_file(file_path: String, content: String) -> Result<bool, String> {
    // Validate input
    validate_no_path_traversal(&file_path, "file_path")?;

    fs::write(&file_path, content).map_err(|e| format!("Error writing file: {}", e))?;
    Ok(true)
}

#[tauri::command]
fn create_file(dir_path: String, file_name: String) -> Result<String, String> {
    // Validate inputs
    validate_no_path_traversal(&dir_path, "dir_path")?;
    validate_filename(&file_name)?;

    let file_path = PathBuf::from(&dir_path).join(&file_name);

    if file_path.exists() {
        return Err("File already exists".to_string());
    }

    let name_without_ext = file_name.trim_end_matches(".md");
    let initial_content = format!("# {}\n\n", name_without_ext);

    fs::write(&file_path, initial_content).map_err(|e| format!("Error creating file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
fn create_directory(parent_path: String, dir_name: String) -> Result<String, String> {
    // Validate inputs
    validate_no_path_traversal(&parent_path, "parent_path")?;
    validate_filename(&dir_name)?;

    let dir_path = PathBuf::from(&parent_path).join(&dir_name);

    fs::create_dir_all(&dir_path).map_err(|e| format!("Error creating directory: {}", e))?;

    // Create folder note
    let folder_note_path = dir_path.join(format!("{}.md", dir_name));
    let folder_note_content = format!(
        "# {}\n\nThis is the folder note for {}.\n",
        dir_name, dir_name
    );

    fs::write(&folder_note_path, folder_note_content)
        .map_err(|e| format!("Error creating folder note: {}", e))?;

    Ok(dir_path.to_string_lossy().to_string())
}

#[tauri::command]
fn delete_path(target_path: String) -> Result<bool, String> {
    // Validate input
    validate_no_path_traversal(&target_path, "target_path")?;

    let path = Path::new(&target_path);
    let metadata = fs::metadata(path).map_err(|e| format!("Error getting path info: {}", e))?;

    if metadata.is_dir() {
        fs::remove_dir_all(path).map_err(|e| format!("Error deleting directory: {}", e))?;
    } else {
        fs::remove_file(path).map_err(|e| format!("Error deleting file: {}", e))?;
    }

    Ok(true)
}

#[tauri::command]
fn delete_path_with_db(workspace_path: String, target_path: String) -> Result<bool, String> {
    // Validate inputs
    validate_no_path_traversal(&workspace_path, "workspace_path")?;
    validate_no_path_traversal(&target_path, "target_path")?;

    let conn = commands::workspace::open_workspace_db(&workspace_path)
        .map_err(|e| format!("Failed to open workspace database: {}", e))?;

    // Find pages with matching file path
    // Normalize path separators for consistent database queries (Windows uses \, others use /)
    let target_path_normalized = PathBuf::from(&target_path)
        .to_string_lossy()
        .replace('\\', "/");

    // Get all pages matching this path
    let mut stmt = conn
        .prepare("SELECT id FROM pages WHERE file_path = ? OR file_path LIKE ?")
        .map_err(|e| e.to_string())?;

    let page_ids: Vec<String> = stmt
        .query_map(
            [
                &target_path_normalized,
                &format!("{}/%", target_path_normalized),
            ],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Step 1: Mark pages as deleting (soft delete)
    for page_id in page_ids.iter() {
        conn.execute(
            "UPDATE pages SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [page_id],
        )
        .map_err(|e| e.to_string())?;
    }

    // Step 2: Delete from filesystem
    let path = Path::new(&target_path);
    let delete_result = (|| -> Result<(), String> {
        let metadata = fs::metadata(path).map_err(|e| format!("Error getting path info: {}", e))?;

        if metadata.is_dir() {
            fs::remove_dir_all(path).map_err(|e| format!("Error deleting directory: {}", e))?;
        } else {
            fs::remove_file(path).map_err(|e| format!("Error deleting file: {}", e))?;
        }

        Ok(())
    })();

    // Step 3: Handle result
    match delete_result {
        Ok(()) => {
            // Filesystem deletion succeeded, now delete from DB
            for page_id in page_ids {
                conn.execute("DELETE FROM pages WHERE id = ?", [&page_id])
                    .map_err(|e| e.to_string())?;
            }
            Ok(true)
        }
        Err(e) => {
            // Filesystem deletion failed, revert soft delete flag
            for page_id in page_ids.iter() {
                let _ = conn.execute(
                    "UPDATE pages SET is_deleted = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    [page_id],
                );
            }
            Err(format!(
                "Failed to delete from filesystem, reverted DB changes: {}",
                e
            ))
        }
    }
}

#[tauri::command]
fn rename_path(old_path: String, new_name: String) -> Result<String, String> {
    // Validate inputs
    validate_no_path_traversal(&old_path, "old_path")?;
    validate_filename(&new_name)?;

    let old = Path::new(&old_path);
    let parent = old
        .parent()
        .ok_or_else(|| "Cannot get parent directory".to_string())?;
    let new_path = parent.join(&new_name);

    fs::rename(old, &new_path).map_err(|e| format!("Error renaming: {}", e))?;

    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
fn move_path(source_path: String, target_parent_path: String) -> Result<String, String> {
    // Validate inputs
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

    fs::rename(source, &new_path).map_err(|e| format!("Error moving: {}", e))?;

    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
fn convert_file_to_directory(file_path: String) -> Result<String, String> {
    // Validate input
    validate_no_path_traversal(&file_path, "file_path")?;

    let file = Path::new(&file_path);

    // Read the file content first
    let content = fs::read_to_string(file).map_err(|e| format!("Error reading file: {}", e))?;

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
    fs::create_dir_all(&dir_path).map_err(|e| format!("Error creating directory: {}", e))?;

    // Move the content to a file inside the directory with the same name
    let new_file_path = dir_path.join(format!("{}.md", file_stem));
    fs::write(&new_file_path, content).map_err(|e| format!("Error writing file: {}", e))?;

    // Delete the original file
    fs::remove_file(file).map_err(|e| format!("Error removing original file: {}", e))?;

    Ok(dir_path.to_string_lossy().to_string())
}

#[tauri::command]
fn get_path_info(target_path: String) -> Result<PathInfo, String> {
    // Validate input
    validate_no_path_traversal(&target_path, "target_path")?;

    let metadata =
        fs::metadata(&target_path).map_err(|e| format!("Error getting path info: {}", e))?;

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
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
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
            commands::page::update_page,
            commands::page::delete_page,
            commands::page::move_page,
            commands::page::convert_page_to_directory,
            commands::page::debug_db_state,
            commands::page::rewrite_wiki_links_for_page_path_change,
            // Workspace commands
            commands::workspace::initialize_workspace,
            commands::workspace::sync_workspace,
            commands::workspace::sync_workspace_incremental,
            commands::workspace::reindex_workspace,
            // DB maintenance commands
            commands::db::vacuum_db,
            commands::db::optimize_db,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
