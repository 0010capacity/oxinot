# System Sync Invariants and Patching Strategy

## Purpose
Define strict invariants and procedures for file/DB synchronization to ensure deterministic behavior, prevent race conditions, and guarantee consistency between UI, DB, and files.

## Source of Truth
- **File is the source of truth.**
- **DB is a write-through cache** used for fast block queries and rendering.

## Core Invariants
1. **Mutation Order**
   - All user edits must write to DB first.
   - After DB write, apply a **file patch** (by UUID anchors) or fall back to full rewrite.
   - UI state updates only from confirmed DB results (partial updates).

2. **Deterministic Sync**
   - No “reload to fix” flows.
   - All state transitions must be deterministic and idempotent.

3. **No Races**
   - For a given page, **only one write pipeline** may be in flight.
   - All commands affecting blocks must serialize per page ID.

4. **Anchor Integrity**
   - UUID marker lines (`ID::<uuid>`) are the canonical anchors.
   - Patch operations must verify anchor presence before modifying.

5. **Safety Fallback**
   - If patch safety checks fail, perform a full page rewrite from DB state.

## File Patching Rules
Patching is permitted only if all checks pass:

### Required Safety Checks
- File path exists and resolves to current page.
- File metadata (size/mtime) matches DB-stored metadata (or trusted cache).
- All required UUID markers exist (source and destination neighborhood).
- Indent assumptions can be derived from anchors or parent marker.

### Patch Types
1. **Insert**
   - For create operations with known parent and sibling anchors.
2. **Update**
   - For content changes in a single UUID block segment.
3. **Delete**
   - Remove bullet segment including UUID marker.
4. **Relocate**
   - Cut subtree by marker and reinsert under destination anchors.

### Fallback Behavior
- If any anchor or safety check fails, perform full rewrite:
  - Serialize from DB to file.
  - Update file metadata in DB.

## DB and File Consistency
- After any mutation:
  - DB state must be authoritative for UI updates.
  - File sync must reflect DB state exactly.

## Per-Page Concurrency
- Enforce a per-page mutex or queue for all block operations:
  - create, update, delete, indent, outdent, move, merge, split.
- Queue ensures:
  - deterministic ordering
  - no interleaving partial patches

## Error Handling
- On file patch failure:
  - Attempt full rewrite.
  - If full rewrite fails, surface error and block further mutations for that page until resolved.

## Observability Requirements
- Log patch decisions and fallbacks with:
  - operation type
  - page id
  - block id(s)
  - patch vs full rewrite
  - failure reason

## Acceptance
- No state divergence between UI, DB, and file.
- No duplicate or missing blocks after rapid edits.
- No “reload to fix” logic required.
- Patch operations are safe and deterministic.