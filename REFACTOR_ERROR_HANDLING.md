# Error Handling Refactoring Roadmap

## Current State (Completed)

### Foundation ✅
- [x] Add `rusqlite::Error` → `OxinotError` conversion
- [x] Implement `From<OxinotError> for String` for Tauri compatibility
- [x] Rich `OxinotError` enum with variants for all error types
- [x] Helper methods on `OxinotError` for error construction

### Existing Usage ✅
- `commands/workspace.rs`: Already uses `OxinotError` in several places
- `commands/git.rs`: Uses error handling consistently
- `lib.rs`: Some functions return `Result<T, String>` but could be improved

## Problem Statement

Currently, many functions throughout the codebase use `.map_err(|e| e.to_string())` pattern, which:
- Loses error context and details
- Makes debugging harder
- Prevents structured error responses
- Creates inconsistent error handling patterns

## Migration Strategy

### Phase 1: Utilities & Helpers (Low Dependency)
Migrate functions with minimal dependents first:
- [ ] `utils/path.rs` - Validation functions
- [ ] `utils/markdown.rs` - Parsing helpers
- [ ] `services/page_path_service.rs` - Path caching
- [ ] `services/wiki_link_index.rs` - Link indexing

**Pattern:**
```rust
// Before
fn validate_something(value: &str) -> Result<(), String> {
    if !valid(value) {
        return Err("Invalid value".to_string());
    }
    Ok(())
}

// After
fn validate_something(value: &str) -> Result<()> {
    if !valid(value) {
        return Err(OxinotError::invalid_state("Invalid value"));
    }
    Ok(())
}
```

### Phase 2: Commands (Medium Dependency)
Migrate command handlers with careful coordination:
- [ ] `commands/block.rs` - Heavy database usage (~1600 lines)
- [ ] `commands/page.rs` - Page management
- [ ] `commands/search.rs` - Search functionality
- [ ] `commands/wiki_link.rs` - Wiki link handling

**Key Points:**
- Keep Tauri command signatures returning `Result<T, String>` (auto-converts via From impl)
- Internal helpers return `Result<T>` (uses OxinotError)
- No changes to frontend API

### Phase 3: Core Services (High Dependency)
Migrate most-used services last:
- [ ] `commands/workspace.rs` - Workspace operations
- [ ] `services/file_sync.rs` - File synchronization
- [ ] Database schema and migrations

### Phase 4: Main Entry Point
- [ ] `lib.rs` - Main Tauri commands

## Implementation Rules

### 1. Function Signatures
```rust
// ❌ Don't do this
fn my_func() -> Result<String, String> { }

// ✅ Do this
use crate::error::Result;
fn my_func() -> Result<String> { }
```

### 2. Database Errors
```rust
// ❌ Before
conn.execute(sql, params).map_err(|e| e.to_string())?;

// ✅ After
conn.execute(sql, params)?;  // Automatically converts via From impl
```

### 3. String Errors → Error Variants
```rust
// ❌ Before
Err("File not found".to_string())

// ✅ After
Err(OxinotError::PageNotFound(id))
```

### 4. Error Construction
```rust
// Use helper methods when available
OxinotError::database("msg")
OxinotError::path_error("msg")
OxinotError::workspace("msg")

// Or use enum variants directly
OxinotError::BlockNotFound(id)
OxinotError::InvalidState("msg".into())
```

### 5. Tauri Commands (No Changes)
```rust
// Tauri commands can still return String
// From<OxinotError> for String handles conversion automatically
#[tauri::command]
pub async fn my_command(...) -> Result<String, String> {  // Still returns String for Tauri
    let result = internal_helper()?;  // internal_helper returns Result<T>
    Ok(result.to_string())
}
```

## Benefits After Migration

1. **Better Debugging**: Full error context preserved
2. **Type Safety**: Compile-time checked error types
3. **Structured Logging**: Can log error variants with context
4. **Future Extensibility**: Can add structured error responses to frontend
5. **Code Quality**: Consistent error handling patterns
6. **Performance**: No unnecessary string allocations from error conversion

## Testing Strategy

### Unit Tests
- Add tests for error variants
- Test error conversions to String
- Verify error messages are user-friendly

### Integration Tests
- Ensure Tauri commands still work
- Verify frontend receives error messages
- Test error propagation through call stacks

## Rollout Plan

1. **Week 1**: Phase 1 utilities (low risk)
2. **Week 2**: Phase 2 commands (medium risk)
3. **Week 3**: Phase 3 services (coordinate with Phase 2)
4. **Week 4**: Phase 4 main entry point (low risk, all deps updated)

Each phase should be:
- One PR per file or logical group
- Full test coverage
- Clear commit messages
- Backward compatible for Tauri APIs

## Rollback Plan

If issues occur:
1. Individual PRs can be reverted independently
2. No database migrations needed (error handling only)
3. Frontend unaffected (API responses unchanged)
4. Can revert to previous phase approach

## Future Improvements

After error handling is standardized:
1. Add structured error responses as JSON
2. Implement error telemetry/logging
3. Add user-friendly error messages
4. Create error recovery strategies
5. Add error context to git operations

## Files Modified by This Refactoring

### Core Error Handling (✅ Completed)
- `src-tauri/src/error.rs` - OxinotError enum and From impl

### To Migrate
- `src-tauri/src/commands/block.rs` - ~1600 lines
- `src-tauri/src/commands/page.rs` - ~400 lines
- `src-tauri/src/commands/workspace.rs` - ~800 lines
- `src-tauri/src/commands/search.rs` - ~100 lines
- `src-tauri/src/commands/wiki_link.rs` - ~50 lines
- `src-tauri/src/services/file_sync.rs` - ~200 lines
- `src-tauri/src/services/page_path_service.rs` - ~100 lines
- `src-tauri/src/services/wiki_link_index.rs` - ~300 lines
- `src-tauri/src/utils/markdown.rs` - ~800 lines
- `src-tauri/src/utils/page_sync.rs` - ~900 lines
- `src-tauri/src/lib.rs` - ~400 lines

**Total: ~6000 lines of Rust code to migrate**

## Notes

- This is a non-breaking refactoring
- Tauri API remains unchanged (String conversion happens automatically)
- No frontend changes needed
- Database schema unaffected
- Can be done incrementally over multiple sprints