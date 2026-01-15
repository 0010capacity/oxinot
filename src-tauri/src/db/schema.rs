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
    file_mtime INTEGER,  -- 파일 수정 시간 (Unix timestamp) for incremental sync
    file_size INTEGER,   -- 파일 크기 (bytes) for incremental sync
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

-- 블록 메타데이터 (key::value 형식)
CREATE TABLE IF NOT EXISTS block_metadata (
    id TEXT PRIMARY KEY,
    block_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_block_metadata_block ON block_metadata(block_id);
CREATE INDEX IF NOT EXISTS idx_block_metadata_key ON block_metadata(key);

-- FTS: 링크 제안/검색을 위한 블록 검색 인덱스 (content + anchor id + path 캐시)
-- NOTE: 이 테이블은 파생 데이터이며, 리빌드/리인덱싱 시 재생성될 수 있음.
-- anchor_id는 마크다운 파일에만 숨겨 저장되는 "ID::<uuid>"에서 추출되어 blocks.id와 일치하도록 유지된다.
CREATE VIRTUAL TABLE IF NOT EXISTS blocks_fts USING fts5(
    block_id UNINDEXED,
    page_id UNINDEXED,
    content,
    anchor_id,
    path_text,
    tokenize = 'unicode61'
);

-- NOTE: SQLite virtual tables (including FTS5) may not be indexed with CREATE INDEX.
-- FTS provides its own indexing; if you need filtering by page_id, store it as UNINDEXED
-- and filter in queries, or use the FTS 'rowid' + auxiliary mapping table.

-- 페이지 경로 캐시 (페이지 링크 [[A/B/C]] 제안/해결에 사용)
CREATE TABLE IF NOT EXISTS page_paths (
    page_id TEXT PRIMARY KEY,
    path_text TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_page_paths_text ON page_paths(path_text);

-- 블록 경로 캐시 (블록 링크 제안에서 표시용: "A/B/C > X > Y")
-- 실제 링크 삽입은 (())에 UUID를 쓰는 정책이므로, path_text는 검색/표시에만 사용.
CREATE TABLE IF NOT EXISTS block_paths (
    block_id TEXT PRIMARY KEY,
    page_id TEXT NOT NULL,
    path_text TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE,
    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_block_paths_page ON block_paths(page_id);
CREATE INDEX IF NOT EXISTS idx_block_paths_text ON block_paths(path_text);
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

    // Check if file_mtime column exists in pages table
    let has_file_mtime: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('pages') WHERE name='file_mtime'",
            [],
            |row| row.get::<_, i32>(0),
        )
        .map(|count| count > 0)
        .unwrap_or(false);

    if !has_file_mtime {
        // Add file_mtime column
        conn.execute("ALTER TABLE pages ADD COLUMN file_mtime INTEGER", [])?;
    }

    // Check if file_size column exists in pages table
    let has_file_size: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('pages') WHERE name='file_size'",
            [],
            |row| row.get::<_, i32>(0),
        )
        .map(|count| count > 0)
        .unwrap_or(false);

    if !has_file_size {
        // Add file_size column
        conn.execute("ALTER TABLE pages ADD COLUMN file_size INTEGER", [])?;
    }

    // Ensure auxiliary cache tables/fts exist for older DBs
    conn.execute_batch(
        r#"
        CREATE VIRTUAL TABLE IF NOT EXISTS blocks_fts USING fts5(
            block_id UNINDEXED,
            page_id UNINDEXED,
            content,
            anchor_id,
            path_text,
            tokenize = 'unicode61'
        );

        -- NOTE: SQLite virtual tables (including FTS5) may not be indexed with CREATE INDEX.
        -- FTS provides its own indexing; if you need filtering by page_id, store it as UNINDEXED
        -- and filter in queries, or use the FTS 'rowid' + auxiliary mapping table.

        CREATE TABLE IF NOT EXISTS page_paths (
            page_id TEXT PRIMARY KEY,
            path_text TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_page_paths_text ON page_paths(path_text);

        CREATE TABLE IF NOT EXISTS block_paths (
            block_id TEXT PRIMARY KEY,
            page_id TEXT NOT NULL,
            path_text TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE,
            FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_block_paths_page ON block_paths(page_id);
        CREATE INDEX IF NOT EXISTS idx_block_paths_text ON block_paths(path_text);

        CREATE TABLE IF NOT EXISTS block_metadata (
            id TEXT PRIMARY KEY,
            block_id TEXT NOT NULL,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_block_metadata_block ON block_metadata(block_id);
        CREATE INDEX IF NOT EXISTS idx_block_metadata_key ON block_metadata(key);
        "#,
    )?;

    Ok(())
}
