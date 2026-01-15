use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WikiLink {
    pub id: String,
    pub from_page_id: String,
    pub from_block_id: String,
    pub to_page_id: Option<String>,
    pub link_type: String,
    pub target_path: String,
    pub raw_target: String,
    pub alias: Option<String>,
    pub heading: Option<String>,
    pub block_ref: Option<String>,
    pub is_embed: bool,
}
