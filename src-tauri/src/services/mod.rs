pub mod file_sync;
pub mod markdown_mirror;
// workspace_sync module is currently unused after sync engine unification.
// Keeping the module file is fine, but we stop re-exporting its service to avoid unused warnings.
pub mod workspace_sync;

pub use file_sync::FileSyncService;
pub use markdown_mirror::{blocks_to_markdown, markdown_to_blocks, MarkdownMirrorService};
// (removed) WorkspaceSyncService re-export: sync/reindex paths are unified on filesystem-driven `sync_workspace`.
