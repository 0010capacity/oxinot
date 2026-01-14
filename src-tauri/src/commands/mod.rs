pub mod block;
pub mod git;
pub mod page;
pub mod search;
pub mod workspace;

/// Helper macro to get DB connection from DbState
/// Returns an error if no workspace is loaded
#[macro_export]
macro_rules! get_db_conn {
    ($db_state:expr) => {{
        let state = $db_state
            .lock()
            .map_err(|e| format!("Failed to lock DB state: {}", e))?;

        state
            .as_ref()
            .ok_or_else(|| "No workspace loaded. Please select a workspace first.".to_string())?
            .clone()
    }};
}
