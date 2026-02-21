use crate::commands::block::block_type_to_string;
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
///
/// Block Metadata (key::value format)
/// - Metadata lines follow the same pattern as ID markers:
///     "  key::value"
///   where value can be a simple string or JSON object/array
/// - Metadata lines are consumed during parsing and stored in block.metadata HashMap
/// - During serialization, metadata is written after the ID marker line
/// - Metadata lines are not shown to users in the UI (like ID markers)

const ID_MARKER_PREFIX: &str = "ID::";
const METADATA_PATTERN: &str = "::";

fn is_id_marker_line(trimmed: &str) -> bool {
    trimmed.starts_with(ID_MARKER_PREFIX) && trimmed[ID_MARKER_PREFIX.len()..].trim().len() > 0
}

fn parse_id_marker(trimmed: &str) -> Option<String> {
    if !is_id_marker_line(trimmed) {
        return None;
    }
    Some(trimmed[ID_MARKER_PREFIX.len()..].trim().to_string())
}

pub fn is_metadata_line(trimmed: &str) -> bool {
    if trimmed.starts_with(ID_MARKER_PREFIX) {
        return false; // ID marker is not metadata
    }
    trimmed.contains(METADATA_PATTERN)
        && !trimmed.starts_with(METADATA_PATTERN)
        && !trimmed.ends_with(METADATA_PATTERN)
}

fn parse_metadata_line(trimmed: &str) -> Option<(String, String)> {
    if !is_metadata_line(trimmed) {
        return None;
    }

    let parts: Vec<&str> = trimmed.splitn(2, METADATA_PATTERN).collect();
    if parts.len() != 2 {
        return None;
    }

    let key = parts[0].trim().to_string();
    let value = parts[1].trim().to_string();

    if key.is_empty() || value.is_empty() {
        return None;
    }

    Some((key, value))
}

pub fn sanitize_content_for_markdown(content: &str) -> String {
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

                // Metadata lines (after ID marker)
                let mut metadata_keys: Vec<&String> = block.metadata.keys().collect();
                metadata_keys.sort(); // Sort for consistent output
                for key in metadata_keys {
                    if let Some(value) = block.metadata.get(key) {
                        output.push_str(&format!("{}  {}::{}\n", indent, key, value));
                    }
                }
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
            BlockType::AiPrompt | BlockType::AiResponse => {
                output.push_str(&format!(
                    "{}- {}\n",
                    indent,
                    sanitize_content_for_markdown(&block.content)
                ));
                output.push_str(&format!("{}  {}{}\n", indent, ID_MARKER_PREFIX, block.id));
                output.push_str(&format!(
                    "{}  block_type::{}\n",
                    indent,
                    block_type_to_string(&block.block_type)
                ));
                let mut metadata_keys: Vec<&String> = block.metadata.keys().collect();
                metadata_keys.sort();
                for key in metadata_keys {
                    if let Some(value) = block.metadata.get(key) {
                        output.push_str(&format!("{}  {}::{}\n", indent, key, value));
                    }
                }
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

        // Skip standalone metadata lines (defensive; normally consumed via lookahead)
        if is_metadata_line(trimmed) {
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
                    metadata: HashMap::new(),
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
        let mut metadata: HashMap<String, String> = HashMap::new();

        // Check for body-indented lines (ID marker and metadata) at depth+1
        let body_indent = depth + 1;

        if i + 1 < lines.len() {
            let next_line = lines[i + 1];
            let next_trimmed = next_line.trim_start();
            let next_depth = (next_line.len() - next_trimmed.len()) / 2;

            // The ID line should be "body-indented" under the bullet (depth+1)
            if next_depth == body_indent && is_id_marker_line(next_trimmed) {
                explicit_id = parse_id_marker(next_trimmed);
                i += 1; // consume marker line

                // After ID marker, consume any metadata lines at the same body indent level
                while i + 1 < lines.len() {
                    let meta_line = lines[i + 1];
                    let meta_trimmed = meta_line.trim_start();
                    let meta_depth = (meta_line.len() - meta_trimmed.len()) / 2;

                    if meta_depth == body_indent && is_metadata_line(meta_trimmed) {
                        if let Some((key, value)) = parse_metadata_line(meta_trimmed) {
                            metadata.insert(key, value);
                            i += 1; // consume metadata line
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }
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
            metadata,
        };

        order_counter += 1.0;
        parent_stack.push((block.id.clone(), depth));
        blocks.push(block);

        i += 1;
    }

    blocks
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metadata_parsing() {
        let markdown = r#"- Fight Club review
  ID::test-id-1
  title::Fight Club
  year::1999
  rating::5
  cast::{"에드워드 노튼": "나레이터", "브래드 피트": "타일러 더든"}
"#;

        let blocks = markdown_to_blocks(markdown, "test-page");
        assert_eq!(blocks.len(), 1);

        let block = &blocks[0];
        assert_eq!(block.id, "test-id-1");
        assert_eq!(block.content, "Fight Club review");
        assert_eq!(block.metadata.len(), 4);
        assert_eq!(block.metadata.get("title"), Some(&"Fight Club".to_string()));
        assert_eq!(block.metadata.get("year"), Some(&"1999".to_string()));
        assert_eq!(block.metadata.get("rating"), Some(&"5".to_string()));
        assert_eq!(
            block.metadata.get("cast"),
            Some(&r#"{"에드워드 노튼": "나레이터", "브래드 피트": "타일러 더든"}"#.to_string())
        );
    }

    #[test]
    fn test_metadata_serialization() {
        let mut metadata = HashMap::new();
        metadata.insert("title".to_string(), "Inception".to_string());
        metadata.insert("director".to_string(), "Christopher Nolan".to_string());
        metadata.insert("year".to_string(), "2010".to_string());

        let block = Block {
            id: "test-id".to_string(),
            page_id: "test-page".to_string(),
            parent_id: None,
            content: "Movie review".to_string(),
            order_weight: 1.0,
            is_collapsed: false,
            block_type: BlockType::Bullet,
            language: None,
            created_at: Utc::now().to_rfc3339(),
            updated_at: Utc::now().to_rfc3339(),
            metadata,
        };

        let markdown = blocks_to_markdown(&[block]);

        // Check that markdown contains metadata lines
        assert!(markdown.contains("- Movie review"));
        assert!(markdown.contains("ID::test-id"));
        assert!(markdown.contains("director::Christopher Nolan"));
        assert!(markdown.contains("title::Inception"));
        assert!(markdown.contains("year::2010"));
    }

    #[test]
    fn test_metadata_roundtrip() {
        let original_markdown = r#"- Movie: Inception
  ID::roundtrip-id
  title::Inception
  year::2010
  rating::5
"#;

        // Parse
        let blocks = markdown_to_blocks(original_markdown, "test-page");
        assert_eq!(blocks.len(), 1);
        assert_eq!(blocks[0].metadata.len(), 3);

        // Serialize
        let serialized = blocks_to_markdown(&blocks);

        // Parse again
        let blocks2 = markdown_to_blocks(&serialized, "test-page");
        assert_eq!(blocks2.len(), 1);
        assert_eq!(blocks2[0].id, "roundtrip-id");
        assert_eq!(blocks2[0].metadata, blocks[0].metadata);
    }

    #[test]
    fn test_nested_blocks_with_metadata() {
        let markdown = r#"- Parent block
  ID::parent-id
  status::active
  - Child block
    ID::child-id
    tag::important
"#;

        let blocks = markdown_to_blocks(markdown, "test-page");
        assert_eq!(blocks.len(), 2);

        let parent = blocks.iter().find(|b| b.id == "parent-id").unwrap();
        assert_eq!(parent.metadata.get("status"), Some(&"active".to_string()));
        assert_eq!(parent.parent_id, None);

        let child = blocks.iter().find(|b| b.id == "child-id").unwrap();
        assert_eq!(child.metadata.get("tag"), Some(&"important".to_string()));
        assert_eq!(child.parent_id, Some("parent-id".to_string()));
    }

    #[test]
    fn test_json_metadata_value() {
        let markdown = r#"- Cast information
  ID::cast-id
  cast::{"actor1": "role1", "actor2": "role2"}
  list::[1, 2, 3, 4]
"#;

        let blocks = markdown_to_blocks(markdown, "test-page");
        assert_eq!(blocks.len(), 1);

        let block = &blocks[0];
        assert_eq!(
            block.metadata.get("cast"),
            Some(&r#"{"actor1": "role1", "actor2": "role2"}"#.to_string())
        );
        assert_eq!(
            block.metadata.get("list"),
            Some(&"[1, 2, 3, 4]".to_string())
        );
    }

    #[test]
    fn test_empty_metadata() {
        let markdown = r#"- Block without metadata
  ID::no-meta-id
"#;

        let blocks = markdown_to_blocks(markdown, "test-page");
        assert_eq!(blocks.len(), 1);
        assert_eq!(blocks[0].metadata.len(), 0);
    }

    #[test]
    fn test_metadata_not_parsed_as_block() {
        let markdown = r#"- Block with metadata
  ID::block-id
  key1::value1
  key2::value2
- Next block
  ID::next-id
"#;

        let blocks = markdown_to_blocks(markdown, "test-page");
        // Should only have 2 blocks, not 4 (metadata lines should not become blocks)
        assert_eq!(blocks.len(), 2);
        assert_eq!(blocks[0].id, "block-id");
        assert_eq!(blocks[1].id, "next-id");
    }
}
