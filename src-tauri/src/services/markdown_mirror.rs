use crate::models::block::{Block, BlockType};
use chrono::Utc;
use rusqlite::Connection;
use std::collections::HashMap;
use std::collections::HashSet;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use uuid::Uuid;

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

        // Pop parents with greater or equal depth
        while let Some((_, parent_depth)) = parent_stack.last() {
            if *parent_depth >= depth {
                parent_stack.pop();
            } else {
                break;
            }
        }

        let parent_id = parent_stack.last().map(|(id, _)| id.clone());

        // Strip leading bullet if present
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
