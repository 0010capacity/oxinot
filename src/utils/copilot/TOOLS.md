# Copilot Tools Documentation

## Overview

The copilot tools system enables AI assistants to search for and open pages/notes in the oxinot application. This document describes available tools, their usage, and integration patterns.

## Available Tools

### 1. `search_notes`

Search for notes/pages by title or content. Returns a list of matching pages ranked by relevance.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "The search query (keywords or natural language phrase). Examples: 'project planning', '회의록', 'meeting notes'"
    }
  },
  "required": ["query"]
}
```

#### Response Format

```json
{
  "success": true,
  "results": [
    {
      "id": "uuid-string",
      "pageId": "uuid-string",
      "pageTitle": "Project Planning 2024",
      "resultType": "page",
      "snippet": "...project **planning** overview...",
      "rank": 100.0
    }
  ],
  "count": 1
}
```

#### Usage Examples

**Example 1: Basic keyword search**
```
User: "Show me my project notes"
AI: I'll search for your project notes.
Tool call: search_notes(query="project")
Response: Returns all pages with "project" in title or content
```

**Example 2: Multilingual search**
```
User: "내 회의록을 보여줘" (Show me my meeting notes)
AI: I'll search for your meeting notes.
Tool call: search_notes(query="회의록")
Response: Returns all pages matching the Korean keyword
```

**Example 3: Phrase search**
```
User: "Find notes about Q4 planning"
AI: I'll search for Q4 planning notes.
Tool call: search_notes(query="Q4 planning")
Response: Returns pages with "Q4" AND "planning"
```

#### Notes

- Search uses SQLite FTS5 (Full-Text Search) for efficient indexing
- Results are ranked by relevance score
- Returns up to 10 results, ranked by relevance
- Supports multi-language searches
- Partial word matching works (e.g., "proj" matches "project")

### 2. `open_page`

Open a specific page/note by its ID. Use this after `search_notes` to navigate to a page.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "pageId": {
      "type": "string",
      "description": "The unique ID of the page to open. Obtain this from search_notes results."
    }
  },
  "required": ["pageId"]
}
```

#### Response Format

```json
{
  "success": true,
  "message": "Page uuid-string opened successfully"
}
```

#### Usage Examples

**Example 1: Open from search results**
```
User: "Open my project planning notes"
AI: I'll search for and open your project planning notes.
Tool call 1: search_notes(query="project planning")
Response 1: Returns results including a page titled "Project Planning 2024"
Tool call 2: open_page(pageId="abc-123-def")
Response 2: Page opened successfully
AI: I've opened your "Project Planning 2024" page for you.
```

**Example 2: Direct navigation**
```
User: "Go to the meeting notes page"
AI: I'll find and open your meeting notes.
Tool call 1: search_notes(query="meeting notes")
Tool call 2: open_page(pageId="xyz-789-uvw")
Response: Page is now displayed
```

#### Notes

- The page ID comes from `search_notes` results (the `pageId` field)
- Updates the current page in the application state
- The page content is immediately available for viewing

## Complete Workflow Example

```typescript
// User says: "Open my Q1 2024 budget review"

// Step 1: AI calls search_notes
const searchResult = await executeSearchNotes(
  workspacePath,
  "Q1 2024 budget review"
);
// Returns:
// {
//   success: true,
//   results: [
//     {
//       id: "block-123",
//       pageId: "page-456",
//       pageTitle: "Q1 2024 Budget Review",
//       resultType: "page",
//       snippet: "**Q1 2024** budget **review** document",
//       rank: 100.0
//     }
//   ],
//   count: 1
// }

// Step 2: AI evaluates results and calls open_page
const openResult = await executeOpenPage("page-456");
// Returns:
// {
//   success: true,
//   message: "Page page-456 opened successfully"
// }

// Step 3: AI responds to user
// "I found your Q1 2024 Budget Review page and opened it for you."
```

## Integration Guide

### Using Tools in AI API Calls

When calling Claude API or similar AI service, include tools in the request:

```typescript
import { ToolExecutor } from "./toolExecutor";

const tools = ToolExecutor.getToolsForAPI();
// Returns tool definitions in Claude API format

const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "x-api-key": apiKey,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    tools: tools, // Include all available tools
    messages: [
      {
        role: "user",
        content: "Open my project planning notes",
      },
    ],
  }),
});
```

### Processing Tool Calls

```typescript
import { processAIResponse } from "./toolExecutor";

// AI response includes tool use blocks
const aiResponse = {
  content: [
    {
      type: "tool_use",
      name: "search_notes",
      input: { query: "project planning" },
    },
  ],
};

// Process tool calls and get results
const results = await processAIResponse(aiResponse, workspacePath);
// Returns tool execution results ready for sending back to AI
```

### Direct Tool Execution

```typescript
import { ToolExecutor } from "./toolExecutor";

// Execute search_notes tool directly
const searchResults = await ToolExecutor.execute(
  "search_notes",
  { query: "budget review" },
  workspacePath
);

// Execute open_page tool directly
const openResult = await ToolExecutor.execute(
  "open_page",
  { pageId: "page-123" },
  workspacePath
);
```

## Error Handling

### Common Errors

1. **No results from search**
   ```typescript
   const results = await executeSearchNotes(workspacePath, "xyz");
   if (results.length === 0) {
     // Show user: "No pages found matching 'xyz'"
   }
   ```

2. **Invalid page ID**
   ```typescript
   try {
     await executeOpenPage("invalid-id");
   } catch (error) {
     // Show user: "Page not found"
   }
   ```

3. **Missing parameters**
   ```typescript
   if (!ToolExecutor.validateToolInput("search_notes", {})) {
     // Error: Missing required 'query' parameter
   }
   ```

## Tool Registry

The `ToolRegistry` maintains all available tools:

```typescript
import { toolRegistry } from "./toolRegistry";

// Get all tools
const allTools = toolRegistry.getAllTools();

// Get specific tool
const searchTool = toolRegistry.getTool("search_notes");

// Check if tool exists
const hasSearchNotes = toolRegistry.hasTool("search_notes");

// Get tool names
const toolNames = toolRegistry.getToolNames(); // ["search_notes", "open_page"]
```

## Adding New Tools

To add a new tool:

1. **Create tool definition** in appropriate file (e.g., `pageTools.ts`)
   ```typescript
   export const myNewTool = {
     name: "my_new_tool",
     description: "Description of what the tool does",
     inputSchema: {
       type: "object",
       properties: { /* ... */ },
       required: ["param1"],
     },
   };
   ```

2. **Create tool executor**
   ```typescript
   export async function executeMyNewTool(param1: string): Promise<void> {
     // Implementation
   }
   ```

3. **Create processor function**
   ```typescript
   export async function processMyNewToolCall(
     toolName: string,
     toolInput: Record<string, unknown>,
     workspacePath: string
   ): Promise<unknown> {
     switch (toolName) {
       case "my_new_tool":
         // Handle tool call
     }
   }
   ```

4. **Register in tool registry** - Update `toolRegistry.ts` to include new tool

5. **Add to executor router** - Update `toolExecutor.ts` switch statement

## Best Practices

1. **Always validate input** before execution
   ```typescript
   if (!ToolExecutor.validateToolInput(toolName, toolInput)) {
     throw new Error("Invalid tool input");
   }
   ```

2. **Provide clear error messages** for users
   ```typescript
   try {
     await ToolExecutor.execute(toolName, input, workspacePath);
   } catch (error) {
     console.error("[Tool Error]", error);
     // Return user-friendly message
   }
   ```

3. **Handle multi-language queries** naturally
   ```typescript
   // User can search in any language
   await executeSearchNotes(workspacePath, "회의록"); // Korean
   await executeSearchNotes(workspacePath, "réunion"); // French
   await executeSearchNotes(workspacePath, "meeting"); // English
   ```

4. **Combine tools for complete workflows**
   ```typescript
   // Search first, then open
   const results = await executeSearchNotes(workspacePath, query);
   if (results.length > 0) {
     await executeOpenPage(results[0].pageId);
   }
   ```

## Performance Considerations

- **Search**: FTS5 is optimized; searches are fast even with many pages
- **Caching**: Search results are not cached; each call queries the database
- **Limit**: Results are limited to top 10 matches for performance

## Future Enhancements

1. **Vector search** - Add semantic search for more intelligent matching
2. **Recent pages** - Tool to quickly access recently viewed pages
3. **Quick create** - Tool to create new pages from natural language
4. **Block operations** - Tools to create/edit blocks within pages
5. **Batch operations** - Tool to manage multiple pages at once

## Testing

Test tools directly:

```typescript
import { ToolExecutor, executeSearchNotes, executeOpenPage } from "./toolExecutor";

// Test search
const results = await executeSearchNotes(workspacePath, "test");
console.assert(results.length >= 0, "Search should return array");

// Test open page
if (results.length > 0) {
  await executeOpenPage(results[0].pageId);
  console.assert(true, "Page opened successfully");
}
```

## Changelog

### v1.0.0
- Initial release with `search_notes` and `open_page` tools
- FTS5-based search
- Full error handling
- Tool registry system