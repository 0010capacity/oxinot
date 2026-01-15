# Acceptance Checklist: End-to-End Validation

## Scope
This checklist validates fixes for issues #79, #80, #117, #128 across UI, store, DB, and file sync.

---

## A. Deterministic Open/Create Flow (#117)

- [ ] Opening a brand new empty page shows exactly one empty root block.
- [ ] No duplicate empty root blocks appear in DB or file.
- [ ] No reload-based reconciliation occurs after initial create.
- [ ] UI never flickers to empty-state when an initial block is being created.
- [ ] Opening the same page repeatedly does not create additional blocks.

---

## B. Backspace Merge Behavior (#80)

- [ ] Backspace at start of a non-empty block merges into the previous visible block.
- [ ] If no previous block exists, Backspace does nothing.
- [ ] Backspace deletes a block only when the block is empty.
- [ ] Merge preserves child subtrees correctly.
- [ ] Cursor lands at end of merged block content.

---

## C. Split Behavior with Children (#79)

- [ ] Enter with trailing content splits into a new block directly below.
- [ ] If current block has children, new block becomes first child.
- [ ] If no children, new block becomes next sibling.
- [ ] Content after cursor moves into the new block.
- [ ] Cursor lands at start of new block.

---

## D. Partial Update Stability (#128)

- [ ] Indent/outdent/move updates remove block from old parent and add to new parent.
- [ ] No ghost blocks remain in old parents after parent changes.
- [ ] Children lists are correct after merges, splits, moves, deletes.
- [ ] No full-page reloads occur on successful operations.

---

## E. File/DB Sync Consistency

- [ ] After each mutation, DB reflects the new block state.
- [ ] File patch occurs using UUID anchors when safe.
- [ ] On patch safety failure, full rewrite occurs without data loss.
- [ ] File content matches DB block tree after each operation.

---

## F. Race and Concurrency Safety

- [ ] Rapid sequences of edits do not produce divergent UI/DB/file states.
- [ ] No interleaving writes cause missing or duplicated blocks.
- [ ] Per-page write ordering is deterministic.

---

## G. Regression Scenarios (Manual)

1. **Nested Merge**
   - Merge block with children into previous visible block.
   - Verify tree structure and file output.

2. **Split With Children**
   - Split a block with existing children.
   - Verify new block becomes first child.

3. **Split With Siblings**
   - Split a block without children.
   - Verify new block becomes next sibling.

4. **Indent/Outdent After Split**
   - Split, then indent/outdent the new block.
   - Verify correct parent updates and file patching.

5. **Delete Then Merge**
   - Delete an empty block; merge adjacent non-empty block.
   - Verify correct removal and merge placement.

---

## Completion Criteria

- [ ] All above checks pass.
- [ ] UI, DB, and file remain consistent after all operations.
- [ ] No reload-based reconciliation remains in code paths.