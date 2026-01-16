Loaded cached credentials.
The following report details findings from the architectural review of `src/stores`, `src/hooks`, and `src/outliner`.

### Executive Summary

The codebase demonstrates a solid React+Tauri architecture with clear separation of concerns using Zustand for state management. However, a **critical data integrity risk** exists in the file renaming logic within the frontend. Additionally, the `blockStore` is becoming a "God Object," handling too much responsibility.

---

### 1. Data Integrity & Safety (CRITICAL)

**Issue: Manual Filesystem Traversal in Frontend (`src/stores/workspaceStore.ts`)**
The `renameItem` action in `workspaceStore.ts` implements a naive, recursive filesystem walker to rewrite wiki links when a file is renamed.
*   **Code**: Lines 338-398 (recursively reading directories, reading *every* `.md` file, using Regex to replace links, and writing back).
*   **Risks**:
    *   **Race Conditions**: If the user (or another process) modifies files during this slow operation, data will be lost.
    *   **Performance**: On a large vault, this will freeze the UI thread and hammer the disk I/O.
    *   **Inconsistency**: It duplicates logic that already exists in the backend (`rewrite_wiki_links_for_page_path_change` used by `pageStore`).

**Actionable Recommendation**:
Remove the frontend recursion logic immediately. Delegate this entire operation to the backend.
*   **Refactor**: Modify `workspaceStore.ts` to call a backend command (e.g., `rename_path_with_links`) that handles the rename and link updates transactionally in Rust.
*   **Short-term Fix**: Use `tauriAPI.rewriteWikiLinksForPagePathChange` inside `renameItem` instead of the manual loop, ensuring it matches the backend's capabilities.

---

### 2. Store Complexity & Architecture

**Issue: Monolithic `blockStore.ts`**
The `blockStore` (650+ lines) acts as a data cache, API client, and conflict resolver.
*   **Complexity**: `createBlock` contains complex conditional logic for "Optimistic vs Backend-first" updates (lines 200-300).
*   **Fragility**: `updatePartialBlocks` manually maintains the relational graph (`childrenMap` updates based on `parentId` changes). This is error-prone and hard to test.

**Actionable Recommendation**:
1.  **Extract Logic**: Move pure graph manipulation logic (like calculating `childrenMap` updates or determining insert positions) into a `BlockGraphService.ts` or `blockHelpers.ts`.
2.  **Split Stores**: Consider separating the *data* (normalized `blocksById`) from the *view/interaction* (pagination, focus, loading states).
3.  **Simplify Optimistic Updates**: Standardize on one pattern. If optimistic updates are risky for consistent ordering, use a "pending" state instead of a temporary ID swap mechanism for complex operations.

---

### 3. Hooks Optimization

**Issue: `useDebouncedBlockUpdate` Usage**
*   **Observation**: This hook is instantiated for *every* block. While the implementation uses `useRef` correctly to avoid re-renders, the sheer number of timers/refs in a large document (1000+ blocks) adds memory overhead.
*   **Refinement**: Ensure `updateBlockContent` from the store has a stable identity (using `useCallback` or `state` reference) to prevent the hook's dependency array from triggering unnecessary effect cleanups.

**Issue: `useWorkspaceInitializer` Error Handling**
*   **Observation**: The error string matching (lines 58-69) is brittle and repetitive.
*   **Refinement**: Move error mapping to `src/utils/errorUtils.ts` or the `errorStore` itself.

---

### 4. Code Redundancy

**Issue: Frontend Markdown Parser (`src/outliner/blockUtils.ts`)**
*   **Observation**: `parseMarkdownToBlocks` implements a full Markdown-to-Block-Tree parser in TypeScript. However, the app loads data via `get_page_blocks` (Rust).
*   **Query**: Is this used for "Paste Markdown" functionality? If not, it is dead code that duplicates backend logic and risks drifting from the Rust implementation.
*   **Action**: If used for clipboard/paste, rename to `parseClipboardMarkdown`. If unused, delete.

### Summary Plan of Action

1.  **High Priority**: Refactor `workspaceStore.renameItem` to use backend logic for link rewriting.
2.  **Medium Priority**: Extract graph logic from `blockStore` into pure functions.
3.  **Low Priority**: Audit `blockUtils.ts` usage and clean up dead code.
