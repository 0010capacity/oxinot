use rusqlite::{Connection, Result as SqliteResult};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use super::schema;

/// Database connection wrapper
pub struct DbConnection {
    conn: Arc<Mutex<Connection>>,
}

impl DbConnection {
    /// Initialize database connection and create schema
    pub fn new(db_path: PathBuf) -> SqliteResult<Self> {
        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).ok();
        }

        let conn = Connection::open(db_path)?;

        // Enable foreign keys
        conn.execute("PRAGMA foreign_keys = ON", [])?;

        // Initialize schema
        schema::init_schema(&conn)?;

        Ok(DbConnection {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    /// Get a reference to the connection
    pub fn get(&self) -> Arc<Mutex<Connection>> {
        Arc::clone(&self.conn)
    }
}

impl Clone for DbConnection {
    fn clone(&self) -> Self {
        DbConnection {
            conn: Arc::clone(&self.conn),
        }
    }
}

/// Get the default database path
pub fn get_db_path(app_data_dir: PathBuf) -> PathBuf {
    app_data_dir.join("data").join("outliner.db")
}
