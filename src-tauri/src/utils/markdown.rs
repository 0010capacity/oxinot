use crate::models::block::{Block, BlockType};
use chrono::Utc;
use std::collections::HashMap;
use uuid::Uuid;

/// I4 Migration Strategy: Canonical markdown format
/// Current implementation uses bullet-only format (Option A from handoff notes):
/// - All blocks serialize as "- content" (bullets)
/// - Headings (# ) are parsed into bullet blocks for backward compatibility
/// - This avoids heading loss when round-tripping through parser/serializer
/// - Future: implement BlockType::Heading for proper heading support (Option B)
///
/// Hidden Block IDs (Logseq-style, internal only)
/// - When serializing, we append a hidden marker line directly under each bullet block:
///     "  ID::<uuid>"
///   This line must never be shown to users in the UI, but must exist in markdown for stable rebuilds.
/// - When parsing, if a bullet block is immediately followed by an ID marker line at the same indent,
///   we reuse that UUID for the block instead of generating a new one.
/// - ID marker lines are not imported as blocks.

const ID_MARKER_PREFIX: &str = "ID::";

fn is_id_marker_line(trimmed: &str) -> bool {
    trimmed.starts_with(ID_MARKER_PREFIX) && trimmed[ID_MARKER_PREFIX.len()..].trim().len() > 0
}

fn parse_id_marker(trimmed: &str) -> Option<String> {
    if !is_id_marker_line(trimmed) {
        return None;
    }
    Some(trimmed[ID_MARKER_PREFIX.len()..].trim().to_string())
}

fn sanitize_content_for_markdown(content: &str) -> String {
    // Prevent users from accidentally creating raw ID marker lines that would be treated as metadata
    // during rebuild. We keep content as-is, but if a line begins with "ID::", we prefix it with a
    // zero-width space so it won't match the marker parser.
    //
    // NOTE: This is defensive; the UI should also prevent/escape rendering this line verbatim.
    let mut out = String::new();
    for (i, line) in content.lines().enumerate() {
        if i > 0 {
            out.push('\n');
        }
        let trimmed = line.trim_start();
        if trimmed.starts_with(ID_MARKER_PREFIX) {
            out.push('\u{200B}');
        }
        out.push_str(line);
    }
    out
}

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
                output.push_str(&format!(
                    "{}- {}\n",
                    indent,
                    sanitize_content_for_markdown(&block.content)
                ));
                // Hidden ID marker line (same indent level body)
                output.push_str(&format!("{}  {}{}\n", indent, ID_MARKER_PREFIX, block.id));
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
///
/// Hidden ID markers:
/// - Lines like "  ID::<uuid>" (aligned to the bullet's indent level) are consumed as metadata
///   for the preceding bullet block and are NOT imported as blocks.
pub fn markdown_to_blocks(content: &str, page_id: &str) -> Vec<Block> {
    let mut blocks = Vec::new();
    let mut parent_stack: Vec<(String, usize)> = Vec::new();
    let mut order_counter: f64 = 1.0;

    // We need lookahead for the optional ID marker line after a bullet.
    let lines: Vec<&str> = content.lines().collect();
    let mut i = 0usize;

    while i < lines.len() {
        let line = lines[i];
        let trimmed = line.trim_start();
        let depth = (line.len() - trimmed.len()) / 2;

        if trimmed.is_empty() {
            i += 1;
            continue;
        }

        // Skip standalone ID marker lines (defensive; normally consumed via lookahead)
        if is_id_marker_line(trimmed) {
            i += 1;
            continue;
        }

        // Skip heading lines - they are not part of the bullet-based canonical format
        // Headings are parsed into their content for backward compatibility
        if trimmed.starts_with('#') {
            // Extract heading content (# Title -> Title)
            let heading_content = trimmed.trim_start_matches('#').trim_start().to_string();

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
            i += 1;
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
        let content_text = if trimmed.starts_with("- ") {
            trimmed[2..].to_string()
        } else {
            trimmed.to_string()
        };

        // Optional: consume an immediate ID marker line at the same logical depth.
        // We serialize as: "<indent>- content" then "<indent>  ID::<uuid>"
        let mut explicit_id: Option<String> = None;
        if i + 1 < lines.len() {
            let next_line = lines[i + 1];
            let next_trimmed = next_line.trim_start();
            let next_depth = (next_line.len() - next_trimmed.len()) / 2;

            // The ID line should be "body-indented" under the bullet: same depth, but starts with "ID::"
            if next_depth == depth && is_id_marker_line(next_trimmed) {
                explicit_id = parse_id_marker(next_trimmed);
                i += 1; // consume marker line
            }
        }

        let block = Block {
            id: explicit_id.unwrap_or_else(|| Uuid::new_v4().to_string()),
            page_id: page_id.to_string(),
            parent_id,
            content: content_text,
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

        i += 1;
    }

    blocks
}
