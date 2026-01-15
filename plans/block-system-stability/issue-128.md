# Issue 128 Block Merge/Split Stability Plan

## Goal
Make block merge (Backspace at start) and split (Enter mid-content) deterministic, stable, and consistent across UI, store, DB, and file sync. Eliminate full-page reloads and misplacement/merge anomalies.

## Constraints
- TypeScript strict mode.
- Avoid `any`.
- No emojis.
- Stable cursor/focus behavior.
- File is the source of truth; DB is a write-through cache.
- All mutations write to DB first, then patch files via UUID anchors when safe.
- No reload-based reconciliation; all flows must be deterministic.

---

## Work Units

### 0) Sync invariants alignment
**Purpose:** Ensure all merge/split stability work respects file-as-source-of-truth and patching invariants.

**Tasks:**
- Confirm DB write-through flow for all block mutations.
- Ensure file patching uses UUID anchors and falls back to full rewrite when unsafe.
- Verify per-page mutation ordering to prevent races.

**Acceptance:**
- UI, DB, and file remain consistent without reloads.

---

### 1) Define canonical “navigation order” and target semantics
**Purpose:** Ensure merge/split operate on a single, shared definition of “previous/next block” and “insert below.”

**Tasks:**
- Document the expected behavior in terms of tree order and visible traversal:
  - `previousVisibleBlock(blockId)` returns the block visually above in the editor, considering collapsed states and tree order.
  - `insertBelow(blockId)` places a new block as:
    - first child if current block has children
    - next sibling otherwise.
- Add a small spec section in this plan describing these two rules, used by both UI and store.

**Acceptance:**
- Spec is explicit and used as the single source of truth for logic changes.

---

### 2) Centralize merge/split orchestration in store layer
**Purpose:** Eliminate UI-local logic divergence by moving merge/split decision-making into `blockStore`.

**Tasks:**
- Add new store actions:
  - `mergeWithPrevious(blockId, draftContent?)`
  - `splitBlockAtCursor(blockId, cursorOffset, draftContent?)`
- These actions:
  - Resolve current block, prev/next blocks using store selectors.
  - Apply deterministic placement rules (from Work Unit 1).
  - Trigger backend commands and apply partial updates.
  - Handle focus/cursor placement consistently.

**Acceptance:**
- UI components (CodeMirror handlers) call only these store actions for merge/split.
- No ad-hoc placement logic left in UI.

---

### 3) Fix merge: “Backspace at start”
**Purpose:** Merge the current block into the true previous visible block and remove current block.

**Tasks:**
- Use store’s `getPreviousBlock` or new `getPreviousVisibleBlock` if needed.
- If current block is empty:
  - Merge should still attach empty content and delete current block.
- If current block has children:
  - Merge logic must preserve children by reparenting them to the merge target or reordering exactly as backend merge does.
- Ensure backend merge returns all affected blocks + deleted block ids.
- Ensure `updatePartialBlocks` includes both old and new parent contexts.

**Acceptance:**
- Backspace at start merges into correct target with no flicker.
- Tree and markdown file remain consistent.

---

### 4) Fix split: “Enter with trailing content”
**Purpose:** Split content at cursor into a new block placed directly below the current block.

**Tasks:**
- Store action `splitBlockAtCursor`:
  - Commit draft content first if necessary.
  - Split current block content into `before` and `after`.
  - Update current block content in backend.
  - Create new block with `after` content:
    - If current has children → new block becomes **first child**.
    - Else → new block becomes **next sibling**.
- Ensure the order weight and parent id rules are aligned with backend create.

**Acceptance:**
- Split always produces a new block immediately below current block.
- Content after cursor moves into new block.
- No reloads.

---

### 5) Ensure partial updates cover parent changes
**Purpose:** Prevent UI/store desync after moves, indent, split, merge.

**Tasks:**
- Extend `updatePartialBlocks` to rebuild children lists for:
  - previous parent and new parent when parentId changes.
  - all affected parents when deleting.
- Add helper to compute affected parents to avoid missed updates.

**Acceptance:**
- Indent/outdent/move/merge/split never leave “ghost blocks” in old parents.
- UI and DB stay in sync without full reload.

---

### 6) Consistent cursor/focus management
**Purpose:** Avoid cursor jumps or lost focus after operations.

**Tasks:**
- After merge:
  - Focus previous block with cursor at end of its content.
- After split:
  - Focus new block at position 0 (or keep column if needed).
- Ensure focus changes only after store updates.

**Acceptance:**
- Cursor behavior predictable and matches expected UX.

---

### 7) Add regression coverage (unit or integration tests)
**Purpose:** Prevent reintroduction of merge/split regressions.

**Tasks:**
- If existing test infra:
  - Add tests for store selectors and store actions.
- Otherwise:
  - Add minimal tests under existing frontend test setup for:
    - merge with nested structures
    - split with child/sibling placement
    - indent/outdent stability after split/merge.

**Acceptance:**
- Tests cover the reported cases and pass.

---

## Files Likely Touched
- `src/stores/blockStore.ts` (new merge/split actions, selectors)
- `src/outliner/BlockComponent.tsx` (use store actions only)
- `src/outliner/blockUtils.ts` or new selector utilities
- `src-tauri/src/commands/block.rs` (if backend return payload adjustments needed)

---

## Deliverables
- Updated store logic for merge/split with deterministic placement.
- UI components calling store actions only.
- Updated partial update handling.
- Tests for the reported scenarios.

---

## Final Acceptance Checklist
- Backspace at block start merges into correct previous visible block.
- Enter mid-content splits and places new block directly below current block (child-first rule).
- No full-page reloads on merge/split.
- UI tree matches markdown file output.
- Tests pass for reported cases.