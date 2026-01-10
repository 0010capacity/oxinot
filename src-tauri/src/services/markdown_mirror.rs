use crate::models::block::{Block, BlockType};
use chrono::Utc;
use rusqlite::Connection;
use std::collections::HashMap;
use std::collections::HashSet;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use uuid::Uuid;

/// I4 Migration Strategy: Canonical markdown format
/// Current implementation uses bullet-only format (Option A from handoff notes):
/// - All blocks serialize as "- content" (bullets)
/// - Headings (# ) are parsed into bullet blocks for backward compatibility
/// - This avoids heading loss when round-tripping through parser/serializer
/// - Future: implement BlockType::Heading for proper heading support (Option B)

/// Convert blocks to markdown string
pub fn blocks_to_markdown(blocks: &[Block]) -> String {
    // Group by parent
    let mut children_map: HashMap<Option<String>, Vec<&Block>> = HashMap::new();

    for block in blocks {
        children_map
            .entry(block.parent_id.clone())
            .or_default()
            .push(block);
    }

    // Sort each group by order_weight
    for children in children_map.values_mut() {
        children.sort_by(|a, b| {
            a.order_weight
                .partial_cmp(&b.order_weight)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
    }

    let mut output = String::new();
    render_blocks(&children_map, None, 0, &mut output);

    output
}

fn render_blocks(
    children_map: &HashMap<Option<String>, Vec<&Block>>,
    parent_id: Option<String>,
    depth: usize,
    output: &mut String,
) {
    let Some(children) = children_map.get(&parent_id) else {
        return;
    };

    for block in children {
        let indent = "  ".repeat(depth);

        match block.block_type {
            BlockType::Bullet => {
                output.push_str(&format!("{}- {}\n", indent, block.content));
            }
            BlockType::Code => {
                let lang = block.language.as_deref().unwrap_or("");
                output.push_str(&format!("{}```{}\n", indent, lang));
                for line in block.content.lines() {
                    output.push_str(&format!("{}{}\n", indent, line));
                }
                output.push_str(&format!("{}```\n", indent));
            }
            BlockType::Fence => {
                output.push_str(&format!("{}///\n", indent));
                for line in block.content.lines() {
                    output.push_str(&format!("{}{}\n", indent, line));
                }
                output.push_str(&format!("{}///\n", indent));
            }
        }

        // Render children
        render_blocks(children_map, Some(block.id.clone()), depth + 1, output);
    }
}

/// Parse markdown file to blocks
/// Handles both bullet format (- ) and heading format (# ) for backward compatibility (I4)
/// Headings are converted to root-level bullets to maintain canonical format.
/// This ensures files with heading format can be read but will be serialized as bullets.
pub fn markdown_to_blocks(content: &str, page_id: &str) -> Vec<Block> {
    let mut blocks = Vec::new();
    let mut parent_stack: Vec<(String, usize)> = Vec::new();
    let mut order_counter: f64 = 1.0;

    for line in content.lines() {
        let trimmed = line.trim_start();
        let depth = (line.len() - trimmed.len()) / 2;

        if trimmed.is_empty() {
            continue;
        }

        // Skip heading lines - they are not part of the bullet-based canonical format
        // Headings are parsed into their content for backward compatibility
        if trimmed.starts_with('#') {
            // Extract heading content (# Title -> Title)
            let heading_content = trimmed
                .trim_start_matches('#')
                .trim_start()
                .to_string();

            if !heading_content.is_empty() {
                // Treat heading as a root-level bullet (depth=0, no parent)
                let block = Block {
                    id: Uuid::new_v4().to_string(),
                    page_id: page_id.to_string(),
                    parent_id: None,
                    content: heading_content,
                    order_weight: order_counter,
                    is_collapsed: false,
                    block_type: BlockType::Bullet,
                    language: None,
                    created_at: Utc::now().to_rfc3339(),
                    updated_at: Utc::now().to_rfc3339(),
                };
                blocks.push(block);
                order_counter += 1.0;
            }
            continue;
        }

        // Pop parents with greater or equal depth
        while let Some((_, parent_depth)) = parent_stack.last() {
            if *parent_depth >= depth {
                parent_stack.pop();
            } else {
                break;
            }
        }

        let parent_id = parent_stack.last().map(|(id, _)| id.clone());

        // Strip leading bullet if present (bullet format)
        // Non-bullet lines are treated as-is (for backward compatibility with mixed formats)
        let content = if trimmed.starts_with("- ") {
            trimmed[2..].to_string()
        } else {
            trimmed.to_string()
        };

        let block = Block {
            id: Uuid::new_v4().to_string(),
            page_id: page_id.to_string(),
            parent_id,
            content,
            order_weight: order_counter,
            is_collapsed: false,
            block_type: BlockType::Bullet,
            language: None,
            created_at: Utc::now().to_rfc3339(),
            updated_at: Utc::now().to_rfc3339(),
        };

        order_counter += 1.0;
        parent_stack.push((block.id.clone(), depth));
        blocks.push(block);
    }

    blocks
}

#[derive(Clone)]
pub struct MarkdownMirrorService {
    sender: mpsc::Sender<MirrorCommand>,
}

#[derive(Clone)]
enum MirrorCommand {
    QueuePage(String),
    Shutdown,
}

impl MarkdownMirrorService {
    pub fn new(db_path: String) -> Self {
        let (sender, receiver) = mpsc::channel();

        thread::spawn(move || {
            let mut pending_pages: HashSet<String> = HashSet::new();
            let debounce_duration = Duration::from_secs(1);

            loop {
                match receiver.recv_timeout(debounce_duration) {
                    Ok(MirrorCommand::QueuePage(page_id)) => {
                        pending_pages.insert(page_id);
                    }
                    Ok(MirrorCommand::Shutdown) => {
                        for page_id in pending_pages.drain() {
                            let _ = mirror_page_to_file(&db_path, &page_id);
                        }
                        break;
                    }
                    Err(mpsc::RecvTimeoutError::Timeout) => {
                        for page_id in pending_pages.drain() {
                            let _ = mirror_page_to_file(&db_path, &page_id);
                        }
                    }
                    Err(mpsc::RecvTimeoutError::Disconnected) => break,
                }
            }
        });

        Self { sender }
    }

    pub fn queue_mirror(&self, page_id: String) {
        let _ = self.sender.send(MirrorCommand::QueuePage(page_id));
    }

    pub fn shutdown(&self) {
        let _ = self.sender.send(MirrorCommand::Shutdown);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_markdown_roundtrip_bullets() {
        let page_id = "test-page";

        // Original bullet format
        let original = "- Item 1\n- Item 2\n  - Nested\n";

        // Parse to blocks
        let blocks = markdown_to_blocks(original, page_id);
        assert_eq!(blocks.len(), 3, "Should parse 3 items");

        // Serialize back to markdown
        let serialized = blocks_to_markdown(&blocks);

        // Should be identical
        assert_eq!(original, serialized, "Roundtrip should preserve bullet format");
    }

    #[test]
    fn test_markdown_heading_compatibility() {
        let page_id = "test-page";

        // Old heading format
        let heading_content = "# My Title\n";

        // Parse to blocks
        let blocks = markdown_to_blocks(heading_content, page_id);
        assert_eq!(blocks.len(), 1, "Should parse heading as single block");
        assert_eq!(blocks[0].content, "My Title", "Should extract heading content");

        // Serialize back - should be bullet format (canonical)
        let serialized = blocks_to_markdown(&blocks);
        assert_eq!(serialized, "- My Title\n", "Heading should be converted to bullet on serialization");
    }

    #[test]
    fn test_mixed_heading_bullet_content() {
        let page_id = "test-page";

        // File with mixed heading and bullet content
        let content = "# Title\n- Bullet 1\n- Bullet 2\n";

        let blocks = markdown_to_blocks(content, page_id);
        assert_eq!(blocks.len(), 3, "Should parse heading and 2 bullets");

        // First block should be from heading
        assert_eq!(blocks[0].content, "Title");
        assert_eq!(blocks[1].content, "Bullet 1");
        assert_eq!(blocks[2].content, "Bullet 2");
    }
}

fn mirror_page_to_file(db_path: &str, page_id: &str) -> Result<(), String> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    let file_path: Option<String> = conn
        .query_row(
            "SELECT file_path FROM pages WHERE id = ?",
            [page_id],
            |row| row.get(0),
        )
        .ok();

    let mut stmt = conn
        .prepare(
            "SELECT id, page_id, parent_id, content, order_weight,
                is_collapsed, block_type, language, created_at, updated_at
         FROM blocks WHERE page_id = ?",
        )
        .map_err(|e| e.to_string())?;

    let blocks: Vec<Block> = stmt
        .query_map([page_id], |row| {
            Ok(Block {
                id: row.get(0)?,
                page_id: row.get(1)?,
                parent_id: row.get(2)?,
                content: row.get(3)?,
                order_weight: row.get(4)?,
                is_collapsed: row.get::<_, i32>(5)? != 0,
                block_type: parse_block_type(row.get::<_, String>(6)?),
                language: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let markdown = blocks_to_markdown(&blocks);

    if let Some(path) = file_path {
        std::fs::write(&path, markdown).map_err(|e| format!("Failed to write file: {}", e))?;
    }

    Ok(())
}

fn parse_block_type(s: String) -> BlockType {
    match s.to_lowercase().as_str() {
        "code" => BlockType::Code,
        "fence" => BlockType::Fence,
        _ => BlockType::Bullet,
    }
}
