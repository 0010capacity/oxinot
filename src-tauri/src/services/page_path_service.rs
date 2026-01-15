use crate::utils::path::normalize_page_path;
use rusqlite::{params, Connection};

pub fn update_page_path(
    conn: &Connection,
    page_id: &str,
    file_path: &str,
) -> Result<(), rusqlite::Error> {
    // Normalize path using shared utility
    let path_str = normalize_page_path(file_path);

    conn.execute(
        "INSERT OR REPLACE INTO page_paths (page_id, path_text, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
        params![page_id, path_str],
    )?;

    Ok(())
}

pub fn remove_page_path(conn: &Connection, page_id: &str) -> Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM page_paths WHERE page_id = ?", params![page_id])?;
    Ok(())
}

pub fn migrate_populate_page_paths(conn: &Connection) -> Result<(), rusqlite::Error> {
    // Populate page_paths table from existing pages
    let mut stmt = conn.prepare("SELECT id, file_path FROM pages WHERE file_path IS NOT NULL")?;

    let pages: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<Result<_, _>>()?;

    let mut error_count = 0;
    for (page_id, file_path) in pages {
        if let Err(e) = update_page_path(conn, &page_id, &file_path) {
            eprintln!(
                "[migrate_populate_page_paths] Failed to update page_path for page {}: {}",
                page_id, e
            );
            error_count += 1;
        }
    }

    if error_count > 0 {
        eprintln!(
            "[migrate_populate_page_paths] Migration completed with {} errors",
            error_count
        );
    } else {
        println!("[migrate_populate_page_paths] Successfully populated page_paths for all pages");
    }

    Ok(())
}
