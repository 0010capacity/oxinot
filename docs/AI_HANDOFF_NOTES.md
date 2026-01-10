# AI Handoff Notes (Directory-Notes + Sync/Indexing + Git/DB)

## Context / Goal
This app models notes like Notion: **no folder/page distinction in UX**. On disk, hierarchy is represented by folders, but **folders are pages**. A folder-page stores its content in a special “directory note” markdown file.

**Directory-note rule is fixed**:
- `DirName/DirName.md` is the *content source* of the directory page `DirName`.
- `DirName/DirName.md` must **NOT** appear as a separate page node anywhere (index tree, search, etc).

This handoff summarizes:
1) the directory-note bug and fixes,
2) sync/index engine unification and incremental behavior,
3) the big design risk with Git + DB: `file_path` must be workspace-relative.

---

## Current Known Issues / Risks

### R1: Git tracks files, DB is excluded → path mapping must be stable
Workspace DB is excluded from Git (expected). Therefore the only shared artifact across machines is the `.md` tree.

**If DB stores absolute paths** (e.g., `/Users/A/.../repo/Test4/Welcome/NewNote1.md`) then on another machine those paths differ and:
- DB cannot map pulled files to existing pages
- pages can duplicate / orphan / disappear in UI
- incremental detection based on path may be wrong

**Required redesign**:
- Store `pages.file_path` as **workspace-relative paths** only.
- When reading/writing actual files, always join `workspace_path + file_path`.

This is the highest-priority architectural fix for “Git workflow” correctness.

### R2: Two-way DB↔file syncing causes confusing “truth source” semantics
The system currently supports:
- file → DB (sync/reindex scan)
- DB → file (block CRUD writes markdown)

This can cause content shape changes (e.g. headings → bullets) if the markdown parser/renderer is not round-trip faithful.
Note: current `markdown_to_blocks` parses every non-empty line as a **Bullet** and only strips "`- `". It does **not** preserve `# Heading` as a heading type.

If “headings” in markdown are expected to survive round trips, parser/serializer must be extended. Otherwise, standardize on bullet-only markdown output.

---

## Directory-Note Semantics (Hard Rule)
**Never index `Dir/Dir.md` as a child page**. It is the directory page’s content.

Correct tree example:
- `Test4` (directory page if `Test4/Test4.md` exists, otherwise just a container in FS)
  - `Welcome` (directory page from `Welcome/Welcome.md`)
    - `NewNote1` (file page from `Welcome/NewNote1.md`)

Incorrect (previous bug):
- `Welcome` (directory page)
  - `Welcome` (file page from `Welcome/Welcome.md`)  ❌ duplicate

---

## What Changed Recently (Important for Future Agents)

### C1: Reindex used the wrong engine and created duplicates
There were two indexing implementations historically:
- A filesystem-driven directory recursion in `commands/workspace.rs`
- A WalkDir-based “scan all md files” service `WorkspaceSyncService` (now removed)

Bug: Full Reindex used the WalkDir service, which treated `Dir/Dir.md` as a normal page, causing duplicates.

Fix: Full Reindex now wipes DB and rebuilds using the filesystem-driven engine.

### C2: Directory-note handling was fixed at the source (filesystem sync)
The filesystem-driven recursion was refactored so ordering is explicit:
1) process subdirectories first (create directory pages via `Dir/Dir.md`, recurse with correct parent_id)
2) process regular `.md` files in the current directory
3) **skip `Dir/Dir.md` in the regular file pass**

This prevents “NewNote1 not appearing” / wrong-parent issues that occurred when `Dir/Dir.md` was processed as a regular file first.

### C3: Sync engine was unified; old service removed
All sync/reindex paths now flow through the filesystem-driven engine.

- `WorkspaceSyncService` (WalkDir engine) was deleted.
- `services/mod.rs` no longer exports it.

### C4: mtime+size incremental reindex added to filesystem-driven sync
Incremental behavior is implemented in the filesystem-driven engine by:
- reading file metadata (mtime + size)
- comparing to DB columns (`pages.file_mtime`, `pages.file_size`)
- if changed: delete blocks for the page and regenerate from markdown
- always update hierarchy metadata (parent_id, is_directory, file_mtime, file_size, updated_at)

This is correctness/perf-critical for Git workflows because after a pull, mtimes/sizes should change and DB should reindex.

---

## Current Behavior Summary (as of this handoff)

### Sync/Reindex
- `sync_workspace` scans filesystem and updates DB.
- “Incremental sync” command currently routes to the same engine and uses mtime+size to decide whether to rebuild blocks for an existing page.
- Full reindex wipes DB then calls `sync_workspace`.

### Page Creation
- `create_page` writes an initial markdown file `# Title\n\n` and updates `pages.file_path`.
- **Potential inconsistency**: creation does not necessarily seed DB blocks immediately; later sync may parse file into bullet blocks, and DB→file mirroring may rewrite markdown into bullet format.

---

## Required Redesign (Next Agent TODO List)

### P0: Make `pages.file_path` workspace-relative everywhere (Git correctness)
**Goal**: Same repo on different machines maps to the same DB rows after pull.

Change all flows to:
- store relative paths (`Test4/Welcome/NewNote1.md`)
- compute absolute path only when reading/writing (`Path::new(&workspace_path).join(&relative_path)`)

Audit the following operations:
- filesystem-driven sync (scan + orphan deletion) must compare relative paths, not absolute
- file move/rename/create helpers must update relative path properly
- DB→file mirroring must join workspace path with relative file_path before writing

### P1: Decide the system’s “truth model”
Two viable models:

#### Model A (hybrid; recommended for Git):
- **Files are the durable shared artifact** (Git SoT)
- DB is a local cache/index for block UI
- On workspace open and after pull: always run file→DB sync
- DB→file writes are allowed, but must be deterministic and round-trip-safe (or defined as canonical formatting)

#### Model B (DB SoT):
- DB is durable SoT, but then Git cannot be the authoritative sync mechanism unless DB becomes a tracked artifact or serialized to files definitely and always.
- Not recommended with “DB excluded from repo” requirement.

Given current workflow (repo contains `.md` only), Model A is the only safe choice.

### P2: Fix markdown round-trip if headings are expected
Current markdown <-> blocks is not symmetric:
- parse treats all non-empty lines as bullet content
- serialize always outputs bullets

If you want to preserve `# Title` headings:
- introduce a `heading` block type (or treat markdown heading lines specially)
- update both `markdown_to_blocks` and `blocks_to_markdown` to preserve it

If you do NOT want headings:
- stop writing `# Title\n\n` on file creation and instead create a bullet-based initial content consistent with serializer.

### P3: Consider “on-open” auto sync (pull safety)
If the UI loads pages from DB without doing a file→DB sync after a pull, the user may see stale content.
Ensure:
- on workspace open, run sync
- provide a “Pull & Sync” flow that: git pull → sync → reload pages

---

## Debugging Checklist for “content disappeared after pull”
1) Confirm pulled `.md` contains expected content.
2) Confirm app ran file→DB sync after pull.
3) Verify DB `pages.file_path` matches filesystem paths (should be *relative*; currently may be absolute).
4) Verify mtime+size comparison triggered reindex for changed files.
5) If DB→file mirror ran, check whether it overwrote file into bullet-only canonical format.

---

## Where to Look (Code Map)
- Filesystem sync engine: `src-tauri/src/commands/workspace.rs`
  - `sync_workspace`, `sync_directory`, `sync_or_create_file`
- Page CRUD + file creation: `src-tauri/src/commands/page.rs`, `src-tauri/src/services/file_sync.rs`
- Block CRUD + DB→file mirroring: `src-tauri/src/commands/block.rs` (`sync_page_to_markdown`)
- Markdown parsing/serialization: `src-tauri/src/services/markdown_mirror.rs` (`markdown_to_blocks`, `blocks_to_markdown`)

---

## Final Note
The directory-note rule (`Dir/Dir.md`) is non-negotiable and must remain enforced at the filesystem sync layer to prevent duplicates and wrong parent relationships. The next high-impact change is making all `file_path` values workspace-relative to make Git-based multi-machine workflows reliable.