use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

mod commands;
mod db;
mod models;
mod services;
mod utils;

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
            .await
            .map_err(|e| format!("Failed to initialize workspace: {}", e))?;

        // Initialize git repository if not already initialized
        let _ = commands::git::git_init(path_str.clone()).await;

        // Run incremental sync to index workspace files
        let _ = commands::workspace::sync_workspace_incremental(path_str.clone()).await;

        // Check if workspace is empty and create Welcome.md if needed
        match fs::read_dir(&path_str) {
            Ok(entries) => {
                let md_files: Vec<_> = entries
                    .filter_map(|e| e.ok())
                    .filter(|e| {
                        e.path()
                            .extension()
                            .and_then(|s| s.to_str())
                            .map(|s| s == "md")
                            .unwrap_or(false)
                    })
                    .collect();

                if md_files.is_empty() {
                    let welcome_path = PathBuf::from(&path_str).join("Welcome.md");
                    let welcome_content = r#"# Welcome

Welcome to your new workspace! 🎉

## Getting Started

Start creating your notes and documents here.
  This is a block-based outliner
  You can nest content infinitely
    Like this!

## Features

Markdown support with live rendering
Outliner-style editing
File organization"#;

                    if let Err(e) = fs::write(welcome_path, welcome_content) {
                        eprintln!("Error creating Welcome.md: {}", e);
                    }
                }
            }
            Err(e) => {
                eprintln!("Error reading directory: {}", e);
            }
        }

        Ok(Some(path_str))
    } else {
        Ok(None)
    }
}

#[tauri::command]
async fn read_directory(dir_path: String) -> Result<Vec<FileSystemItem>, String> {
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

    // Sort: directories first, then files, alphabetically (case-insensitive)
    items.sort_by(|a, b| {
        if a.is_directory && !b.is_directory {
            std::cmp::Ordering::Less
        } else if !a.is_directory && b.is_directory {
            std::cmp::Ordering::Greater
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    Ok(items)
}

#[tauri::command]
async fn read_file(file_path: String) -> Result<String, String> {
    fs::read_to_string(&file_path).map_err(|e| format!("Error reading file: {}", e))
}

#[tauri::command]
async fn write_file(file_path: String, content: String) -> Result<bool, String> {
    fs::write(&file_path, content).map_err(|e| format!("Error writing file: {}", e))?;
    Ok(true)
}

#[tauri::command]
async fn create_file(dir_path: String, file_name: String) -> Result<String, String> {
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
async fn create_directory(parent_path: String, dir_name: String) -> Result<String, String> {
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
async fn delete_path(target_path: String) -> Result<bool, String> {
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
async fn rename_path(old_path: String, new_name: String) -> Result<String, String> {
    let old = Path::new(&old_path);
    let parent = old
        .parent()
        .ok_or_else(|| "Cannot get parent directory".to_string())?;
    let new_path = parent.join(&new_name);

    fs::rename(old, &new_path).map_err(|e| format!("Error renaming: {}", e))?;

    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn move_path(source_path: String, target_parent_path: String) -> Result<String, String> {
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
async fn convert_file_to_directory(file_path: String) -> Result<String, String> {
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
async fn get_path_info(target_path: String) -> Result<PathInfo, String> {
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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
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
            select_workspace,
            read_directory,
            read_file,
            write_file,
            create_file,
            create_directory,
            delete_path,
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
            // Block search/navigation commands
            commands::block::search_blocks,
            commands::block::resolve_block_path,
            commands::block::get_block,
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
            commands::page::get_page_backlinks,
            // Workspace commands
            commands::workspace::initialize_workspace,
            commands::workspace::sync_workspace,
            commands::workspace::sync_workspace_incremental,
            commands::workspace::reindex_workspace,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
