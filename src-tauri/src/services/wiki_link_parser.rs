use regex::Regex;
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
    let masked_content = mask_code_blocks(content);
    let regex = get_wiki_link_regex();

    for cap in regex.captures_iter(&masked_content) {
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
        let mut link_type = if is_embed { "embed_page".to_string() } else { "page_link".to_string() };
        
        if let Some(s) = suffix {
            if s.starts_with('^') {
                block_ref = Some(s[1..].to_string());
                link_type = if is_embed { "embed_block".to_string() } else { "block_link".to_string() };
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

fn mask_code_blocks(content: &str) -> String {
    let mut chars: Vec<char> = content.chars().collect();
    let mut result_chars = chars.clone();
    
    let mut i = 0;
    while i < chars.len() {
        // Check for code block ```
        if i + 2 < chars.len() && chars[i] == '`' && chars[i+1] == '`' && chars[i+2] == '`' {
            let start = i;
            i += 3;
            // Find end
            while i + 2 < chars.len() {
                if chars[i] == '`' && chars[i+1] == '`' && chars[i+2] == '`' {
                    i += 3; // Skip closing
                    break;
                }
                result_chars[i] = ' ';
                i += 1;
            }
            // Mask everything including delimiters to avoid false matches
            for j in start..i {
                 if j < result_chars.len() {
                    result_chars[j] = ' ';
                 }
            }
        } else if chars[i] == '`' {
            // Inline code
            let start = i;
            i += 1;
            while i < chars.len() {
                if chars[i] == '`' {
                    i += 1;
                    break;
                }
                 result_chars[i] = ' ';
                 i += 1;
            }
             for j in start..i {
                 if j < result_chars.len() {
                    result_chars[j] = ' ';
                 }
            }
        } else {
            i += 1;
        }
    }
    
    result_chars.into_iter().collect()
}

fn normalize_target_path(raw: &str) -> String {
    // 1. Replace \ with /
    let path = raw.replace('\\', "/");
    // 2. Trim whitespace
    let path = path.trim();
    // 3. Remove trailing .md extension
    let path = if path.to_lowercase().ends_with(".md") {
        &path[..path.len() - 3]
    } else {
        path
    };
    
    path.to_string()
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
