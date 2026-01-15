use rusqlite::{Connection, params, OptionalExtension};
use uuid::Uuid;
use crate::services::wiki_link_parser::parse_wiki_links;

pub fn index_block_links(
    conn: &Connection,
    block_id: &str,
    block_content: &str,
    page_id: &str,
) -> Result<(), rusqlite::Error> {
    // 1. Delete existing links for this block
    conn.execute(
        "DELETE FROM wiki_links WHERE from_block_id = ?",
        params![block_id],
    )?;

    // 2. Parse new links
    let links = parse_wiki_links(block_content);
    
    if links.is_empty() {
        return Ok(());
    }

    // 3. Resolve and insert
    let mut stmt_resolve = conn.prepare("SELECT page_id FROM page_paths WHERE path_text = ? LIMIT 1")?;
    
    let mut stmt_insert = conn.prepare(r#"
        INSERT INTO wiki_links (
            id, from_page_id, from_block_id, to_page_id, link_type, 
            target_path, raw_target, alias, heading, block_ref, is_embed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    "#)?;

    for link in links {
        let to_page_id: Option<String> = stmt_resolve.query_row(params![link.target_path], |row| row.get(0)).optional()?;
        
        let id = Uuid::new_v4().to_string();
        
        stmt_insert.execute(params![
            id,
            page_id,
            block_id,
            to_page_id,
            link.link_type,
            link.target_path,
            link.raw_target,
            link.alias,
            link.heading,
            link.block_ref,
            link.is_embed
        ])?;
    }

    Ok(())
}

pub fn reindex_all_links(conn: &mut Connection) -> Result<(), rusqlite::Error> {
    let tx = conn.transaction()?;
    
    // Clear all
    tx.execute("DELETE FROM wiki_links", [])?;
    
    // Fetch all blocks that might have links
    let mut stmt = tx.prepare("SELECT id, page_id, content FROM blocks WHERE content LIKE '%[[%'")?;
    
    let block_iter = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
        ))
    })?;

    // Collect first to avoid borrowing issues with prepared statements
    let blocks: Vec<(String, String, String)> = block_iter.collect::<Result<_, _>>()?;
    
    let mut stmt_resolve = tx.prepare("SELECT page_id FROM page_paths WHERE path_text = ? LIMIT 1")?;
    let mut stmt_insert = tx.prepare(r#"
        INSERT INTO wiki_links (
            id, from_page_id, from_block_id, to_page_id, link_type, 
            target_path, raw_target, alias, heading, block_ref, is_embed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    "#)?;
    
    for (block_id, page_id, content) in blocks {
        let links = parse_wiki_links(&content);
        for link in links {
             let to_page_id: Option<String> = stmt_resolve.query_row(params![link.target_path], |row| row.get(0)).optional()?;
             let id = Uuid::new_v4().to_string();
             stmt_insert.execute(params![
                id,
                page_id,
                block_id,
                to_page_id,
                link.link_type,
                link.target_path,
                link.raw_target,
                link.alias,
                link.heading,
                link.block_ref,
                link.is_embed
            ])?;
        }
    }
    
    tx.commit()?;
    Ok(())
}
