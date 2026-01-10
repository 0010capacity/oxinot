# AI Handoff Notes (Directory-Notes + Sync/Indexing + Git/DB)

Audience: another coding agent. Goal: produce consistent-quality changes even with weak agent reasoning.

This document is intentionally **prescriptive**: it defines invariants, forbidden states, concrete patch steps, and “grep targets” to find all relevant code paths.

---

## Hard Invariants (Do Not Violate)

### I1: Directory-note rule (fixed)
- `DirName/DirName.md` is the **content file for the directory page** `DirName`.
- `DirName/DirName.md` must **NEVER** appear as its own page node (tree/search/list).
- When scanning a directory:
  - Create/resolve the directory page from `Dir/Dir.md` (if exists)
  - Recurse children with that page as parent
  - Ignore `Dir/Dir.md` as a regular file

### I2: Git is the cross-machine truth; DB is disposable cache
- The workspace DB is excluded from Git.
- Therefore **files are the durable shared artifact**, DB must be reconstructible from files at any time.
- After `git pull`, the app must restore DB state by running file→DB sync.

### I3: `pages.file_path` must be workspace-relative (mandatory for Git workflow)
Storing absolute paths breaks mapping across machines.

**Allowed**: `Test4/Welcome/NewNote1.md`  
**Forbidden**: `/Users/alice/.../repo/Test4/Welcome/NewNote1.md`

All DB comparisons, orphan detection, and sync mappings must use **workspace-relative** file paths only.

When reading/writing the actual file:
- compute absolute path as `workspace_path.join(file_path_relative)`

### I4: Canonical markdown format must be stable
Current markdown round-trip is NOT symmetric:
- parser treats all non-empty lines as bullets (and strips leading `- ` only)
- serializer outputs bullet markdown exclusively

Therefore, either:
- (Preferred short-term) standardize on bullet-only markdown canonical format (including creation), OR
- implement a heading block type and round-trip support.

Do not mix heading-based creation (`# Title`) with bullet-only serializer unless you accept heading loss.

---

## Current Known Issues / Risks

### R1: Absolute path persistence will break “PC1 push → PC2 pull”
If DB stores absolute paths, a pulled repo on another machine cannot map files to DB rows reliably.

Symptoms:
- pages duplicate or disappear
- orphan deletion removes the wrong rows
- incremental detection fails because `existing_pages` keys never match scanned paths

This must be fixed with I3.

### R2: Two-way DB↔file syncing can rewrite content shape
DB→file mirroring happens in block CRUD. If DB blocks don’t represent headings, writing will canonicalize to bullets (possibly “two empty bullets” etc).

This is not “random”; it’s a deterministic consequence of the current parser/serializer mismatch.

---

## What Changed Recently (Already Done)
- Sync/index engine was unified on filesystem-driven recursion in `src-tauri/src/commands/workspace.rs`.
- Full reindex wipes DB then uses filesystem-driven sync. (Prevents Dir/Dir.md duplication.)
- Incremental reindex uses mtime+size and regenerates blocks only when changed.
- Legacy WalkDir-based `WorkspaceSyncService` was removed.

---

## REQUIRED REDESIGN (Prescriptive Patch Plan)

### P0 (Mandatory): Convert entire system to workspace-relative `pages.file_path`
This is the main architectural gap for Git-based multi-machine editing.

#### Definition
Let:
- `workspace_root`: absolute path selected by user
- `rel_path`: workspace-relative path stored in DB (UTF-8 string using `/` separators is okay)

#### Patch Steps (in order)
1) Add helpers (or inline carefully) to compute rel/abs:
   - `rel = abs.strip_prefix(workspace_root)`
   - `abs = Path::new(workspace_root).join(rel)`

2) Change filesystem-driven sync to store/compare `rel_path`:
   - In `sync_workspace`:
     - `existing_pages: HashMap<rel_path, page_id>` (NOT absolute)
     - `found_files: HashSet<rel_path>` (NOT absolute)
   - In scan passes:
     - whenever code currently does `path.to_string_lossy().to_string()`, replace with rel-path computation

3) Change `sync_or_create_file` signature to accept (or compute) rel-path:
   - The lookup key must be rel-path.
   - Insert/Update `pages.file_path` with rel-path.
   - When reading file content / metadata, use absolute path.

4) Change orphan deletion:
   - When deciding “file exists or not”, match rel-path keys only.

5) Change every file operation that returns/updates `file_path` to return **rel-path**, not abs-path:
   - `FileSyncService::create_page_file`
   - `rename_page_file`
   - `move_page_file`
   - `convert_page_to_directory`
   - `convert_directory_to_file`
   - `update_file_path_in_db`
   Contract: any function that updates DB must write rel-path.
   Any function that touches the filesystem must use `workspace_root.join(rel_path)` internally.

6) Change DB→file mirroring (`sync_page_to_markdown`) to join workspace_root + rel-path before writing:
   - It currently does `Path::new(workspace_path).join(&path)`; this is correct only if `path` is rel-path. Ensure it stays that way.

7) Optional (recommended): Add a migration-less safeguard:
   - If an existing DB contains absolute paths, treat it as invalid and force a full reindex (DB is disposable).
   - Detection: if `file_path` starts with `/` on Unix-like systems, wipe DB and reindex.

#### Grep Targets (must reach 0 absolute-path persistence)
Search and update all occurrences:
- `to_string_lossy().to_string()`
- `file_path_str`
- `SELECT id, file_path FROM pages`
- `UPDATE pages SET file_path`
- `INSERT INTO pages ... file_path`
- Any `PathBuf::from(fp)` where `fp` came from DB (it must be joined against workspace root if rel)

---

## Secondary (but important): Stabilize initial content format
Pick one:

### Option A (recommended short-term): bullet-only canonical markdown
- Stop writing `# Title\n\n` on creation.
- Create a single bullet (e.g., `- `) or `- Title` as desired.
- This matches current serializer and avoids “heading vs bullets” inconsistency.

### Option B: Preserve headings
- Introduce a `heading` block type
- Extend `markdown_to_blocks` to parse `# ` lines into heading blocks
- Extend `blocks_to_markdown` to emit heading markdown for heading blocks
- Update editor UI accordingly (not covered here)

---

## Debugging Checklist (Deterministic)
If “content disappeared after pull”:
1) Verify `.md` file in repo has content.
2) Verify app ran file→DB sync after pull/open.
3) Inspect DB (or logs) for `pages.file_path` values: must be relative; if absolute, P0 is incomplete.
4) Confirm incremental detection triggered reindex: mtime/size changed, blocks regenerated.
5) Ensure DB→file mirroring did not overwrite files unexpectedly (should be deterministic canonicalization).

---

## Where to Look (Code Map)
- Filesystem sync engine: `src-tauri/src/commands/workspace.rs`
  - `sync_workspace`, `sync_directory`, `sync_or_create_file`
- Page CRUD + file creation: `src-tauri/src/commands/page.rs`, `src-tauri/src/services/file_sync.rs`
- Block CRUD + DB→file mirroring: `src-tauri/src/commands/block.rs` (`sync_page_to_markdown`)
- Markdown parsing/serialization: `src-tauri/src/services/markdown_mirror.rs` (`markdown_to_blocks`, `blocks_to_markdown`)

---

## Final Note / Agent Guidance
This repo’s correctness with Git-based collaboration depends primarily on P0 (workspace-relative paths).
Do not attempt partial fixes: if any path persistence remains absolute, multi-machine behavior will be non-deterministic.