/// Database schema initialization
pub const SCHEMA_SQL: &str = r#"
-- 워크스페이스 설정
CREATE TABLE IF NOT EXISTS workspace (
    id TEXT PRIMARY KEY DEFAULT 'default',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 페이지 (각 .md 파일 = 하나의 페이지)
CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    parent_id TEXT,  -- NULL = 루트 레벨 페이지
    file_path TEXT,  -- 미러링될 마크다운 파일 경로
    is_directory INTEGER DEFAULT 0,  -- 1 = 폴더로 전환됨 (하위 페이지 있음)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (parent_id) REFERENCES pages(id) ON DELETE CASCADE
);

-- 블록 (핵심 테이블)
CREATE TABLE IF NOT EXISTS blocks (
    id TEXT PRIMARY KEY,
    page_id TEXT NOT NULL,
    parent_id TEXT,  -- NULL = 페이지의 루트 레벨 블록
    content TEXT NOT NULL DEFAULT '',
    order_weight REAL NOT NULL,  -- Fractional Indexing용
    is_collapsed INTEGER DEFAULT 0,
    block_type TEXT DEFAULT 'bullet',  -- 'bullet' | 'code' | 'fence'
    language TEXT,  -- 코드 블록의 언어
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES blocks(id) ON DELETE SET NULL
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_blocks_page ON blocks(page_id);
CREATE INDEX IF NOT EXISTS idx_blocks_parent ON blocks(parent_id);
CREATE INDEX IF NOT EXISTS idx_blocks_order ON blocks(page_id, parent_id, order_weight);

-- 블록 참조 (백링크, Phase 2에서 구현)
CREATE TABLE IF NOT EXISTS block_refs (
    id TEXT PRIMARY KEY,
    from_block_id TEXT NOT NULL,
    to_block_id TEXT NOT NULL,
    ref_type TEXT DEFAULT 'link',  -- 'link' | 'embed'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (from_block_id) REFERENCES blocks(id) ON DELETE CASCADE,
    FOREIGN KEY (to_block_id) REFERENCES blocks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_refs_from ON block_refs(from_block_id);
CREATE INDEX IF NOT EXISTS idx_refs_to ON block_refs(to_block_id);
"#;

/// Initialize the database schema
pub fn init_schema(conn: &rusqlite::Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(SCHEMA_SQL)?;

    // Run migrations
    migrate_schema(conn)?;

    Ok(())
}

/// Run database migrations
fn migrate_schema(conn: &rusqlite::Connection) -> Result<(), rusqlite::Error> {
    // Check if parent_id column exists in pages table
    let has_parent_id: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('pages') WHERE name='parent_id'",
            [],
            |row| row.get::<_, i32>(0),
        )
        .map(|count| count > 0)
        .unwrap_or(false);

    if !has_parent_id {
        // Add parent_id column
        conn.execute("ALTER TABLE pages ADD COLUMN parent_id TEXT", [])?;

        // Add foreign key index (can't add FK constraint to existing table)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_pages_parent ON pages(parent_id)",
            [],
        )?;
    }

    // Check if is_directory column exists in pages table
    let has_is_directory: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('pages') WHERE name='is_directory'",
            [],
            |row| row.get::<_, i32>(0),
        )
        .map(|count| count > 0)
        .unwrap_or(false);

    if !has_is_directory {
        // Add is_directory column
        conn.execute(
            "ALTER TABLE pages ADD COLUMN is_directory INTEGER DEFAULT 0",
            [],
        )?;
    }

    // Check if path column exists in workspace table
    let has_path: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('workspace') WHERE name='path'",
            [],
            |row| row.get::<_, i32>(0),
        )
        .map(|count| count > 0)
        .unwrap_or(false);

    if !has_path {
        // Add path column
        conn.execute("ALTER TABLE workspace ADD COLUMN path TEXT", [])?;
    }

    Ok(())
}
