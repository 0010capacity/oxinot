# Copilot Tools - Debugging Guide

## Overview

This guide shows how to test and debug the copilot tools using the browser console. Perfect for verifying that search and page opening functionality work correctly.

## Quick Start

### 1. Open Browser Console

Press `F12` or `Cmd+Option+I` (Mac) to open developer tools, then go to the **Console** tab.

### 2. Initialize Debug Interface

When the app loads, you'll see:
```
📋 Copilot Debug Tools Ready! Type: window.__copilotDebug.help()
```

Call the help function:
```javascript
window.__copilotDebug.help()
```

You'll see all available debug commands.

## Available Debug Commands

### `debugSearch(query)` - Test Search

Search for pages by query:

```javascript
// Simple search
await window.__copilotDebug.search("project planning")

// Multi-language search
await window.__copilotDebug.search("회의록")

// Partial word match
await window.__copilotDebug.search("budget")
```

**Console Output:**
- Workspace path
- Query being searched
- Number of results found
- Table with top results showing:
  - Rank (1-10)
  - Title
  - Type (page or block)
  - Score (relevance)
  - Snippet preview

### `debugOpen(pageId)` - Test Opening Page

Open a page by ID:

```javascript
// Open a page (replace with actual page ID)
await window.__copilotDebug.open("abc-123-def-456")
```

**Console Output:**
- Page ID being opened
- Page title (if found in store)
- Page path
- Success confirmation
- Verification that page is now current

### `debugSearchAndOpen(query)` - Complete Workflow

Test the full search and open workflow:

```javascript
// Search for pages and automatically open the top result
await window.__copilotDebug.searchAndOpen("project planning")
```

**Console Output:**
- Search phase:
  - Query used
  - Number of results
  - Top result details
- Open phase:
  - Page being opened
  - Success confirmation
  - Verification pass/fail

### `debugValidateTools()` - Test Input Validation

Test that tool inputs are validated correctly:

```javascript
window.__copilotDebug.validateTools()
```

**Tests:**
1. Valid `search_notes` input (with query) → ✓ PASS
2. Invalid `search_notes` input (missing query) → ✓ PASS
3. Valid `open_page` input (with pageId) → ✓ PASS
4. Invalid `open_page` input (missing pageId) → ✓ PASS

### `debugInspectTools()` - View Tool Definitions

Inspect all available tools and their schemas:

```javascript
window.__copilotDebug.inspectTools()
```

**Output:**
- Table of tools with names and descriptions
- Detailed view of each tool:
  - Name
  - Description
  - Input type (object)
  - Required fields
  - Property types

### `debugSimulateAIResponse(toolName, toolInput)` - Simulate AI

Simulate receiving a response from Claude API:

```javascript
// Simulate search_notes tool call
await window.__copilotDebug.simulateAIResponse("search_notes", {
  query: "project planning"
})

// Simulate open_page tool call
await window.__copilotDebug.simulateAIResponse("open_page", {
  pageId: "page-123-abc"
})
```

**Console Output:**
- Text content from simulated response
- Tool call details
- Tool execution results
- Success/error status

### `debugPrintSystemInfo()` - System State

Print current system information:

```javascript
window.__copilotDebug.systemInfo()
```

**Output:**
- Workspace path
- Current page ID and title
- Total pages in store
- Loading state
- Available tools
- Environment info (dev/prod)

### `debugInteractive()` - Help Message

Show the help message again:

```javascript
window.__copilotDebug.help()
```

## Testing Workflow

### Basic Testing Flow

```javascript
// 1. Check system state
window.__copilotDebug.systemInfo()

// 2. Inspect available tools
window.__copilotDebug.inspectTools()

// 3. Validate tool inputs
window.__copilotDebug.validateTools()

// 4. Test search
await window.__copilotDebug.search("your-search-query")

// 5. Test open (use a page ID from search results)
await window.__copilotDebug.open("page-id-from-results")

// 6. Test complete workflow
await window.__copilotDebug.searchAndOpen("your-search-query")
```

## Understanding Console Output

### Success Indicators

- ✓ Green checkmark = Operation succeeded
- ℹ Blue info icon = Informational message
- ⚠ Yellow warning = Something unexpected but not critical
- ✗ Red X = Error occurred

### Timing Information

The console shows performance metrics:
```
✓ Search completed in 123.45ms
✓ Page opened successfully in 45.67ms
```

This helps identify slow operations.

### Structured Logging

Console output is organized in groups (collapsible sections):

```
[pageTools] ℹ Executing search...
  ├─ [pageTools] Query: "project planning"
  ├─ [pageTools] Workspace: "/users/user/workspace"
  └─ [pageTools] ✓ Results: 5 items
```

Click the arrow to expand/collapse groups for detailed inspection.

## Common Scenarios

### Scenario 1: Search Not Finding Results

```javascript
// 1. Check workspace is loaded
window.__copilotDebug.systemInfo()
// Look for: "Path" should not be "None selected"

// 2. Try a simple search
await window.__copilotDebug.search("test")
// Look for: Should show some results

// 3. Try with actual keywords from your notes
await window.__copilotDebug.search("your-page-title")
// Look for: Your page should appear in results
```

**What to check:**
- Is workspace selected? (Check systemInfo output)
- Are there any pages in the workspace? (Check "Total Pages" in systemInfo)
- Do your pages contain the search terms? (Try exact page title)

### Scenario 2: Page Not Opening

```javascript
// 1. Verify system state
window.__copilotDebug.systemInfo()
// Look for: Current Page ID should update after opening

// 2. Get a valid page ID
await window.__copilotDebug.search("any-query")
// Look for: Top result's "Page ID" in output

// 3. Try to open that page
await window.__copilotDebug.open("page-id-from-search")
// Look for: "Verification passed" in output
```

**What to check:**
- Does the console show "✓ Page opened successfully"?
- Does "Current Page ID" match the page you tried to open?
- Check the UI - does the page appear to load?

### Scenario 3: Slow Performance

```javascript
// Check timing information in console
await window.__copilotDebug.searchAndOpen("query")

// Look at timing logs:
// [tauriAPI.searchContent] ✓ Search completed in 523.45ms
//   → If > 1000ms, search is slow (might be large database)
// 
// [pageTools] ✓ Page opened in 45.67ms
//   → If > 200ms, UI update is slow
```

**What to check:**
- Search timing: Is Rust backend responsive?
- Open timing: Is React state update responsive?
- Total pages count: Large workspaces may be slower

### Scenario 4: AI Integration Testing

```javascript
// Simulate what Claude API would call
await window.__copilotDebug.simulateAIResponse("search_notes", {
  query: "my query"
})

// Watch console for:
// ✓ Tool execution completed in Xms
// Results returned to AI

// Then simulate opening the result
await window.__copilotDebug.simulateAIResponse("open_page", {
  pageId: "page-id"
})

// Watch for page to open
```

## Reading Console Output

### Example: Search Output

```
══════════════════════════════════════════════
[pageTools] Testing Search Functionality
══════════════════════════════════════════════

[pageTools] ℹ Starting search test
[pageTools] Query: project planning
[pageTools] Workspace: /workspace/path

[tauriAPI.searchContent] Initiating search request
[tauriAPI.searchContent] Query: project planning
[tauriAPI.searchContent] Workspace: /workspace/path
[tauriAPI.searchContent] ✓ Search completed in 234.56ms
[tauriAPI.searchContent] Results received: 3 items

[pageTools] ✓ Search completed
[pageTools] Results count: 3

Top results:
┌─────────┬──────────────────┬────────┬───────┬──────────────────┐
│ (index) │      title       │  type  │ score │     snippet      │
├─────────┼──────────────────┼────────┼───────┼──────────────────┤
│    0    │ Project Planning │ page   │ 100.0 │ **project** plan  │
│    1    │ Q1 Planning      │ page   │  85.5 │ **planning** Q1   │
│    2    │ Team Planning    │ block  │  78.0 │ team **planning** │
└─────────┴──────────────────┴────────┴───────┴──────────────────┘
```

### Example: Open Output

```
══════════════════════════════════════════════
[pageTools] Testing Open Page Functionality
══════════════════════════════════════════════

[pageTools] ℹ Opening page with ID: abc-123-def
[pageTools] ✓ Page opened successfully in 45.67ms
[pageTools] Current Page ID: abc-123-def
[pageTools] ✓ Verification passed: Page is now current
```

## Troubleshooting

### Issue: `window.__copilotDebug is undefined`

**Solution:** The page hasn't fully loaded yet. Wait a moment and try again, or refresh the page.

### Issue: `debugSearch` returns empty array

**Possible causes:**
1. Workspace not selected - Check `debugPrintSystemInfo()`
2. No pages in workspace - Check total pages count
3. Search query doesn't match any pages - Try simpler keywords
4. FTS index not updated - Try reindexing workspace

### Issue: `debugOpen` doesn't update the page

**Possible causes:**
1. Invalid page ID - Verify ID is correct from search results
2. Page doesn't exist - Confirm page ID is valid
3. Store not updated - Check browser console for errors
4. React component not responding - Check for JavaScript errors

### Issue: Slow search performance

**Possible causes:**
1. Large workspace with many pages
2. Complex search query
3. Rust backend under load
4. Database needs optimization

**Solution:** Try simpler queries or check system performance.

### Issue: Errors in console

**How to handle:**
1. Read the error message carefully
2. Check the stack trace for context
3. Note the exact steps to reproduce
4. Check if it's a known issue
5. Enable full debug logging for more details

## Advanced Debugging

### Enable Detailed Logging

The logging level is controlled by environment:
- **Development** (`npm run dev`): Full logging with console.log and console.debug
- **Production**: Only info, warn, and error messages

To see more details, ensure you're running in development mode.

### Inspect Page Store

```javascript
// Get current page store state
const pageStore = window.__STORE__.pageStore || window.__STORE__?.page
console.log(pageStore)

// Check current page
const currentPageId = pageStore.currentPageId
console.log("Current page:", currentPageId)

// List all pages
console.log("All pages:", pageStore.pageIds.length)
```

### Check Workspace Store

```javascript
// Get workspace path
const workspace = window.__STORE__.workspace
console.log("Workspace path:", workspace.workspacePath)
```

### Monitor Network Calls

1. Open DevTools → Network tab
2. Run a debug command: `await window.__copilotDebug.search("query")`
3. Look for `search_content` Tauri command call
4. Check response includes search results

## Tips & Tricks

### Quick Search Loop

Test multiple searches quickly:

```javascript
const queries = ["project", "meeting", "budget", "review"]
for (const q of queries) {
  await window.__copilotDebug.search(q)
  console.log("---")
}
```

### Search and Extract IDs

Get all page IDs from search:

```javascript
// In a separate terminal/script
const results = await executeSearchNotes(workspacePath, "your-query")
const ids = results.map(r => r.pageId)
console.log(ids)
```

### Test All Tools Sequentially

```javascript
async function testAll() {
  window.__copilotDebug.inspectTools()
  window.__copilotDebug.validateTools()
  await window.__copilotDebug.search("test")
  window.__copilotDebug.systemInfo()
}
await testAll()
```

## Performance Baselines

Expected performance ranges:

| Operation | Min | Average | Max |
|-----------|-----|---------|-----|
| Search (< 100 pages) | 50ms | 150ms | 300ms |
| Search (100-1000 pages) | 100ms | 300ms | 800ms |
| Open page | 10ms | 45ms | 100ms |
| Input validation | 1ms | 2ms | 5ms |
| Tool execution setup | 5ms | 15ms | 30ms |

If your times exceed "Max", investigate potential issues.

## Next Steps

After debugging successfully:

1. **Test with actual AI**: Integrate with Claude API
2. **Monitor in production**: Watch error logs for issues
3. **Optimize if needed**: Profile slow operations
4. **Document findings**: Share results with team

## Support

If you encounter issues:

1. Check this debugging guide
2. Run all diagnostic commands
3. Document the exact steps to reproduce
4. Check browser console for full error details
5. Review the code comments in `debug.ts`
