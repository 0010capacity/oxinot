use crate::commands::workspace::open_workspace_db;
use crate::error::OxinotError;

/// Vacuum the database to reclaim unused space.
/// This rebuilds the database file, repacking it into a minimal amount of disk space.
#[tauri::command]
pub fn vacuum_db(workspace_path: String) -> Result<(), String> {
    let conn = open_workspace_db(&workspace_path)?;

    conn.execute("VACUUM", []).map_err(|e| {
        OxinotError::database(format!("Failed to vacuum database: {}", e)).to_string()
    })?;

    Ok(())
}

/// Optimize the database for query performance.
/// Runs ANALYZE to gather statistics for the query optimizer.
#[tauri::command]
pub fn optimize_db(workspace_path: String) -> Result<(), String> {
    let conn = open_workspace_db(&workspace_path)?;

    // Runs ANALYZE to gather statistics for the query optimizer
    conn.execute("ANALYZE", []).map_err(|e| {
        OxinotError::database(format!("Failed to analyze database: {}", e)).to_string()
    })?;

    Ok(())
}

/// Repair database integrity by cleaning up orphaned blocks and records.
/// This removes:
/// - Blocks with non-existent page_id references
/// - Blocks with non-existent parent_id references (parent is in different page or doesn't exist)
/// - Orphaned metadata, refs, wiki_links, and path caches
#[tauri::command]
pub fn repair_db(workspace_path: String) -> Result<String, String> {
    let mut conn = open_workspace_db(&workspace_path)?;

    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    let mut report = String::new();

    // 1. Find and delete blocks with non-existent page_id
    let invalid_page_blocks: i32 = tx
        .query_row(
            "SELECT COUNT(*) FROM blocks WHERE page_id NOT IN (SELECT id FROM pages)",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if invalid_page_blocks > 0 {
        report.push_str(&format!(
            "Found {} blocks with invalid page_id\n",
            invalid_page_blocks
        ));
        tx.execute(
            "DELETE FROM blocks WHERE page_id NOT IN (SELECT id FROM pages)",
            [],
        )
        .map_err(|e| e.to_string())?;
    }

    // 2. Find and delete blocks with parent_id that references a non-existent block
    let invalid_parent_blocks: i32 = tx
        .query_row(
            "SELECT COUNT(*) FROM blocks WHERE parent_id IS NOT NULL AND parent_id NOT IN (SELECT id FROM blocks)",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if invalid_parent_blocks > 0 {
        report.push_str(&format!(
            "Found {} blocks with invalid parent_id\n",
            invalid_parent_blocks
        ));
        tx.execute(
            "DELETE FROM blocks WHERE parent_id IS NOT NULL AND parent_id NOT IN (SELECT id FROM blocks)",
            [],
        )
        .map_err(|e| e.to_string())?;
    }

    // 3. Find and delete blocks with parent_id in different page
    let cross_page_parent_blocks: i32 = tx
        .query_row(
            "SELECT COUNT(*) FROM blocks b1
             WHERE b1.parent_id IS NOT NULL
             AND EXISTS (
                SELECT 1 FROM blocks b2
                WHERE b1.parent_id = b2.id AND b1.page_id != b2.page_id
             )",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if cross_page_parent_blocks > 0 {
        report.push_str(&format!(
            "Found {} blocks with parent_id in different page\n",
            cross_page_parent_blocks
        ));
        tx.execute(
            "UPDATE blocks SET parent_id = NULL
             WHERE parent_id IS NOT NULL
             AND EXISTS (
                SELECT 1 FROM blocks b2
                WHERE parent_id = b2.id AND blocks.page_id != b2.page_id
             )",
            [],
        )
        .map_err(|e| e.to_string())?;
    }

    // 4. Clean up orphaned metadata
    let orphaned_metadata: i32 = tx
        .query_row(
            "SELECT COUNT(*) FROM block_metadata WHERE block_id NOT IN (SELECT id FROM blocks)",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if orphaned_metadata > 0 {
        report.push_str(&format!(
            "Found {} orphaned metadata records\n",
            orphaned_metadata
        ));
        tx.execute(
            "DELETE FROM block_metadata WHERE block_id NOT IN (SELECT id FROM blocks)",
            [],
        )
        .map_err(|e| e.to_string())?;
    }

    // 5. Clean up orphaned block_refs
    let orphaned_refs: i32 = tx
        .query_row(
            "SELECT COUNT(*) FROM block_refs
             WHERE from_block_id NOT IN (SELECT id FROM blocks)
             OR to_block_id NOT IN (SELECT id FROM blocks)",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if orphaned_refs > 0 {
        report.push_str(&format!(
            "Found {} orphaned block references\n",
            orphaned_refs
        ));
        tx.execute(
            "DELETE FROM block_refs
             WHERE from_block_id NOT IN (SELECT id FROM blocks)
             OR to_block_id NOT IN (SELECT id FROM blocks)",
            [],
        )
        .map_err(|e| e.to_string())?;
    }

    // 6. Clean up orphaned wiki_links
    let orphaned_wiki_links: i32 = tx
        .query_row(
            "SELECT COUNT(*) FROM wiki_links
             WHERE from_page_id NOT IN (SELECT id FROM pages)
             OR from_block_id NOT IN (SELECT id FROM blocks)",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if orphaned_wiki_links > 0 {
        report.push_str(&format!(
            "Found {} orphaned wiki links\n",
            orphaned_wiki_links
        ));
        tx.execute(
            "DELETE FROM wiki_links
             WHERE from_page_id NOT IN (SELECT id FROM pages)
             OR from_block_id NOT IN (SELECT id FROM blocks)",
            [],
        )
        .map_err(|e| e.to_string())?;
    }

    // 7. Clean up orphaned block_paths
    let orphaned_block_paths: i32 = tx
        .query_row(
            "SELECT COUNT(*) FROM block_paths
             WHERE block_id NOT IN (SELECT id FROM blocks)
             OR page_id NOT IN (SELECT id FROM pages)",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if orphaned_block_paths > 0 {
        report.push_str(&format!(
            "Found {} orphaned block path records\n",
            orphaned_block_paths
        ));
        tx.execute(
            "DELETE FROM block_paths
             WHERE block_id NOT IN (SELECT id FROM blocks)
             OR page_id NOT IN (SELECT id FROM pages)",
            [],
        )
        .map_err(|e| e.to_string())?;
    }

    // 8. Clean up orphaned page_paths
    let orphaned_page_paths: i32 = tx
        .query_row(
            "SELECT COUNT(*) FROM page_paths WHERE page_id NOT IN (SELECT id FROM pages)",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if orphaned_page_paths > 0 {
        report.push_str(&format!(
            "Found {} orphaned page path records\n",
            orphaned_page_paths
        ));
        tx.execute(
            "DELETE FROM page_paths WHERE page_id NOT IN (SELECT id FROM pages)",
            [],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    if report.is_empty() {
        report = "Database is healthy, no repairs needed.".to_string();
    } else {
        report.insert_str(0, "Database repairs completed:\n");
    }

    println!("[repair_db] {}", report);
    Ok(report)
}
