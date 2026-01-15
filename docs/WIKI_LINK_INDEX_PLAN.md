# Wiki-Link Index Implementation Plan

## Overview

Implement a robust, incremental wiki-link index to replace string-based `LIKE '%[[Title]]%'` queries. This enables accurate backlinks, graph view, and reliable page rename/move operations.

**Tracking Issue:** #107

---

## Goals

1. Maintain queryable index of wiki links at block granularity
2. Support: `[[Page]]`, `[[A/B/Page]]`, `[[Page|alias]]`, `[[Page#heading]]`, `![[Page]]`
3. Enable correct backlinks, broken link detection, graph view
4. Incremental updates (no full scans on every edit)
5. Deterministic: full rebuild = incremental updates

---

## Data Model

### New Table: `wiki_links`

```sql
CREATE TABLE IF NOT EXISTS wiki_links (
    id TEXT PRIMARY KEY,
    from_page_id TEXT NOT NULL,
    from_block_id TEXT NOT NULL,
    to_page_id TEXT NULL,              -- NULL = unresolved/broken link
    link_type TEXT NOT NULL,           -- 'page_link', 'block_link', 'embed_page', 'embed_block'
    target_path TEXT NOT NULL,         -- normalized path: "A/B/C"
    raw_target TEXT NOT NULL,          -- exact text in [[...]]: "A/B/C|Alias" or "A/B/C#Heading"
    alias TEXT NULL,                   -- part after |
    heading TEXT NULL,                 -- part after #
    block_ref TEXT NULL,               -- ^block-id for block references
    is_embed INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (from_page_id) REFERENCES pages(id) ON DELETE CASCADE,
    FOREIGN KEY (from_block_id) REFERENCES blocks(id) ON DELETE CASCADE,
    FOREIGN KEY (to_page_id) REFERENCES pages(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_wiki_links_to_page ON wiki_links(to_page_id);
CREATE INDEX IF NOT EXISTS idx_wiki_links_target_path ON wiki_links(target_path);
CREATE INDEX IF NOT EXISTS idx_wiki_links_from_page ON wiki_links(from_page_id);
CREATE INDEX IF NOT EXISTS idx_wiki_links_from_block ON wiki_links(from_block_id);
CREATE INDEX IF NOT EXISTS idx_wiki_links_type ON wiki_links(link_type);
```

### Link Type Examples

- `[[Page]]` → `link_type='page_link', is_embed=0, block_ref=NULL`
- `[[Page#^block-id]]` → `link_type='block_link', block_ref='block-id'`
- `![[Page]]` → `link_type='embed_page', is_embed=1`
- `![[Page#^block-id]]` → `link_type='embed_block', is_embed=1, block_ref='block-id'`

---

## Parsing Rules (Normalization)

### Wiki-Link Regex Pattern

```rust
// Pattern for wiki links: [[target]], [[target|alias]], [[target#heading]], ![[target]]
const WIKI_LINK_REGEX: &str = r"(!?)\[\[([^\]]+)\]\]";

// Breakdown:
// (!?)              - optional embed marker
// \[\[              - opening [[
// ([^\]]+)          - capture group: anything except ]
// \]\]              - closing ]]
```

### Target Normalization Rules

1. **Extract components from raw target:**
   - Split by `|` → left = path+heading, right = alias
   - Split left by `#` → left = path, right = heading/block_ref
   - If heading starts with `^` → block_ref, else heading

2. **Normalize target_path:**
   - Replace `\` with `/`
   - Trim whitespace per segment
   - Remove trailing `.md` extension
   - Preserve case (case-sensitive resolution)
   - Result: `"A/B/C"` or `"Page"`

3. **Examples:**
   ```
   [[A/B/C]]           → target_path="A/B/C", alias=NULL, heading=NULL
   [[A/B/C|Alias]]     → target_path="A/B/C", alias="Alias"
   [[A/B/C#Heading]]   → target_path="A/B/C", heading="Heading"
   [[A/B/C#^block-id]] → target_path="A/B/C", block_ref="block-id"
   ![[A/B/C]]          → is_embed=1, target_path="A/B/C"
   ```

### Exclusions (Do Not Index)

- Links inside fenced code blocks (` ```...``` `)
- Links inside inline code (`` `...` ``)
- Links inside HTML comments (`<!-- ... -->`)

### Resolution: target_path → to_page_id

```sql
-- Use page_paths table for resolution
SELECT page_id FROM page_paths WHERE path_text = :target_path LIMIT 1;
```

If no match found: `to_page_id = NULL` (broken link)

---

## Implementation Phases

### Phase 1: Foundation (MVP)

**Scope:** Page links only, basic backlinks

**Files to Create/Modify:**

1. **`src-tauri/src/db/schema.rs`**
   - Add `wiki_links` table to `SCHEMA_SQL`
   - Add migration in `migrate_schema()` to create table + indexes

2. **`src-tauri/src/models/wiki_link.rs`** (new)
   ```rust
   #[derive(Debug, Clone, Serialize, Deserialize)]
   pub struct WikiLink {
       pub id: String,
       pub from_page_id: String,
       pub from_block_id: String,
       pub to_page_id: Option<String>,
       pub link_type: String,
       pub target_path: String,
       pub raw_target: String,
       pub alias: Option<String>,
       pub heading: Option<String>,
       pub block_ref: Option<String>,
       pub is_embed: bool,
   }
   ```

3. **`src-tauri/src/services/wiki_link_parser.rs`** (new)
   ```rust
   use regex::Regex;
   
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
       // Extract links using WIKI_LINK_REGEX
       // Skip links in code blocks/inline code
       // Normalize each link
       // Return parsed links
   }
   
   fn normalize_target_path(raw: &str) -> String {
       // Apply normalization rules
   }
   ```

4. **`src-tauri/src/services/wiki_link_index.rs`** (new)
   ```rust
   use rusqlite::Connection;
   
   pub fn index_block_links(
       conn: &Connection,
       block_id: &str,
       block_content: &str,
       page_id: &str,
   ) -> Result<(), rusqlite::Error> {
       // DELETE FROM wiki_links WHERE from_block_id = ?
       // Parse links from block_content
       // Resolve target_path -> to_page_id via page_paths
       // INSERT new wiki_links rows
   }
   
   pub fn index_page_links(
       conn: &Connection,
       page_id: &str,
   ) -> Result<(), rusqlite::Error> {
       // Fetch all blocks for page_id
       // For each block: index_block_links()
   }
   
   pub fn reindex_all_links(conn: &Connection) -> Result<(), rusqlite::Error> {
       // DELETE FROM wiki_links
       // For each page: index_page_links()
   }
   ```

5. **`src-tauri/src/commands/wiki_link.rs`** (new)
   ```rust
   #[tauri::command]
   pub fn get_page_backlinks(
       page_id: String,
       db_path: String,
   ) -> Result<Vec<BacklinkGroup>, String> {
       // Query: SELECT * FROM wiki_links WHERE to_page_id = ?
       // Group by from_page_id
       // Return structure: Vec<{ page_id, page_title, blocks: Vec<{ block_id, content }> }>
   }
   
   #[tauri::command]
   pub fn get_broken_links(db_path: String) -> Result<Vec<WikiLink>, String> {
       // Query: SELECT * FROM wiki_links WHERE to_page_id IS NULL
   }
   
   #[tauri::command]
   pub fn reindex_wiki_links(db_path: String) -> Result<(), String> {
       // Call reindex_all_links()
   }
   ```

6. **`src-tauri/src/commands/mod.rs`**
   - Add `pub mod wiki_link;`

7. **`src-tauri/src/lib.rs`**
   - Register commands:
     ```rust
     .invoke_handler(tauri::generate_handler![
         // ... existing commands
         commands::wiki_link::get_page_backlinks,
         commands::wiki_link::get_broken_links,
         commands::wiki_link::reindex_wiki_links,
     ])
     ```

8. **Modify `src-tauri/src/commands/block.rs`**
   - In `update_block()` or `save_block()`:
     ```rust
     // After updating block content in DB
     wiki_link_index::index_block_links(&conn, &block_id, &new_content, &page_id)?;
     ```

9. **Frontend API (`src/tauri-api.ts`)**
   ```typescript
   export async function getPageBacklinks(pageId: string): Promise<BacklinkGroup[]> {
     return invoke('get_page_backlinks', { pageId, dbPath: getDbPath() });
   }
   
   export async function reindexWikiLinks(): Promise<void> {
     return invoke('reindex_wiki_links', { dbPath: getDbPath() });
   }
   ```

**Testing:**
- Unit test: `wiki_link_parser::parse_wiki_links()` with various inputs
- Integration test: Create blocks with links → verify `wiki_links` rows
- Test backlinks query correctness

**Acceptance Criteria:**
- `[[A/B/C]]`, `[[A/B/C|Alias]]`, `[[A/B/C#Heading]]` parsed correctly
- Backlinks query returns accurate results (no false positives)
- Block edit triggers incremental index update
- Full reindex produces same results as incremental

---

### Phase 2: Block References & Embeds

**Scope:** `[[Page#^block-id]]`, `![[Page]]`, `![[Page#^block-id]]`

**Additional Work:**

1. **Extend parser** in `wiki_link_parser.rs`:
   - Detect `^block-id` in heading part
   - Set `link_type='block_link'` or `'embed_block'`

2. **Block reference resolution:**
   - Query `blocks.id` for `^block-id` format
   - Store in `wiki_links.block_ref`

3. **Commands:**
   ```rust
   #[tauri::command]
   pub fn get_block_backlinks(block_id: String, db_path: String) -> Result<Vec<BacklinkGroup>, String> {
       // Query: SELECT * FROM wiki_links WHERE to_block_id = ? OR block_ref = ?
   }
   ```

4. **Frontend:**
   - Display embed previews for `is_embed=1`
   - Click block link → jump to specific block

---

### Phase 3: Graph View & Advanced Features

**Scope:** Graph visualization, broken link detection UI

**Features:**

1. **Graph query command:**
   ```rust
   #[tauri::command]
   pub fn get_graph_data(db_path: String) -> Result<GraphData, String> {
       // Query: SELECT from_page_id, to_page_id, COUNT(*) as weight
       //        FROM wiki_links WHERE to_page_id IS NOT NULL
       //        GROUP BY from_page_id, to_page_id
       // Return: { nodes: Vec<{ id, title }>, edges: Vec<{ source, target, weight }> }
   }
   ```

2. **Broken links UI:**
   - Show all `wiki_links` where `to_page_id IS NULL`
   - Allow creating missing pages

3. **Unlinked mentions:**
   - Search block content for page titles NOT in `wiki_links`

4. **Link autocomplete ranking:**
   - ORDER BY popularity (outlink count from `wiki_links`)

---

## Page Rename/Move Integration

**Goal:** Update all references when page path changes

**Implementation:**

1. **Find affected links:**
   ```sql
   SELECT * FROM wiki_links WHERE to_page_id = :page_id OR target_path = :old_path;
   ```

2. **Rewrite block content:**
   - For each affected `from_block_id`:
     - Load block content
     - Replace `[[old_path]]` with `[[new_path]]` (preserve alias/heading)
     - Save block content to DB + filesystem

3. **Update wiki_links:**
   ```sql
   UPDATE wiki_links SET target_path = :new_path, updated_at = CURRENT_TIMESTAMP
   WHERE to_page_id = :page_id OR target_path = :old_path;
   ```

4. **Integrate into existing rename command:**
   - Modify `src-tauri/src/commands/page.rs::rename_page()` or similar
   - Call link rewrite logic before/after page rename

---

## Migration Strategy

### Step 1: DB Migration

Add to `src-tauri/src/db/schema.rs::migrate_schema()`:

```rust
// Check if wiki_links table exists
let has_wiki_links: bool = conn
    .query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='wiki_links'",
        [],
        |row| row.get::<_, i32>(0),
    )
    .map(|count| count > 0)
    .unwrap_or(false);

if !has_wiki_links {
    conn.execute_batch(r#"
        CREATE TABLE wiki_links (
            id TEXT PRIMARY KEY,
            from_page_id TEXT NOT NULL,
            from_block_id TEXT NOT NULL,
            to_page_id TEXT NULL,
            link_type TEXT NOT NULL,
            target_path TEXT NOT NULL,
            raw_target TEXT NOT NULL,
            alias TEXT NULL,
            heading TEXT NULL,
            block_ref TEXT NULL,
            is_embed INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (from_page_id) REFERENCES pages(id) ON DELETE CASCADE,
            FOREIGN KEY (from_block_id) REFERENCES blocks(id) ON DELETE CASCADE,
            FOREIGN KEY (to_page_id) REFERENCES pages(id) ON DELETE SET NULL
        );

        CREATE INDEX idx_wiki_links_to_page ON wiki_links(to_page_id);
        CREATE INDEX idx_wiki_links_target_path ON wiki_links(target_path);
        CREATE INDEX idx_wiki_links_from_page ON wiki_links(from_page_id);
        CREATE INDEX idx_wiki_links_from_block ON wiki_links(from_block_id);
        CREATE INDEX idx_wiki_links_type ON wiki_links(link_type);
    "#)?;
}
```

### Step 2: Initial Reindex

On first app launch after migration:
- Detect empty `wiki_links` table
- Trigger `reindex_wiki_links()` in background
- Show progress indicator (optional)

Or: Add workspace command to manually trigger reindex

### Step 3: Switch Backlinks

Replace any existing backlink query logic to use `wiki_links` table instead of `LIKE` queries.

---

## Testing Checklist

### Parser Tests

- [ ] `[[Page]]` → `target_path="Page"`
- [ ] `[[A/B/C]]` → `target_path="A/B/C"`
- [ ] `[[A\\B\\C]]` → `target_path="A/B/C"` (Windows path)
- [ ] `[[Page.md]]` → `target_path="Page"` (strip .md)
- [ ] `[[Page|Alias]]` → `alias="Alias"`
- [ ] `[[Page#Heading]]` → `heading="Heading"`
- [ ] `[[Page#^block-id]]` → `block_ref="block-id"`
- [ ] `![[Page]]` → `is_embed=1`
- [ ] Skip links in `` `[[code]]` ``
- [ ] Skip links in ` ```\n[[code]]\n``` `

### Index Tests

- [ ] Create block with `[[Page]]` → `wiki_links` row created
- [ ] Update block content → old links deleted, new links inserted
- [ ] Delete block → `wiki_links` rows cascade deleted
- [ ] Broken link: `[[NonExistent]]` → `to_page_id=NULL`
- [ ] Resolved link: target exists → `to_page_id` populated

### Backlinks Tests

- [ ] Query backlinks for page with multiple incoming links
- [ ] Query returns correct grouping by source page
- [ ] No false positives (e.g., `[[Other]]` doesn't match `[[Another]]`)

### Rename Tests

- [ ] Rename page → all references updated in block content
- [ ] Rename page → `wiki_links.target_path` updated
- [ ] Alias preserved after rename: `[[Old|Alias]]` → `[[New|Alias]]`
- [ ] Heading preserved: `[[Old#Heading]]` → `[[New#Heading]]`

### Performance Tests

- [ ] 1000 pages, 10000 blocks → backlinks query < 100ms
- [ ] Full reindex on large workspace completes in reasonable time
- [ ] Incremental update (single block) < 10ms

---

## File Checklist

### New Files

- [ ] `src-tauri/src/models/wiki_link.rs`
- [ ] `src-tauri/src/services/wiki_link_parser.rs`
- [ ] `src-tauri/src/services/wiki_link_index.rs`
- [ ] `src-tauri/src/commands/wiki_link.rs`

### Modified Files

- [ ] `src-tauri/src/db/schema.rs` - add table + migration
- [ ] `src-tauri/src/commands/mod.rs` - register wiki_link module
- [ ] `src-tauri/src/services/mod.rs` - register parser + index modules
- [ ] `src-tauri/src/models/mod.rs` - register wiki_link model
- [ ] `src-tauri/src/lib.rs` - register commands
- [ ] `src-tauri/src/commands/block.rs` - trigger index update on block save
- [ ] `src/tauri-api.ts` - add frontend API functions

---

## Dependencies

Add to `src-tauri/Cargo.toml`:

```toml
[dependencies]
regex = "1.10"  # (likely already present)
```

---

## Commit Strategy

### Phase 1 Commits:

1. `feat(db): add wiki_links table and migration`
2. `feat(wiki-link): add parser for wiki-link extraction`
3. `feat(wiki-link): add index service for incremental updates`
4. `feat(wiki-link): add backlinks command using wiki_links`
5. `feat(block): trigger wiki-link index on block save`
6. `feat(frontend): add wiki-link API wrapper`
7. `test(wiki-link): add parser and index tests`

### Phase 2 Commits:

8. `feat(wiki-link): support block references #^id`
9. `feat(wiki-link): support embeds ![[...]]`
10. `feat(wiki-link): add block backlinks command`

### Phase 3 Commits:

11. `feat(graph): add graph data query command`
12. `feat(wiki-link): add broken links detection`
13. `feat(ui): add graph view component`

---

## Notes for AI Agents

- **Do NOT** create all files at once. Implement phase-by-phase.
- **Test incrementally** after each commit.
- **Lint before committing:** `npm run lint`
- **Follow AGENTS.md** for commit format and workflow.
- **Use existing patterns:** Study `src-tauri/src/commands/block.rs` and `src-tauri/src/services/file_sync.rs` for DB transaction patterns.
- **UUID generation:** Use `uuid::Uuid::new_v4().to_string()` for `id` fields.
- **Error handling:** Always use `Result<T, String>` in commands, map errors with `.map_err(|e| e.to_string())`.
- **Regex crate:** Compile regex once using `lazy_static` or `once_cell` for performance.
- **Code blocks detection:** Track fence state while parsing to exclude links in code blocks.