# Issue 80 Plan: Backspace Merge Behavior

## Goal
Backspace at the start of a non-empty block merges its content into the block above.  
If no block above, do nothing.  
Only delete a block entirely if it is empty.

## Problem Summary
Current behavior deletes non-empty blocks on Backspace at start instead of merging. This causes data loss risk and breaks expected outliner UX.

## Scope
- Frontend: backspace handling and merge orchestration
- Store: deterministic “previous visible block” selection
- Backend: merge command must align with store expectations
- File sync: patching must reflect merge deterministically

---

## Work Units

### 1) Canonical previous-visible selection
**Tasks**
- Define `getPreviousVisibleBlock(blockId)` in store:
  - Use current tree order and collapsed state.
  - Must return the block visually above in the editor.
- Use this function as the single source for merge target.

**Acceptance**
- The merge target is deterministic and matches UI order.

---

### 2) Centralize merge orchestration in store
**Tasks**
- Add store action: `mergeWithPrevious(blockId, draftContent?)`.
- Action responsibilities:
  1. Resolve current block and previous visible block.
  2. If no previous block, exit without changes.
  3. If current block is empty, delete it (no merge).
  4. If current block has content, merge into previous block via backend.
  5. Apply partial updates and focus previous block at end.

**Acceptance**
- UI calls only store action for backspace merge.
- No ad-hoc merge logic in UI.

---

### 3) Backend alignment
**Tasks**
- Ensure backend `merge_blocks` merges current into previous sibling (or the chosen target).
- If store uses previous-visible (not necessarily previous sibling), adjust backend API or add a new command that merges into a specified target block ID.
- Backend must return:
  - updated target block
  - any moved children
  - deleted block id(s)

**Acceptance**
- Backend result matches store’s merge target and partial update needs.

---

### 4) Partial update stability
**Tasks**
- Use `updatePartialBlocks(changedBlocks, [deletedId])`.
- Ensure both old parent and new parent child lists are rebuilt when parent changes.

**Acceptance**
- No ghost blocks or incorrect tree structure after merge.

---

### 5) Cursor and focus
**Tasks**
- After merge, focus previous block.
- Set cursor position to end of previous block content.

**Acceptance**
- Cursor behavior matches expected UX.

---

## Files Likely Touched
- `src/stores/blockStore.ts`
- `src/outliner/BlockComponent.tsx`
- `src/outliner/blockUtils.ts` (new selector)
- `src-tauri/src/commands/block.rs` (if backend merge target needs change)

---

## Acceptance Checklist
- Backspace at start of non-empty block merges into previous visible block.
- If no block above, nothing happens.
- Empty block is deleted on backspace at start.
- No full-page reloads.
- UI, DB, and file remain consistent.