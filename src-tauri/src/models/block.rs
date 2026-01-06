use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Block {
    pub id: String,
    pub page_id: String,
    pub parent_id: Option<String>,
    pub content: String,
    pub order_weight: f64,
    pub is_collapsed: bool,
    pub block_type: BlockType,
    pub language: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BlockType {
    Bullet,
    Code,
    Fence,
}

impl Default for BlockType {
    fn default() -> Self {
        BlockType::Bullet
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBlockRequest {
    pub page_id: String,
    pub parent_id: Option<String>,
    pub after_block_id: Option<String>,
    pub content: Option<String>,
    pub block_type: Option<BlockType>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBlockRequest {
    pub id: String,
    pub content: Option<String>,
    pub is_collapsed: Option<bool>,
    pub block_type: Option<BlockType>,
    pub language: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveBlockRequest {
    pub id: String,
    pub new_parent_id: Option<String>,
    pub after_block_id: Option<String>,
}
