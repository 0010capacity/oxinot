use rusqlite::{params, Connection};

/// Service for managing FTS5 (Full-Text Search 5) indexing
pub struct FtsService;

impl FtsService {
    /// Index a single block in the FTS5 table
    pub fn index_block(
        conn: &Connection,
        block_id: &str,
        page_id: &str,
        content: &str,
    ) -> Result<(), String> {
        conn.execute(
            "INSERT OR REPLACE INTO blocks_fts (block_id, page_id, content, anchor_id, path_text)
             VALUES (?, ?, ?, ?, ?)",
            params![block_id, page_id, content, block_id, ""],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Remove a block from the FTS5 index
    pub fn deindex_block(conn: &Connection, block_id: &str) -> Result<(), String> {
        conn.execute(
            "DELETE FROM blocks_fts WHERE block_id = ?",
            params![block_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Update block content in the FTS5 index
    pub fn update_block_index(
        conn: &Connection,
        block_id: &str,
        content: &str,
    ) -> Result<(), String> {
        conn.execute(
            "UPDATE blocks_fts SET content = ? WHERE block_id = ?",
            params![content, block_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Rebuild the entire FTS5 index from blocks table
    /// This is useful after data migrations or corruption
    pub fn rebuild_index(conn: &Connection) -> Result<usize, String> {
        // Clear existing index
        conn.execute("DELETE FROM blocks_fts", [])
            .map_err(|e| e.to_string())?;

        // Rebuild from blocks table
        let mut stmt = conn
            .prepare(
                "SELECT b.id, b.page_id, b.content
                 FROM blocks b
                 JOIN pages p ON b.page_id = p.id
                 WHERE p.is_deleted = 0",
            )
            .map_err(|e| e.to_string())?;

        let block_iter = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        let mut count = 0;
        for result in block_iter {
            let (block_id, page_id, content) = result.map_err(|e| e.to_string())?;
            Self::index_block(conn, &block_id, &page_id, &content)?;
            count += 1;
        }

        Ok(count)
    }

    /// Rebuild index for a specific page and its blocks
    pub fn rebuild_page_index(conn: &Connection, page_id: &str) -> Result<usize, String> {
        // Remove existing index entries for this page
        conn.execute("DELETE FROM blocks_fts WHERE page_id = ?", params![page_id])
            .map_err(|e| e.to_string())?;

        // Rebuild from blocks table for this page
        let mut stmt = conn
            .prepare(
                "SELECT id, page_id, content
                 FROM blocks
                 WHERE page_id = ?",
            )
            .map_err(|e| e.to_string())?;

        let block_iter = stmt
            .query_map(params![page_id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        let mut count = 0;
        for result in block_iter {
            let (block_id, page_id, content) = result.map_err(|e| e.to_string())?;
            Self::index_block(conn, &block_id, &page_id, &content)?;
            count += 1;
        }

        Ok(count)
    }

    /// Search blocks using FTS5 with BM25 ranking
    /// Returns (block_id, page_id, content, page_title, rank)
    pub fn search_blocks(
        conn: &Connection,
        fts_query: &str,
        limit: u32,
    ) -> Result<Vec<(String, String, String, String, f64)>, String> {
        let mut stmt = conn
            .prepare(
                "SELECT b.id, b.page_id, b.content, p.title, rank
                 FROM blocks_fts fts
                 JOIN blocks b ON fts.block_id = b.id
                 JOIN pages p ON b.page_id = p.id
                 WHERE blocks_fts MATCH ?1
                 AND p.is_deleted = 0
                 ORDER BY rank, p.title COLLATE NOCASE, b.order_weight
                 LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;

        let results = stmt
            .query_map(params![fts_query, limit as i32], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, f64>(4)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        let mut search_results = Vec::new();
        for result in results {
            search_results.push(result.map_err(|e| e.to_string())?);
        }

        Ok(search_results)
    }

    /// Get index statistics (for debugging and optimization)
    pub fn get_index_stats(conn: &Connection) -> Result<IndexStats, String> {
        let mut stmt = conn
            .prepare("SELECT COUNT(*) as total_indexed FROM blocks_fts")
            .map_err(|e| e.to_string())?;

        let total_indexed: usize = stmt
            .query_row([], |row| row.get(0))
            .map_err(|e| e.to_string())?;

        let mut stmt = conn
            .prepare("SELECT COUNT(*) as total_blocks FROM blocks WHERE true")
            .map_err(|e| e.to_string())?;

        let total_blocks: usize = stmt
            .query_row([], |row| row.get(0))
            .map_err(|e| e.to_string())?;

        let mut stmt = conn
            .prepare(
                "SELECT COUNT(*) FROM blocks
                 WHERE id NOT IN (SELECT block_id FROM blocks_fts)",
            )
            .map_err(|e| e.to_string())?;

        let missing_from_index: usize = stmt
            .query_row([], |row| row.get(0))
            .map_err(|e| e.to_string())?;

        Ok(IndexStats {
            total_indexed,
            total_blocks,
            missing_from_index,
            index_coverage: if total_blocks > 0 {
                ((total_indexed as f64) / (total_blocks as f64)) * 100.0
            } else {
                100.0
            },
        })
    }

    /// Verify and repair index consistency
    /// Returns (blocks_reindexed, blocks_removed)
    pub fn verify_and_repair_index(conn: &Connection) -> Result<(usize, usize), String> {
        // Find blocks in index that don't exist in blocks table
        let mut stmt = conn
            .prepare(
                "SELECT block_id FROM blocks_fts WHERE block_id NOT IN (SELECT id FROM blocks)",
            )
            .map_err(|e| e.to_string())?;

        let orphan_ids: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        let mut removed_count = 0;
        for block_id in orphan_ids {
            Self::deindex_block(conn, &block_id)?;
            removed_count += 1;
        }

        // Find blocks not in index and add them
        let mut stmt = conn
            .prepare(
                "SELECT b.id, b.page_id, b.content
                 FROM blocks b
                 WHERE b.id NOT IN (SELECT block_id FROM blocks_fts)",
            )
            .map_err(|e| e.to_string())?;

        let missing_iter = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        let mut reindexed_count = 0;
        for result in missing_iter {
            let (block_id, page_id, content) = result.map_err(|e| e.to_string())?;
            Self::index_block(conn, &block_id, &page_id, &content)?;
            reindexed_count += 1;
        }

        Ok((reindexed_count, removed_count))
    }
}

/// Statistics about the FTS5 index
#[derive(Debug, Clone)]
pub struct IndexStats {
    pub total_indexed: usize,
    pub total_blocks: usize,
    pub missing_from_index: usize,
    pub index_coverage: f64, // 0-100%
}

impl IndexStats {
    pub fn is_healthy(&self) -> bool {
        self.missing_from_index == 0 && self.index_coverage >= 99.9
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(include_str!("../db/schema.rs")).unwrap();
        conn
    }

    #[test]
    fn test_index_block() {
        let conn = create_test_db();

        // Insert test data
        conn.execute("INSERT INTO workspace (id) VALUES ('default')", [])
            .unwrap();

        conn.execute(
            "INSERT INTO pages (id, title) VALUES ('page1', 'Test Page')",
            [],
        )
        .unwrap();

        let result = FtsService::index_block(&conn, "block1", "page1", "test content");
        assert!(result.is_ok());

        let mut stmt = conn
            .prepare("SELECT COUNT(*) FROM blocks_fts WHERE block_id = 'block1'")
            .unwrap();
        let count: usize = stmt.query_row([], |row| row.get(0)).unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_deindex_block() {
        let conn = create_test_db();

        conn.execute("INSERT INTO workspace (id) VALUES ('default')", [])
            .unwrap();

        conn.execute(
            "INSERT INTO pages (id, title) VALUES ('page1', 'Test Page')",
            [],
        )
        .unwrap();

        FtsService::index_block(&conn, "block1", "page1", "test content").unwrap();

        let result = FtsService::deindex_block(&conn, "block1");
        assert!(result.is_ok());

        let mut stmt = conn
            .prepare("SELECT COUNT(*) FROM blocks_fts WHERE block_id = 'block1'")
            .unwrap();
        let count: usize = stmt.query_row([], |row| row.get(0)).unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn test_update_block_index() {
        let conn = create_test_db();

        conn.execute("INSERT INTO workspace (id) VALUES ('default')", [])
            .unwrap();

        conn.execute(
            "INSERT INTO pages (id, title) VALUES ('page1', 'Test Page')",
            [],
        )
        .unwrap();

        FtsService::index_block(&conn, "block1", "page1", "old content").unwrap();
        let result = FtsService::update_block_index(&conn, "block1", "new content");
        assert!(result.is_ok());

        let mut stmt = conn
            .prepare("SELECT content FROM blocks_fts WHERE block_id = 'block1'")
            .unwrap();
        let content: String = stmt.query_row([], |row| row.get(0)).unwrap();
        assert_eq!(content, "new content");
    }
}
