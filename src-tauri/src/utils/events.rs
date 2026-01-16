use tauri::Emitter;

/// Emit workspace_changed event to notify frontend of file changes
/// This is called after any file system operation that modifies workspace files
pub fn emit_workspace_changed(app: &tauri::AppHandle, workspace_path: &str) {
    let _ = app.emit("workspace-changed", workspace_path);
}
