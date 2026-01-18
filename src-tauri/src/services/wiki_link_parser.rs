use crate::utils::path::normalize_page_path;
use regex::Regex;
use std::ops::Range;
use std::sync::OnceLock;

static WIKI_LINK_REGEX: OnceLock<Regex> = OnceLock::new();

fn get_wiki_link_regex() -> &'static Regex {
    WIKI_LINK_REGEX.get_or_init(|| Regex::new(r"(!?)\[\[([^\]]+)\]\]").unwrap())
}

#[derive(Debug, Clone, PartialEq)]
pub struct ParsedLink {
    pub target_path: String,
    pub raw_target: String,
    pub alias: Option<String>,
    pub heading: Option<String>,
    pub block_ref: Option<String>,
    pub is_embed: bool,
    pub link_type: String,
}

pub fn parse_wiki_links(content: &str) -> Vec<ParsedLink> {
    let mut links = Vec::new();
    let ignored_ranges = get_ignored_ranges(content);
    let regex = get_wiki_link_regex();

    for cap in regex.captures_iter(content) {
        let match_range = cap.get(0).unwrap().range();

        // Check if the match starts inside an ignored range (code block)
        if ignored_ranges
            .iter()
            .any(|r| r.contains(&match_range.start))
        {
            continue;
        }

        let is_embed_str = cap.get(1).map_or("", |m| m.as_str());
        let inner_content = cap.get(2).map_or("", |m| m.as_str());

        let is_embed = is_embed_str == "!";

        // Parse inner content: target|alias
        let (left, alias) = match inner_content.split_once('|') {
            Some((l, r)) => (l, Some(r.trim().to_string())),
            None => (inner_content, None),
        };

        // Parse target: path#heading or path#^blockid
        let (target_path_raw, suffix) = match left.split_once('#') {
            Some((l, r)) => (l, Some(r)),
            None => (left, None),
        };

        let mut heading = None;
        let mut block_ref = None;
        let mut link_type = if is_embed {
            "embed_page".to_string()
        } else {
            "page_link".to_string()
        };

        if let Some(s) = suffix {
            if let Some(stripped) = s.strip_prefix('^') {
                block_ref = Some(stripped.to_string());
                link_type = if is_embed {
                    "embed_block".to_string()
                } else {
                    "block_link".to_string()
                };
            } else {
                heading = Some(s.to_string());
            }
        }

        let target_path = normalize_target_path(target_path_raw);

        if !target_path.is_empty() {
            links.push(ParsedLink {
                target_path,
                raw_target: inner_content.to_string(),
                alias,
                heading,
                block_ref,
                is_embed,
                link_type,
            });
        }
    }

    links
}

fn get_ignored_ranges(content: &str) -> Vec<Range<usize>> {
    let mut ranges = Vec::new();
    let bytes = content.as_bytes();
    let len = bytes.len();
    let mut i = 0;

    while i < len {
        if bytes[i] == b'`' {
            if i + 2 < len && bytes[i + 1] == b'`' && bytes[i + 2] == b'`' {
                // Fenced code block
                let start = i;
                i += 3;
                // Find end
                while i < len {
                    if bytes[i] == b'`' && i + 2 < len && bytes[i + 1] == b'`' && bytes[i + 2] == b'`'
                    {
                        i += 3; // Include closing
                        break;
                    }
                    i += 1;
                }
                ranges.push(start..i);
            } else {
                // Inline code
                let start = i;
                i += 1;
                while i < len {
                    if bytes[i] == b'`' {
                        i += 1;
                        break;
                    }
                    i += 1;
                }
                ranges.push(start..i);
            }
        } else {
            i += 1;
        }
    }

    ranges
}

fn normalize_target_path(raw: &str) -> String {
    normalize_page_path(raw)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_link() {
        let content = "Check out [[Page One]] here.";
        let links = parse_wiki_links(content);
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].target_path, "Page One");
        assert_eq!(links[0].link_type, "page_link");
        assert_eq!(links[0].alias, None);
    }

    #[test]
    fn test_parse_alias() {
        let content = "Go to [[Page One|First Page]].";
        let links = parse_wiki_links(content);
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].target_path, "Page One");
        assert_eq!(links[0].alias, Some("First Page".to_string()));
    }

    #[test]
    fn test_parse_heading() {
        let content = "See [[Page One#Section 1]].";
        let links = parse_wiki_links(content);
        assert_eq!(links[0].target_path, "Page One");
        assert_eq!(links[0].heading, Some("Section 1".to_string()));
        assert_eq!(links[0].link_type, "page_link");
    }

    #[test]
    fn test_parse_block_ref() {
        let content = "Reference: [[Page One#^block-123]].";
        let links = parse_wiki_links(content);
        assert_eq!(links[0].target_path, "Page One");
        assert_eq!(links[0].block_ref, Some("block-123".to_string()));
        assert_eq!(links[0].link_type, "block_link");
    }

    #[test]
    fn test_parse_embed() {
        let content = "Embed: ![[Image.png]]";
        let links = parse_wiki_links(content);
        assert_eq!(links[0].target_path, "Image.png");
        assert_eq!(links[0].is_embed, true);
        assert_eq!(links[0].link_type, "embed_page");
    }

    #[test]
    fn test_normalization() {
        let content = "Link: [[Folder\\File.md]]";
        let links = parse_wiki_links(content);
        assert_eq!(links[0].target_path, "Folder/File"); // .md stripped, \ -> /
    }

    #[test]
    fn test_ignore_code_blocks() {
        let content = "
        Here is a link: [[Valid Link]]
        ```rust
        // This is not a link: [[Ignored Link]]
        fn main() {}
        ```
        And another: [[Valid Link 2]]
        `inline code [[Ignored Inline]]`
        ";
        let links = parse_wiki_links(content);
        assert_eq!(links.len(), 2);
        assert_eq!(links[0].target_path, "Valid Link");
        assert_eq!(links[1].target_path, "Valid Link 2");
    }

    #[test]
    fn test_multiple_links() {
        let content = "[[Link A]] and [[Link B|Alias]]";
        let links = parse_wiki_links(content);
        assert_eq!(links.len(), 2);
        assert_eq!(links[0].target_path, "Link A");
        assert_eq!(links[1].target_path, "Link B");
        assert_eq!(links[1].alias, Some("Alias".to_string()));
    }
}
