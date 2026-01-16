Loaded cached credentials.
Here is the review of `src-tauri/src` focusing on Safety, Async/IO, and Rust idioms.

### 1. Safety (Unwrap & Panics)

Overall, the codebase avoids aggressive `unwrap()` usage in critical paths, but there are specific areas where error handling could be more robust or where "optimistic" assumptions are made.

*   **`src-tauri/src/lib.rs`**:
    *   **`read_directory`**: Uses `.unwrap_or_else(|| "0".to_string())` for file modification times. This is safe but masks potential filesystem metadata errors.
    *   **`select_workspace`**: The result of `commands::git::git_init` and `sync_workspace_incremental` is ignored (`let _ = ...`). This swallows initialization errors (e.g., git init failure due to permissions), leaving the workspace in a partially initialized state without user feedback.
*   **`src-tauri/src/utils/page_sync.rs` (Critical)**:
    *   **Non-Atomic Writes**: The function `write_page_lines` uses `std::fs::write`. This is **not atomic**. If the application crashes or power is lost during the write operation, the user's markdown file will be corrupted (truncated or partially written).
    *   **Recommendation**: Write to a temporary file (e.g., `.filename.md.tmp`) first, sync to disk, and then atomically rename it to the target filename.
*   **`src-tauri/src/commands/git.rs`**:
    *   **Missing Path Validation**: Unlike `lib.rs`, the commands in `git.rs` (e.g., `git_init`, `git_commit`) do **not** call `validate_no_path_traversal`. While likely driven by the UI, this exposes a potential path traversal vulnerability if the `workspace_path` argument is manipulated.
    *   **Command Injection**: `git_commit` takes a `message` string. While `std::process::Command` handles argument splitting safely, ensure no shell features are assumed. The current implementation looks safe as it passes arguments as a list.

### 2. Asynchronous & IO Errors

The application uses Tauri's async command structure, but the underlying I/O implementation is largely synchronous.

*   **Blocking I/O in Async Context**:
    *   Most commands (e.g., `read_directory`, `sync_workspace`, `write_file`) use `std::fs` (blocking I/O) inside `async` functions or standard functions called by Tauri's thread pool.
    *   **Impact**: While Tauri offloads commands to a thread pool, heavy I/O (like `sync_workspace` on a large repo) using blocking `fs` calls can exhaust the thread pool if many concurrent requests occur.
    *   **Recommendation**: For heavy operations like `sync_workspace`, consider using `tokio::fs` or explicitly wrapping the blocking code in `tauri::async_runtime::spawn_blocking` to avoid blocking the async executor.
*   **Race Conditions (TOCTOU)**:
    *   **`lib.rs: move_path`**: Checks `if !target_parent.exists()` and then proceeds. A directory could be deleted between the check and the operation.
    *   **`page_sync.rs`**: The patching logic (`is_safe_to_patch_file`) checks `mtime` and `size` to detect external changes. This is a good "optimistic lock," but strictly speaking, the file could change between the check and the write. Given it's a local desktop app, this is likely an acceptable trade-off, but it's not strictly "safe" in a concurrent environment.
*   **Database Consistency**:
    *   **`delete_path_with_db`**: Deletes from DB *before* deleting from the filesystem. If the filesystem deletion fails (e.g., file locked), the DB is already updated, leading to a "ghost" deletion (file exists but not in DB).
    *   **Recommendation**: Perform the filesystem operation first, or wrap both in a transaction/rollback mechanism (though rolling back an FS delete is hard; usually FS first, then DB is safer for "delete").

### 3. Rust Idioms & Code Quality

*   **Error Handling (`thiserror`)**:
    *   The project defines a rich `OxinotError` enum in `error.rs`, which is excellent. However, many functions (especially in `lib.rs` and `workspace.rs`) immediately convert errors to `String` via `.map_err(|e| e.to_string())`.
    *   **Recommendation**: Return `Result<T, OxinotError>` as far up the call stack as possible. Let the final `tauri::command` handler convert the `OxinotError` to a String (or a structured JSON error) for the frontend. This preserves error context for logging and debugging.
*   **Path Handling**:
    *   **`utils/path.rs`**: The `validate_workspace_containment` function correctly uses `canonicalize()` and `starts_with()` to prevent path traversal, which is the idiomatic and secure way to handle paths in Rust.
*   **Stringly-Typed Logic**:
    *   `src-tauri/src/utils/markdown.rs` relies heavily on string manipulation (finding indices, splicing vectors of strings) for incremental updates. While functional, this is brittle.
    *   **Recommendation**: If the logic gets more complex, consider using a proper concrete syntax tree (CST) or AST parser that preserves whitespace/comments, rather than regex/string-splitting, to ensure modifications don't break the markdown structure.

### Summary Actions
1.  **Refactor `write_page_lines`** in `utils/page_sync.rs` to use atomic write (write-temp-and-rename).
2.  **Add `validate_no_path_traversal`** to all commands in `commands/git.rs`.
3.  **Swap deletion order** in `delete_path_with_db`: Delete file first, then DB record (or handle failure to restore consistency).
4.  **Standardize Error Handling**: Refactor commands to return `OxinotError` directly and let `From<OxinotError> for String` handle the conversion at the boundary.
