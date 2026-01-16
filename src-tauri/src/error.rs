//! Structured error types for the Oxinot backend using thiserror.
//!
//! This module defines custom error types that provide:
//! - Detailed error context and messages
//! - Automatic Display and Error trait implementations via thiserror
//! - Better error propagation and debugging
//!
//! # Error Conversion
//! Errors automatically convert to String for Tauri command responses via Display trait.

use rusqlite;
use std::io;
use std::path::PathBuf;
use thiserror::Error;

/// Main error type for Oxinot backend operations.
#[derive(Error, Debug)]
pub enum OxinotError {
    #[error("Database error: {0}")]
    Database(String),

    #[error("Failed to read file: {0}")]
    FileRead(#[from] io::Error),

    #[error("Failed to write file: {0}")]
    FileWrite(String),

    #[error("Path error: {0}")]
    PathError(String),

    #[error("Path '{path}' is not under workspace root '{workspace_root}'")]
    PathOutsideWorkspace {
        path: PathBuf,
        workspace_root: PathBuf,
    },

    #[error("Path contains invalid UTF-8")]
    InvalidUtf8,

    #[error("Invalid page path: {0}")]
    InvalidPagePath(String),

    #[error("Page not found: {0}")]
    PageNotFound(String),

    #[error("Block not found: {0}")]
    BlockNotFound(String),

    #[error("Workspace error: {0}")]
    Workspace(String),

    #[error("Git operation failed: {0}")]
    Git(String),

    #[error("Settings error: {0}")]
    Settings(String),

    #[error("Markdown parsing error: {0}")]
    MarkdownParse(String),

    #[error("Invalid state: {0}")]
    InvalidState(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl OxinotError {
    /// Create a database error from a sqlite error message.
    pub fn database<S: Into<String>>(msg: S) -> Self {
        OxinotError::Database(msg.into())
    }

    /// Create a file write error.
    pub fn file_write<S: Into<String>>(msg: S) -> Self {
        OxinotError::FileWrite(msg.into())
    }

    /// Create a path error.
    pub fn path_error<S: Into<String>>(msg: S) -> Self {
        OxinotError::PathError(msg.into())
    }

    /// Create a workspace error.
    pub fn workspace<S: Into<String>>(msg: S) -> Self {
        OxinotError::Workspace(msg.into())
    }

    /// Create a git operation error.
    pub fn git<S: Into<String>>(msg: S) -> Self {
        OxinotError::Git(msg.into())
    }

    /// Create a settings error.
    pub fn settings<S: Into<String>>(msg: S) -> Self {
        OxinotError::Settings(msg.into())
    }

    /// Create a markdown parsing error.
    pub fn markdown_parse<S: Into<String>>(msg: S) -> Self {
        OxinotError::MarkdownParse(msg.into())
    }

    /// Create an invalid state error.
    pub fn invalid_state<S: Into<String>>(msg: S) -> Self {
        OxinotError::InvalidState(msg.into())
    }

    /// Create a configuration error.
    pub fn config<S: Into<String>>(msg: S) -> Self {
        OxinotError::Config(msg.into())
    }

    /// Create an internal error.
    pub fn internal<S: Into<String>>(msg: S) -> Self {
        OxinotError::Internal(msg.into())
    }
}

/// Result type alias for Oxinot operations.
pub type Result<T> = std::result::Result<T, OxinotError>;

/// Convert rusqlite errors to OxinotError
impl From<rusqlite::Error> for OxinotError {
    fn from(err: rusqlite::Error) -> Self {
        OxinotError::Database(err.to_string())
    }
}

/// Trait for converting errors to Tauri command responses.
/// Automatically implements Display which converts to String for Tauri.
impl From<OxinotError> for String {
    fn from(err: OxinotError) -> Self {
        err.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = OxinotError::database("Connection failed");
        assert_eq!(err.to_string(), "Database error: Connection failed");
    }

    #[test]
    fn test_error_conversion_to_string() {
        let err = OxinotError::workspace("Invalid workspace");
        let s: String = err.into();
        assert_eq!(s, "Workspace error: Invalid workspace");
    }

    #[test]
    fn test_path_outside_workspace_error() {
        let err = OxinotError::PathOutsideWorkspace {
            path: PathBuf::from("/other/path"),
            workspace_root: PathBuf::from("/workspace"),
        };
        assert!(err.to_string().contains("not under workspace root"));
    }

    #[test]
    fn test_io_error_conversion() {
        let io_err = io::Error::new(io::ErrorKind::NotFound, "file not found");
        let oxinot_err: OxinotError = io_err.into();
        assert!(oxinot_err.to_string().contains("Failed to read file"));
    }
}
