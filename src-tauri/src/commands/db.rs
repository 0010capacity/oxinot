use crate::commands::workspace::open_workspace_db;
use crate::error::OxinotError;

/// Vacuum the database to reclaim unused space.
/// This rebuilds the database file, repacking it into a minimal amount of disk space.
#[tauri::command]
pub fn vacuum_db(workspace_path: String) -> Result<(), String> {
    let conn = open_workspace_db(&workspace_path)?;

    conn.execute("VACUUM", [])
        .map_err(|e| OxinotError::database(format!("Failed to vacuum database: {}", e)).to_string())?;

    Ok(())
}

/// Optimize the database for query performance.
/// Runs ANALYZE to gather statistics for the query optimizer.
#[tauri::command]
pub fn optimize_db(workspace_path: String) -> Result<(), String> {
    let conn = open_workspace_db(&workspace_path)?;

    // Runs ANALYZE to gather statistics for the query optimizer
    conn.execute("ANALYZE", [])
        .map_err(|e| OxinotError::database(format!("Failed to analyze database: {}", e)).to_string())?;

    Ok(())
}
