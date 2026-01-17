use crate::services::wiki_link_parser::parse_wiki_links;
use rusqlite::{named_params, Connection, OptionalExtension};
use std::collections::HashMap;
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
         WHERE path_text = :target_path
         UNION
         SELECT page_id FROM page_paths
         WHERE path_text LIKE :pattern AND path_text != :target_path
         UNION
         SELECT page_id FROM page_paths
         WHERE path_text = :target_basename
         LIMIT 1",
    )?;

    stmt.query_row(
        named_params! {
            ":target_path": target_path,
            ":pattern": pattern,
            ":target_basename": target_basename
        },
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
        "DELETE FROM wiki_links WHERE from_block_id = :block_id",
        named_params! { ":block_id": block_id },
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
        ) VALUES (:id, :from_page_id, :from_block_id, :to_page_id, :link_type,
            :target_path, :raw_target, :alias, :heading, :block_ref, :is_embed)
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

        stmt_insert.execute(named_params! {
            ":id": id,
            ":from_page_id": page_id,
            ":from_block_id": block_id,
            ":to_page_id": to_page_id,
            ":link_type": link.link_type,
            ":target_path": link.target_path,
            ":raw_target": link.raw_target,
            ":alias": link.alias,
            ":heading": link.heading,
            ":block_ref": link.block_ref,
            ":is_embed": link.is_embed
        })?;
    }

    Ok(())
}

pub fn reindex_all_links(conn: &mut Connection) -> Result<(), rusqlite::Error> {
    let tx = conn.transaction()?;

    // 1. Pre-load all page paths into memory for O(1) resolution
    // This avoids N+1 DB queries (or 3N queries due to UNION) when resolving targets.
    let mut path_map: HashMap<String, String> = HashMap::new();
    let mut basename_map: HashMap<String, String> = HashMap::new();

    {
        let mut stmt = tx.prepare("SELECT path_text, page_id FROM page_paths")?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;

        for row in rows {
            let (path, page_id) = row?;
            // Map full path -> page_id
            path_map.insert(path.clone(), page_id.clone());

            // Map basename -> page_id (for fuzzy matching)
            // Note: If multiple paths share the same basename, the last one loaded wins.
            // This is acceptable behavior for fuzzy matching where ambiguity exists.
            let basename = path.split('/').last().unwrap_or(&path).to_string();
            basename_map.insert(basename, page_id);
        }
    }

    // 2. Clear existing links
    tx.execute("DELETE FROM wiki_links", [])?;

    let batch_size = 1000;
    let mut offset = 0;

    loop {
        // Fetch blocks in batches
        let mut stmt = tx.prepare(
            "SELECT id, page_id, content FROM blocks WHERE content LIKE '%[[%'
             ORDER BY id LIMIT :limit OFFSET :offset",
        )?;

        let blocks: Vec<(String, String, String)> = {
            let block_iter = stmt.query_map(
                named_params! { ":limit": batch_size, ":offset": offset },
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                    ))
                },
            )?;

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
                ) VALUES (:id, :from_page_id, :from_block_id, :to_page_id, :link_type,
                    :target_path, :raw_target, :alias, :heading, :block_ref, :is_embed)
            "#,
            )?;

            for (block_id, page_id, content) in blocks {
                let links = parse_wiki_links(&content);
                for link in links {
                    // Optimized resolution using in-memory maps
                    let target_basename = link.target_path.split('/').last().unwrap_or(&link.target_path);
                    
                    let to_page_id: Option<String> = path_map
                        .get(&link.target_path)
                        .or_else(|| basename_map.get(target_basename))
                        .cloned();

                    if to_page_id.is_none() {
                        // eprintln!(
                        //     "[reindex_all_links] Unresolved link '{}' in block {} from page {}",
                        //     link.target_path, block_id, page_id
                        // );
                    }

                    let id = Uuid::new_v4().to_string();
                    stmt_insert.execute(named_params! {
                        ":id": id,
                        ":from_page_id": page_id,
                        ":from_block_id": block_id,
                        ":to_page_id": to_page_id,
                        ":link_type": link.link_type,
                        ":target_path": link.target_path,
                        ":raw_target": link.raw_target,
                        ":alias": link.alias,
                        ":heading": link.heading,
                        ":block_ref": link.block_ref,
                        ":is_embed": link.is_embed
                    })?;
                }
            }
        }

        offset += batch_size;
    }

    tx.commit()?;
    Ok(())
}
