# Copilot Tools System

A comprehensive tool system for AI copilots to search and navigate notes/pages in oxinot. This enables natural language interactions like "Open my project planning notes" that the AI can fulfill by searching and opening pages.

## 🎯 Overview

The copilot tools provide a structured way for AI assistants to:

1. **Search for pages** using natural language queries
2. **Open pages** by ID
3. **Handle multi-language** queries seamlessly
4. **Validate inputs** before execution
5. **Process AI responses** with tool use blocks

## 📦 Package Structure

```
src/utils/copilot/
├── README.md                    # This file
├── TOOLS.md                     # Detailed tool documentation
├── index.ts                     # Main exports
├── pageTools.ts                 # Page search & open tools
├── toolRegistry.ts              # Tool registry system
├── toolExecutor.ts              # Tool execution & routing
├── examples.ts                  # Usage examples
├── __tests__/
│   ├── pageTools.test.ts       # Page tools tests
│   └── toolExecutor.test.ts    # Executor tests
```

## 🚀 Quick Start

### Basic Usage

```typescript
import {
  executeSearchNotes,
  executeOpenPage,
} from '@/utils/copilot/pageTools';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// Get workspace path
const workspacePath = useWorkspaceStore.getState().workspacePath;

// Search for pages
const results = await executeSearchNotes(workspacePath, "project planning");

// Open the first result
if (results.length > 0) {
  await executeOpenPage(results[0].pageId);
}
```

### Using with AI API

```typescript
import { ToolExecutor } from '@/utils/copilot/toolExecutor';

// Get tools for Claude API
const tools = ToolExecutor.getToolsForAPI();

const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "x-api-key": apiKey },
  body: JSON.stringify({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    tools: tools, // Include copilot tools
    messages: [
      {
        role: "user",
        content: "Open my project notes",
      },
    ],
  }),
});
```

### Processing AI Responses

```typescript
import { processAIResponse } from '@/utils/copilot/toolExecutor';

// After receiving AI response with tool use blocks
const results = await processAIResponse(aiResponse, workspacePath);

for (const result of results) {
  if (result.type === "text") {
    console.log("AI:", result.content);
  } else if (result.type === "tool_result") {
    console.log(`Tool ${result.toolName} executed:`, result.content);
  }
}
```

## 🛠️ Available Tools

### `search_notes`

Search for notes/pages by title or content.

**Input:**
```typescript
{
  query: string; // Search keywords or phrase
}
```

**Output:**
```typescript
{
  success: boolean;
  results: SearchResult[];
  count: number;
}
```

**Example:**
```typescript
const results = await executeSearchNotes(workspacePath, "Q1 budget");
```

### `open_page`

Open a specific page by ID.

**Input:**
```typescript
{
  pageId: string; // Page ID to open
}
```

**Output:**
```typescript
{
  success: boolean;
  message: string;
}
```

**Example:**
```typescript
await executeOpenPage("page-abc-123");
```

## 🔍 Search Features

- **Full-text search** using SQLite FTS5
- **Multi-language support** (English, Chinese, Japanese, Korean, etc.)
- **Relevance ranking** with score-based ordering
- **Snippet generation** showing context around matches
- **Limit to top 10 results** for performance

## 📋 Tool Registry

The `ToolRegistry` class maintains all available tools:

```typescript
import { toolRegistry } from '@/utils/copilot/toolRegistry';

// Get all tools
const allTools = toolRegistry.getAllTools();

// Get specific tool
const searchTool = toolRegistry.getTool("search_notes");

// Check if tool exists
const hasSearchNotes = toolRegistry.hasTool("search_notes");

// Get tool names
const toolNames = toolRegistry.getToolNames();
```

## ✅ Input Validation

Validate tool inputs before execution:

```typescript
import { ToolExecutor } from '@/utils/copilot/toolExecutor';

// Check if input is valid
if (!ToolExecutor.validateToolInput("search_notes", { query: "test" })) {
  console.error("Invalid input");
}
```

## 🔄 Complete Workflow Example

```typescript
// User: "Open my Q1 2024 budget review"

// Step 1: Search
const searchResults = await executeSearchNotes(
  workspacePath,
  "Q1 2024 budget review"
);

// Step 2: Select best result
if (searchResults.length > 0) {
  const bestMatch = searchResults[0];
  console.log(`Found: "${bestMatch.pageTitle}"`);
  console.log(`Preview: ${bestMatch.snippet}`);

  // Step 3: Open
  await executeOpenPage(bestMatch.pageId);
  console.log("Page opened!");
}
```

## 🧪 Testing

Run tests with Vitest:

```bash
npm run test -- src/utils/copilot/__tests__
```

Tests cover:
- Search functionality
- Page opening
- Input validation
- Error handling
- Multi-language support
- AI response processing

## 📚 Examples

See `examples.ts` for 8 complete usage examples:

1. **Simple search and open** - Basic workflow
2. **Multi-language search** - Different languages
3. **Process AI response** - Handle Claude API responses
4. **Direct tool execution** - Call tools directly
5. **Tool validation** - Validate inputs
6. **Tool inspection** - Inspect available tools
7. **Error handling** - Handle various errors
8. **Complete chat workflow** - Full conversation simulation

Run examples:

```typescript
import { runAllExamples } from '@/utils/copilot/examples';

await runAllExamples();
```

## 🔌 Integration with Copilot UI

When implementing the copilot chat interface, use these tools:

```typescript
import { ToolExecutor } from '@/utils/copilot/toolExecutor';
import { useCopilotUiStore } from '@/stores/copilotUiStore';

// In your copilot chat component
async function handleAIResponse(response) {
  const workspacePath = useWorkspaceStore.getState().workspacePath;

  // Process tool calls from AI response
  const results = await processAIResponse(response, workspacePath);

  // Update UI with results
  for (const result of results) {
    if (result.type === "text") {
      useCopilotUiStore.getState().addChatMessage("assistant", result.content);
    }
  }
}
```

## 🚨 Error Handling

Common error scenarios:

```typescript
try {
  // No results
  const results = await executeSearchNotes(workspacePath, "xyz");
  if (results.length === 0) {
    console.log("No pages found");
  }

  // Invalid page ID
  await executeOpenPage("invalid-id");
} catch (error) {
  console.error("Tool error:", error.message);
}
```

## 📖 Detailed Documentation

See `TOOLS.md` for:
- Complete tool specifications
- Input/output formats
- Usage examples
- Integration guides
- Error handling
- Best practices
- Changelog

## 🎨 Tool Definition Format

Tools follow Claude API format:

```typescript
{
  name: "tool_name",
  description: "What the tool does",
  input_schema: {
    type: "object",
    properties: {
      param_name: {
        type: "string",
        description: "Parameter description"
      }
    },
    required: ["param_name"]
  }
}
```

## 🔐 Security Considerations

- **Path validation** - All paths validated before use
- **Input sanitization** - User inputs sanitized
- **Error messages** - Safe error messages without leaking internals
- **Tool authorization** - Tools execute only with valid workspace path

## 📈 Performance

- **Search**: FTS5 optimized, sub-second queries
- **Results limit**: Top 10 results for performance
- **Caching**: No caching (each query is fresh)
- **Memory**: Minimal overhead, no large data structures

## 🔮 Future Enhancements

Planned features:

- [ ] Vector search for semantic matching
- [ ] Recent pages quick access
- [ ] Quick page creation tool
- [ ] Block-level operations
- [ ] Batch operations
- [ ] Cache optimization
- [ ] Analytics integration

## 🤝 Contributing

To add a new tool:

1. Create tool definition in appropriate file
2. Create tool executor function
3. Create tool processor function
4. Register in tool registry
5. Add to executor router
6. Write tests
7. Update documentation

## 📝 License

Same as oxinot project

## 🆘 Troubleshooting

### Search returns no results
- Check query is not empty
- Verify pages exist in workspace
- Check page titles and content
- Try different keywords

### Tool execution fails
- Validate workspace path is correct
- Check page ID exists
- Review error message for details
- Check browser console for logs

### Multi-language search not working
- Ensure database has UTF-8 encoding
- Check page content is in expected language
- Verify FTS5 index is updated

## 📞 Support

For issues or questions:
1. Check `TOOLS.md` documentation
2. Review `examples.ts` for usage patterns
3. Check test files for expected behavior
4. Review error messages and logs

---

**Version**: 1.0.0  
**Last Updated**: 2024  
**Status**: Production Ready