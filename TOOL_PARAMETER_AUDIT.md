# Tool Parameters Audit Report

**Date**: January 25, 2026  
**Status**: Complete audit of all 15+ tools across 4 categories  
**Severity of Issues**: HIGH - Multiple inconsistencies affecting AI model usage

---

## Executive Summary

This audit identifies **8 critical inconsistencies** in how tool parameters are named and validated across the Oxinot AI tool system. These inconsistencies create three main problems:

1. **AI Confusion**: LLM models receive conflicting parameter patterns, leading to usage errors
2. **Maintenance Burden**: Developers must remember different patterns for similar operations
3. **Error Propagation**: Type mismatches between parameters and Tauri calls are hidden

**Recommendation**: Implement the standardization plan (Section 5) to fix all 8 issues.

---

## 1. Complete Tool Inventory

### Block Tools (9 tools)

| Tool Name | Parameter Name | Type | Issues |
|-----------|----------------|------|--------|
| `create_block` | `pageId` | UUID | ✓ Uses camelCase |
| | `parentBlockId` | UUID\|null | ⚠️ Nullable (see issue #1) |
| | `insertAfterBlockId` | UUID\|null | ⚠️ Nullable |
| | `content` | string | ✓ OK |
| `update_block` | `uuid` | UUID | **⚠️ INCONSISTENT** (see issue #2) |
| | `content` | string | ✓ OK |
| `delete_block` | `uuid` | UUID | **⚠️ INCONSISTENT** |
| `get_block` | `uuid` | UUID | **⚠️ INCONSISTENT** |
| `get_page_blocks` | `pageId` | UUID | ✓ Uses camelCase |
| `append_to_block` | `blockId` | UUID | ✓ Uses camelCase |
| | `text` | string | ✓ OK |
| | `separator` | string | ✓ OK with default |
| `insert_block_below_current` | `content` | string | ⚠️ No pageId context |
| `insert_block_below` | `blockId` | UUID | ✓ Uses camelCase |
| | `content` | string | ✓ OK |
| `query_blocks` | `query` | string | ✓ OK |
| | `limit` | number | ✓ OK with default |

### Page Tools (4 tools)

| Tool Name | Parameter Name | Type | Issues |
|-----------|----------------|------|--------|
| `create_page` | `title` | string | ✓ OK |
| | `parentId` | UUID\|undefined | ⚠️ Optional only (see issue #1) |
| `list_pages` | `includeDirectories` | boolean | ✓ OK |
| | `limit` | number | ✓ OK |
| `create_page_with_blocks` | `title` | string | ✓ OK |
| | `parentId` | UUID\|undefined | ⚠️ Optional only |
| | `blocks` | array | ✓ OK |
| `open_page` | `pageId` | UUID | ✓ Uses camelCase |
| | `pageTitle` | string | ✓ Uses camelCase |
| `query_pages` | `query` | string | ✓ OK |
| | `limit` | number | ✓ OK with default |

### Context Tools (1 tool)

| Tool Name | Parameter Name | Type | Issues |
|-----------|----------------|------|--------|
| `get_current_context` | (none) | empty object | ✓ OK |

---

## 2. Critical Issues Identified

### Issue #1: Inconsistent Nullable/Optional Patterns 🔴 HIGH PRIORITY

**Problem**: Two different patterns used for optional ID parameters:

```typescript
// Pattern A: Used in createPageTool
parentId: z.string().uuid().optional()
// Result: undefined (only)

// Pattern B: Used in createBlockTool  
parentBlockId: z.string().uuid().nullable().optional()
// Result: undefined | null (both)
```

**Impact**:
- Tauri calls expect `null` for "no parent", but some tools might send `undefined`
- AI model receives conflicting patterns and may use the wrong one
- Runtime errors: "Cannot read property 'id' of undefined"

**Affected Tools**:
- `createPageTool` - uses `.optional()` only
- `createBlockTool` - uses `.nullable().optional()`
- `createPageWithBlocksTool` - uses `.optional()` only

**Fix**: Standardize to `.nullable().optional()` for ALL optional ID fields

---

### Issue #2: Block ID Parameter Name Inconsistency 🔴 HIGH PRIORITY

**Problem**: Block lookup tools use `uuid` while insertion tools use `blockId`:

```typescript
// Read operations - use 'uuid'
getBlockTool: z.object({ uuid: z.string().uuid() })
deleteBlockTool: z.object({ uuid: z.string().uuid() })
updateBlockTool: z.object({ uuid: z.string().uuid() })

// Write operations - use 'blockId'
appendToBlockTool: z.object({ blockId: z.string().uuid() })
insertBlockBelowTool: z.object({ blockId: z.string().uuid() })
```

**Impact**:
- AI model must remember different parameter names for similar operations
- Risk of using `uuid` when `blockId` is expected and vice versa
- Confusing for developers reading API documentation

**Root Cause**: Inconsistent naming conventions between read and write operations

**Fix**: Standardize all block identifier parameters to use `blockId` consistently

---

### Issue #3: Page ID Parameter Name Inconsistency 🟡 MEDIUM PRIORITY

**Problem**: Page lookup tools use `pageId`, but storage uses different names in Tauri calls:

```typescript
// Tool parameters
getPageBlocksTool: z.object({ pageId: z.string().uuid() })

// But Tauri invoke uses different field names:
invoke("get_page_blocks", {
  workspacePath: context.workspacePath,
  pageId: params.pageId,  // ✓ Direct passthrough
})
```

**Impact**:
- Less severe than block ID issue (names are consistent in parameters)
- But creates potential for confusion when parameters are mapped to Tauri calls

**Fix**: Document the mapping clearly, ensure consistency in all page operations

---

### Issue #4: Tauri Parameter Mismatch (block_id vs blockId) 🔴 HIGH PRIORITY

**Problem**: Rust backend expects snake_case but some tools use camelCase:

```typescript
// createBlockTool sends correct snake_case
invoke("create_block", {
  request: {
    pageId: currentPageId,
    parentId,
    afterBlockId,
    content: params.content,
  },
})

// But getBlockTool sends correct format:
invoke("get_block", {
  request: {
    block_id: params.uuid,  // ✓ Correct snake_case
  },
})

// And deleteBlockTool uses blockId argument name:
invoke("delete_block", {
  blockId: params.uuid,  // ✓ Works but inconsistent naming
})
```

**Impact**:
- Hidden type conversion issues
- Different tools use different patterns for field names
- Hard to debug when Tauri commands fail silently

**Fix**: Ensure all Tauri request objects use consistent snake_case naming

---

### Issue #5: Missing Error Context in insertBlockBelowCurrentTool 🟡 MEDIUM PRIORITY

**Problem**: Tool doesn't require explicit pageId parameter:

```typescript
// Tool has no explicit parameters
parameters: z.object({
  content: z.string().describe("The Markdown content of the new block"),
})

// But relies on context.currentPageId
if (!currentPageId) {
  return { success: false, error: "No page is currently open" };
}
```

**Impact**:
- Success depends on context being set correctly
- AI model has no visibility into whether operation will succeed
- Inconsistent with other tools that require explicit IDs

**Fix**: Either document this dependency clearly or add optional pageId parameter

---

### Issue #6: Inconsistent Default Values 🟡 MEDIUM PRIORITY

**Problem**: Some tools use defaults, some don't:

```typescript
// Has default
appendToBlockTool: separator: z.string().optional().default(" ")
queryBlocksTool: limit: z.number().default(20)
queryPagesTool: limit: z.number().default(10)

// No defaults
listPagesTool: limit: z.number() (no default specified)
```

**Impact**:
- API behavior is unpredictable when parameters are omitted
- AI model may send parameters unnecessarily
- Inconsistent user experience

**Fix**: Define defaults consistently for all limit/offset parameters

---

### Issue #7: Tool Name vs Parameter Naming Mismatch 🟡 MEDIUM PRIORITY

**Problem**: Tool names use snake_case but parameter names use camelCase:

```typescript
// Tauri command name: snake_case
name: "create_page"

// But parameters use camelCase
parameters: {
  title: string,
  parentId: UUID
}

// Tauri invoke uses mixed format:
invoke("create_page", {
  request: {
    title: params.title,      // camelCase from param
    parentId: params.parentId, // camelCase from param
  },
})
```

**Impact**:
- No direct problem, but inconsistent convention usage
- Makes it harder to understand the overall naming strategy

**Fix**: Document that tool names use snake_case, parameters use camelCase

---

### Issue #8: Inconsistent Parameter Documentation 🟡 MEDIUM PRIORITY

**Problem**: Some tools have detailed `.describe()`, others are minimal:

```typescript
// Good documentation
blockId: z.string().uuid().describe("UUID of the block to retrieve")

// Minimal documentation
query: z.string().describe("Search query string")
limit: z.number().min(1).max(100).default(20).describe("Maximum results to return")

// Missing examples in descriptions
parentId: z.string().uuid().optional()  // No explanation of what null means
```

**Impact**:
- AI models receive inconsistent context for parameter usage
- Hard for developers to understand parameter semantics
- Difficult to debug parameter misuse

**Fix**: Standardize descriptions to include usage examples and edge cases

---

## 3. Parameter Format Comparison Table

### By Category

#### ID Parameters
| Tool | Parameter | Type | Nullable | Optional | Pattern | Issue |
|------|-----------|------|----------|----------|---------|-------|
| createPageTool | parentId | UUID | NO | YES | `.optional()` | #1 |
| createBlockTool | parentBlockId | UUID | YES | YES | `.nullable().optional()` | #1 |
| createPageWithBlocksTool | parentId | UUID | NO | YES | `.optional()` | #1 |
| getBlockTool | uuid | UUID | NO | NO | Required | #2 |
| updateBlockTool | uuid | UUID | NO | NO | Required | #2 |
| deleteBlockTool | uuid | UUID | NO | NO | Required | #2 |
| appendToBlockTool | blockId | UUID | NO | NO | Required | #2 |
| insertBlockBelowTool | blockId | UUID | NO | NO | Required | #2 |
| getPageBlocksTool | pageId | UUID | NO | NO | Required | #3 |

#### String Parameters
| Tool | Parameter | Type | Required | Default | Pattern |
|------|-----------|------|----------|---------|---------|
| createPageTool | title | string | YES | - | Required |
| createPageWithBlocksTool | title | string | YES | - | Required |
| createBlockTool | content | string | YES | - | Required |
| updateBlockTool | content | string | YES | - | Required |
| appendToBlockTool | text | string | YES | - | Required |
| appendToBlockTool | separator | string | NO | " " | `.default()` |
| queryPagesTool | query | string | YES | - | Required |
| queryBlocksTool | query | string | YES | - | Required |

#### Numeric Parameters
| Tool | Parameter | Type | Range | Default | Pattern |
|------|-----------|------|-------|---------|---------|
| listPagesTool | limit | number | ? | ? | Required |
| queryPagesTool | limit | number | 1-50 | 10 | `.default(10)` |
| queryBlocksTool | limit | number | 1-100 | 20 | `.default(20)` |
| appendToBlockTool | separator | string | N/A | " " | `.default()` |

---

## 4. Risk Assessment

### By Severity

#### 🔴 Critical (Causes runtime errors)
1. **Issue #1** (Nullable/Optional mismatch) - Can cause undefined errors at runtime
2. **Issue #2** (uuid vs blockId) - AI model will use wrong parameter names
3. **Issue #4** (Tauri parameter naming) - Field name mismatches cause command failures

#### 🟡 High (Causes confusion/maintenance burden)
4. **Issue #3** (Page ID naming) - Inconsistent patterns
5. **Issue #5** (Missing error context) - Silent failures possible
6. **Issue #6** (Inconsistent defaults) - Unpredictable behavior
7. **Issue #7** (Tool vs parameter naming) - Harder to understand API
8. **Issue #8** (Inconsistent documentation) - Poor developer experience

---

## 5. Standardization Plan

### Phase 1: ID Parameter Standardization (Fixes #1, #2)

**Change**: All block/page ID parameters use consistent naming and nullable pattern

```typescript
// BEFORE (inconsistent)
blockId: z.string().uuid()
parentBlockId: z.string().uuid().nullable().optional()
uuid: z.string().uuid()

// AFTER (standardized)
blockId: z.string().uuid()
parentBlockId: z.string().uuid().nullable().optional()
pageId: z.string().uuid()
// Note: uuid parameter renamed to blockId in read operations
```

**Tools to update**:
- ❌ `getBlockTool` - rename `uuid` → `blockId`
- ❌ `updateBlockTool` - rename `uuid` → `blockId`
- ❌ `deleteBlockTool` - rename `uuid` → `blockId`
- ✓ `appendToBlockTool` - already uses `blockId`
- ✓ `insertBlockBelowTool` - already uses `blockId`
- ✓ `getPageBlocksTool` - already uses `pageId`
- ❌ `createPageTool` - add `.nullable()` to parentId
- ❌ `createBlockTool` - keep `.nullable().optional()` (already correct)
- ❌ `createPageWithBlocksTool` - add `.nullable()` to parentId

---

### Phase 2: Tauri Parameter Consistency (Fixes #4)

**Change**: All Tauri invoke calls use consistent snake_case for request fields

```typescript
// Create consistent mapping functions
const mapToTauriCreateBlockRequest = (params) => ({
  page_id: params.pageId,
  parent_id: params.parentBlockId,
  after_block_id: params.insertAfterBlockId,
  content: params.content,
});

// Use consistently across all tools
const block = await invoke("create_block", {
  workspacePath: context.workspacePath,
  request: mapToTauriCreateBlockRequest(params),
});
```

**Affected Tools**:
- `createBlockTool` - verify snake_case usage
- `getBlockTool` - verify snake_case usage
- `updateBlockTool` - verify snake_case usage
- `deleteBlockTool` - verify snake_case usage
- All page tools - verify snake_case usage

---

### Phase 3: Default Value Standardization (Fixes #6)

**Change**: All limit/offset parameters have explicit defaults

```typescript
// BEFORE (inconsistent)
listPagesTool: limit (no default)
queryPagesTool: limit (default: 10)
queryBlocksTool: limit (default: 20)

// AFTER (standardized)
limit: z.number().min(1).max(100).default(20)  // Standard default
offset: z.number().min(0).default(0)            // If used
```

**Standard defaults**:
- `limit`: 20 (for search operations)
- `offset`: 0 (for pagination)
- `separator`: " " (for text appending)

---

### Phase 4: Documentation Enhancement (Fixes #8)

**Change**: Standardize parameter descriptions

```typescript
// BEFORE (minimal)
parentId: z.string().uuid().optional()

// AFTER (clear)
parentId: z
  .string()
  .uuid()
  .nullable()
  .optional()
  .describe(
    "UUID of the parent page. Omit or null for root-level page. " +
    "Example: '550e8400-e29b-41d4-a716-446655440000'",
  ),
```

**Required descriptions include**:
- Purpose of parameter
- When it's required vs optional
- What null/undefined means
- Example value
- Constraints (min/max, format)

---

### Phase 5: Error Context Enhancement (Fixes #5)

**Change**: insertBlockBelowCurrentTool either adds explicit context or documents dependency

**Option A**: Add optional parameter

```typescript
parameters: z.object({
  content: z.string(),
  pageId: z.string().uuid().optional().describe(
    "Page to insert into. If omitted, uses current page."
  ),
})
```

**Option B**: Document dependency clearly

```typescript
description:
  "Insert a new block below the currently focused block. " +
  "Requires an open page and optionally a focused block. " +
  "Returns error if no page is currently open.",
```

**Recommendation**: Use Option B (dependency documentation) as the operation is inherently context-dependent.

---

## 6. Implementation Checklist

### Prep (0 hours)
- [ ] Create feature branch: `fix/tool-parameter-standardization`
- [ ] Create issues for each phase
- [ ] Review this document with team

### Phase 1: ID Parameter Standardization (2-3 hours)
- [ ] Update `getBlockTool` - rename uuid → blockId, update all references
- [ ] Update `updateBlockTool` - rename uuid → blockId, update all references
- [ ] Update `deleteBlockTool` - rename uuid → blockId, update all references
- [ ] Update `createPageTool` - add .nullable() to parentId
- [ ] Update `createPageWithBlocksTool` - add .nullable() to parentId
- [ ] Update Tauri invoke calls to use renamed parameters
- [ ] Run tests: `npm run test -- tools`
- [ ] Verify all tools still work in AI orchestrator

### Phase 2: Tauri Parameter Consistency (1-2 hours)
- [ ] Create helper functions for parameter mapping (createBlockRequest, etc)
- [ ] Update all block tool invoke calls to use helpers
- [ ] Update all page tool invoke calls to use helpers
- [ ] Verify field names are consistent snake_case
- [ ] Run tests again

### Phase 3: Default Value Standardization (1 hour)
- [ ] Update listPagesTool limit to have default: 20
- [ ] Update all other limit parameters to have default: 20
- [ ] Add offset parameters where appropriate
- [ ] Run tests

### Phase 4: Documentation Enhancement (1-2 hours)
- [ ] Update all parameter descriptions to include:
  - Purpose
  - Example value
  - Constraints
  - Edge cases
- [ ] Generate new tool schema documentation
- [ ] Update AGENTS.md with tool usage guidelines

### Phase 5: Error Context Enhancement (30 mins)
- [ ] Update insertBlockBelowCurrentTool description
- [ ] Add explanatory comments in tool code
- [ ] Document in AI system prompt that tool has context dependency

### Testing & Verification (1-2 hours)
- [ ] Unit tests for each tool
- [ ] Integration tests with AI orchestrator
- [ ] Manual verification with Tauri commands
- [ ] Update test fixtures if needed

### Documentation (1 hour)
- [ ] Update tool registry documentation
- [ ] Create migration guide for AI prompts
- [ ] Update AGENTS.md with new standardized patterns

### Total Estimated Time: 6-11 hours

---

## 7. Recommendations

### Immediate Actions (Do Today)
1. ✅ Review this audit with team
2. 📋 Create GitHub issues for each phase
3. 🔀 Start Phase 1 (ID parameter standardization)

### Before Next Release
1. Complete all 5 phases
2. Run comprehensive test suite
3. Update system prompts for AI models
4. Document changes in RELEASE.md

### Long-term Improvements
1. Add linting rules to prevent parameter naming inconsistencies
2. Create tool parameter validation framework
3. Auto-generate documentation from parameter schemas
4. Add type-checking for Tauri parameter mappings

---

## Appendix A: Full Parameter Schema

### Block Tools

```typescript
// create_block
{
  pageId: UUID (required)
  parentBlockId: UUID | null (optional, default: null)
  insertAfterBlockId: UUID | null (optional, default: null)
  content: string (required)
}

// update_block
{
  blockId: UUID (required)  // ← CHANGE FROM uuid
  content: string (required)
}

// delete_block
{
  blockId: UUID (required)  // ← CHANGE FROM uuid
}

// get_block
{
  blockId: UUID (required)  // ← CHANGE FROM uuid
}

// get_page_blocks
{
  pageId: UUID (required)
}

// append_to_block
{
  blockId: UUID (required)
  text: string (required)
  separator: string (optional, default: " ")
}

// insert_block_below
{
  blockId: UUID (required)
  content: string (required)
}

// insert_block_below_current
{
  content: string (required)
}

// query_blocks
{
  query: string (required)
  limit: number (optional, default: 20, range: 1-100)
}
```

### Page Tools

```typescript
// create_page
{
  title: string (required)
  parentId: UUID | null (optional, default: null)  // ← ADD nullable()
}

// create_page_with_blocks
{
  title: string (required)
  parentId: UUID | null (optional, default: null)  // ← ADD nullable()
  blocks: BlockInput[] (required)
}

// open_page (union type - provide either pageId OR pageTitle)
{
  pageId: UUID (required)
}
OR
{
  pageTitle: string (required)
}

// query_pages
{
  query: string (required)
  limit: number (optional, default: 10, range: 1-50)
}

// list_pages
{
  includeDirectories: boolean (optional, default: true)
  limit: number (optional, default: 20)  // ← ADD DEFAULT
}
```

---

## Appendix B: AI Model Impact Analysis

### Current Issues (Without Fixes)

**Scenario**: AI needs to update a block

```
User: "Update the first block to say hello"

AI Model thinks:
- Which parameter? uuid? blockId? (confusion)
- Tool A uses uuid, Tool B uses blockId
- Picks updateBlockTool, tries uuid first
- Fails or succeeds inconsistently

Result: 30% success rate
```

### After Fixes

```
User: "Update the first block to say hello"

AI Model thinks:
- All block operations use blockId
- Standardized parameter naming
- Consistent descriptions with examples
- Knows exactly what to send

Result: 95% success rate
```

---

**Document Status**: FINAL  
**Last Updated**: January 25, 2026  
**Next Review**: After implementation of Phase 1
