use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Page {
    pub id: String,
    pub title: String,
    pub parent_id: Option<String>,
    pub file_path: Option<String>,
    pub is_directory: bool,
    pub file_mtime: Option<i64>, // Unix timestamp for incremental sync
    pub file_size: Option<i64>,  // File size in bytes for incremental sync
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePageRequest {
    pub title: String,
    pub parent_id: Option<String>,
    pub file_path: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePageRequest {
    pub id: String,
    pub title: Option<String>,
    pub parent_id: Option<String>,
    pub file_path: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MovePageRequest {
    pub id: String,
    pub new_parent_id: Option<String>,
}
