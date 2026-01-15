# Integrated Execution Plan and Sequencing

## Purpose
Provide a step-by-step execution sequence to resolve issues #79, #80, #117, #128 with a stable, deterministic block system that honors file-as-source-of-truth and DB write-through cache.

## Preconditions
- Read `system-sync.md` and align all changes with its invariants.
- No reload-based reconciliation paths remain after completion.

---

## Phase 0: Audit and Baseline
1. **Audit current flows**
   - Identify all entry points for block mutations (create, update, delete, indent, outdent, move, split, merge).
   - Map UI -> store -> backend -> file patch flows.
2. **Confirm existing patching**
   - Verify UUID marker usage and fallback behavior.
3. **Snapshot behavior**
   - Record current behavior for the reported scenarios to validate post-fix.

**Exit criteria:** Clear mapping of all mutation flows and patch operations.

---

## Phase 1: Canonical Placement and Navigation Rules
1. **Define canonical rules**
   - `previousVisibleBlock(blockId)` definition (tree order + collapsed state).
   - `insertBelow(blockId)` definition:
     - if current has children -> first child
     - else -> next sibling
2. **Document rules**
   - Embed as comments in store or a shared helper module.
   - Ensure all callers reference these rules.

**Exit criteria:** Single rule set for merge/split placement.

---

## Phase 2: Store-Centered Merge/Split Orchestration
1. **Introduce store actions**
   - `mergeWithPrevious(blockId, draftContent?)`
   - `splitBlockAtCursor(blockId, cursorOffset, draftContent?)`
2. **Migrate UI handlers**
   - UI key handlers call store actions only.
   - Remove UI-local placement logic.

**Exit criteria:** UI no longer decides merge/split targets or insertion positions.

---

## Phase 3: Merge Behavior (#80)
1. **Previous-visible selection**
   - Implement `getPreviousVisibleBlock` (or equivalent) in store.
2. **Merge orchestration**
   - If no previous block: no-op.
   - If block empty: delete.
   - Else: merge into previous block via backend.
3. **Backend alignment**
   - Ensure backend supports merge target semantics.
   - If current backend merges only previous sibling, extend or add command to merge into a specified target block if needed.
4. **Partial update**
   - Apply `updatePartialBlocks(changedBlocks, [deletedId])`.

**Exit criteria:** Backspace at start merges correctly or no-ops; empty blocks delete only when empty.

---

## Phase 4: Split Behavior (#79)
1. **Split orchestration**
   - Commit draft to DB.
   - Update current content with `before`.
   - Create new block with `after` using `insertBelow` rule.
2. **Placement correctness**
   - If current has children, new block is first child.
   - Else, new block is next sibling.
3. **Partial update**
   - Apply partial updates for created block and affected parents.

**Exit criteria:** Enter mid-content splits into a block directly below the current block.

---

## Phase 5: Partial Update Stability (#128)
1. **Parent rebuild**
   - Ensure `updatePartialBlocks` rebuilds children for:
     - previous parent and new parent when `parentId` changes
     - parents of deleted blocks
2. **No reloads**
   - Remove any fallback `loadPage()` used for reconciliation in normal success paths.

**Exit criteria:** No ghost blocks, no flicker, no unnecessary reloads.

---

## Phase 6: Deterministic Open/Create Flow (#117)
1. **Introduce `openPage(pageId)`**
   - Sequence: `loadPage` -> if empty -> create initial block -> update state.
2. **Idempotency**
   - Maintain per-page in-flight and completed flags.
   - Prevent duplicate initial block creation.
3. **Merge optimistic state**
   - Ensure `loadPage` does not erase in-flight optimistic block.

**Exit criteria:** Opening a new page consistently shows exactly one empty root block without reloads.

---

## Phase 7: File Patch Validation and Sync Guarantees
1. **Verify patch safety**
   - Ensure all patch operations follow `system-sync.md` checks.
2. **Fallback behavior**
   - Confirm full rewrite is used when patch safety checks fail.
3. **Per-page serialization**
   - If not already in place, implement a per-page queue/mutex for block mutations.

**Exit criteria:** No file/DB divergence under rapid edits.

---

## Phase 8: Regression Coverage
1. **Add tests**
   - Merge behavior (nested structures, no-op when no previous block).
   - Split behavior (child-first placement, sibling placement).
   - Open/create flow idempotency.
2. **Manual scenario checks**
   - Use the reported reproduction cases.

**Exit criteria:** Tests cover all reported scenarios.

---

## Phase 9: Final Verification
- UI tree and file output identical after:
  - merge, split, indent, outdent, delete
  - initial page open and first block creation
- No reload-based reconciliation in logs or code paths.

---

## Sequencing Notes
- Phases 1–2 must be completed before 3–4.
- Phase 5 can proceed after merge/split logic is centralized.
- Phase 6 can run in parallel with Phase 5, but must not regress placement logic.
- Phase 7 should be validated after all mutation flows are deterministic.

---

## Deliverables
- Updated store actions and selectors.
- UI keybindings calling store actions only.
- Deterministic page open flow.
- Updated partial update logic.
- Verified file patching behavior.
- Regression tests and manual checks.
