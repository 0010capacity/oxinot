# Issue 117 Plan: Deterministic Open/Create Flow

## Goal
Make initial page open and initial block creation deterministic and idempotent without any post-create reload. Eliminate races between `loadPage()` and `createBlock()` that cause empty-state flicker or duplicate empty blocks.

## Problem Summary
When opening a new empty page, the editor may auto-create an initial block. Concurrent `loadPage()` and optimistic `createBlock()` can produce non-deterministic UI state, requiring a reload workaround.

## Constraints
- File is the source of truth.
- DB is write-through cache.
- No reload-based reconciliation.
- Idempotent per page open.

---

## Work Units

### 1) Introduce explicit `openPage(pageId)` orchestration
**Tasks**
- Add a store action `openPage(pageId)` that performs:
  1. `loadPage(pageId)` (fetch DB blocks)
  2. If empty, create initial block via backend
  3. Apply state updates deterministically
- Make UI components use `openPage` instead of `loadPage` directly.

**Acceptance**
- Page open has a single deterministic control flow.
- No external reload hacks.

---

### 2) Idempotent initial block creation
**Tasks**
- Create a dedicated helper `createInitialBlock(pageId)` in the store.
- Enforce per-page idempotency with:
  - in-flight lock keyed by pageId
  - completed flag keyed by pageId
- If creation is already in-flight or completed, do nothing.

**Acceptance**
- Only one empty root block is created for a new page.
- No duplicate blocks in DB/files.

---

### 3) Merge optimistic state with loaded data
**Tasks**
- If optimistic temp blocks exist during `loadPage`, merge results:
  - replace temp IDs with real IDs when backend responds
  - preserve temp block in state if DB load returns empty but create is in flight
- Prevent `loadPage` from overwriting in-flight optimistic state.

**Acceptance**
- UI never flickers to empty-state during a valid in-flight create.
- Final state matches DB and file.

---

### 4) Remove reload-based reconciliation
**Tasks**
- Remove any “reload after initial create” logic in UI (`BlockEditor`).
- Ensure `openPage` handles all state transitions.

**Acceptance**
- No extra `loadPage` call is required after initial create.
- UI remains stable and consistent.

---

### 5) Sync guarantees (DB → File)
**Tasks**
- Confirm initial block creation uses DB write followed by file patch.
- Ensure file patching follows `system-sync.md` invariants.

**Acceptance**
- DB state is reflected in file deterministically.
- No race or divergence between DB and file.

---

## Files Likely Touched
- `src/stores/blockStore.ts` (openPage, createInitialBlock, idempotency state)
- `src/outliner/BlockEditor.tsx` (use openPage, remove reload workaround)
- `src/tauri-api.ts` (if new API surface required)

---

## Acceptance Checklist
- Opening a brand new empty page always shows exactly one empty root block.
- No duplicate empty blocks in DB/file.
- No post-create reloads or UI flicker.
- UI, DB, and file remain consistent.