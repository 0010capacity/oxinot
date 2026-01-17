use crate::services::wiki_link_parser::parse_wiki_links;
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

fn resolve_link_target(
    conn: &Connection,
    target_path: &str,
) -> Result<Option<String>, rusqlite::Error> {
    let target_basename = target_path.split('/').last().unwrap_or(target_path);
    let pattern = format!("%/{}", target_basename);

    // Single query with priority: exact match > pattern match > basename match
    let mut stmt = conn.prepare(
        "SELECT page_id FROM page_paths
         WHERE path_text = ?
         UNION
         SELECT page_id FROM page_paths
         WHERE path_text LIKE ? AND path_text != ?
         UNION
         SELECT page_id FROM page_paths
         WHERE path_text = ?
         LIMIT 1",
    )?;

    stmt.query_row(
        params![target_path, pattern, target_path, target_basename],
        |row| row.get(0),
    )
    .optional()
}

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
    let mut stmt_insert = conn.prepare(
        r#"
        INSERT INTO wiki_links (
            id, from_page_id, from_block_id, to_page_id, link_type,
            target_path, raw_target, alias, heading, block_ref, is_embed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    "#,
    )?;

    for link in links {
        let to_page_id: Option<String> = resolve_link_target(&conn, &link.target_path)?;

        if to_page_id.is_none() {
            eprintln!(
                "[index_block_links] Unresolved link '{}' in block {} from page {}",
                link.target_path, block_id, page_id
            );
        }

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

    let batch_size = 1000;
    let mut offset = 0;

    loop {
        // Fetch blocks in batches to avoid OOM with large datasets
        let mut stmt = tx.prepare(
            "SELECT id, page_id, content FROM blocks WHERE content LIKE '%[[%'
             ORDER BY id LIMIT ? OFFSET ?",
        )?;

        let blocks: Vec<(String, String, String)> = {
            let block_iter = stmt.query_map(params![batch_size, offset], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })?;

            block_iter.collect::<Result<_, _>>()?
        };

        if blocks.is_empty() {
            break;
        }

        {
            let mut stmt_insert = tx.prepare(
                r#"
                INSERT INTO wiki_links (
                    id, from_page_id, from_block_id, to_page_id, link_type,
                    target_path, raw_target, alias, heading, block_ref, is_embed
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
            )?;

            for (block_id, page_id, content) in blocks {
                let links = parse_wiki_links(&content);
                for link in links {
                    let to_page_id: Option<String> = resolve_link_target(&tx, &link.target_path)?;

                    if to_page_id.is_none() {
                        eprintln!(
                            "[reindex_all_links] Unresolved link '{}' in block {} from page {}",
                            link.target_path, block_id, page_id
                        );
                    }

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
        }

        offset += batch_size;
    }

    tx.commit()?;
    Ok(())
}
