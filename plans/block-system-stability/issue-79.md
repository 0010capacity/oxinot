# Issue 79 Plan: Split Behavior with Children

## Goal
Ensure Enter-based split behavior inserts the new block directly below the current block:
- If current block has children: new block becomes **first child**.
- If no children: new block becomes **next sibling**.
This must be deterministic and consistent across UI, store, DB, and file patching.

## Problem Summary
Current split behavior places the new block as the **last child** when the current block has children, which contradicts expected outliner UX and causes surprising placement.

## Scope
- Frontend: split orchestration (store + editor)
- Backend: create-block position remains canonical
- File sync: patching should reflect the new position without full reloads

---

## Work Units

### 1) Canonical split placement rule
**Tasks**
- Define `insertBelow(blockId)` rule:
  - children exist → first child
  - else → next sibling
- Document rule and enforce it in store action.

**Acceptance**
- Rule is single source of truth for split placement.

---

### 2) Centralize split orchestration in store
**Tasks**
- Add store action: `splitBlockAtCursor(blockId, cursorOffset, draftContent?)`.
- Action responsibilities:
  1. Resolve current block from store.
  2. Compute `beforeContent` and `afterContent`.
  3. Update current block content via backend.
  4. Create new block with `afterContent` using `insertBelow` rule.
  5. Apply partial updates and focus.

**Acceptance**
- UI only calls store action; no split placement logic in UI.

---

### 3) Backend alignment
**Tasks**
- Ensure `create_block` honors `parentId` + `afterBlockId`:
  - If inserting as first child: `parentId = current.id`, `afterBlockId = null`.
  - If inserting as next sibling: `parentId = current.parentId`, `afterBlockId = current.id`.
- Confirm order weight calculation remains correct.

**Acceptance**
- New block position matches split placement rule.

---

### 4) Partial update stability
**Tasks**
- Use `updatePartialBlocks([newBlock])` after create.
- Ensure `updatePartialBlocks` rebuilds both old and new parent children lists when parent changes.

**Acceptance**
- No ghost blocks or duplicate children after split.

---

### 5) Cursor/Focus handling
**Tasks**
- After split, focus new block at cursor position 0.
- Keep current block content updated before focus change.

**Acceptance**
- Cursor behavior matches expected UX.

---

## Files Likely Touched
- `src/stores/blockStore.ts`
- `src/outliner/BlockComponent.tsx`
- `src/outliner/blockUtils.ts` (if new helper needed)

---

## Acceptance Checklist
- Enter with trailing content always splits into a new block directly below the current block.
- If current block has children, new block is the first child.
- If no children, new block is the next sibling.
- No full-page reloads during split.
- UI, DB, and file remain consistent.