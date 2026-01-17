use rusqlite::{Connection, Result as SqliteResult};
use std::path::PathBuf;

use super::schema;

/// Get the default database path
pub fn get_db_path(app_data_dir: PathBuf) -> PathBuf {
    app_data_dir.join("data").join("outliner.db")
}

/// Initialize database connection and create schema
pub fn init_db(db_path: PathBuf) -> SqliteResult<Connection> {
    // Ensure parent directory exists
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).ok();
    }

    let conn = Connection::open(db_path)?;

    // Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON", [])?;

    // Enable WAL mode for better concurrency
    conn.execute_batch("PRAGMA journal_mode = WAL")?;

    // Initialize schema
    schema::init_schema(&conn)?;

    Ok(conn)
}
