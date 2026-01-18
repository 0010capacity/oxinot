---
"oxinot": minor
---

- remove loading UI from page navigation
- migrate file I/O to tokio::fs for non-blocking async operations (#442)
- restore page tree drag-and-drop functionality
- replace page store full reload with incremental updates
- correct movePage command parameters
- use reindexWikiLinks instead of missing command
- remove loadPages call after drag-and-drop move
- replace page store full reload with incremental updates (#445)
- remove loadPages calls after page mutations
- auto-convert empty directories to regular pages after move
- refetch old parent after move to update UI
- correct get_page request field name (pageId -> page_id)
- add isDirectory to memo comparison for proper re-rendering
- also refetch new parent after move to update isDirectory
- add childCount to memo comparison
