# Copilot Tools - Quick Reference

## 🎯 What is this?

A tool system that allows AI to search and open your notes/pages when you ask things like:
- "Open my project planning notes"
- "Show me my Q1 budget review"
- "내 회의록을 열어줘" (Korean: Open my meeting notes)

## ⚡ Two Main Tools

### 1. `search_notes` - Find pages
```typescript
// Search for pages matching a query
const results = await executeSearchNotes(workspacePath, "project planning");
// Returns: Array of matching pages with snippets and relevance scores
```

### 2. `open_page` - Open a page
```typescript
// Open a page by ID
await executeOpenPage("page-123");
// Opens the page in the app
```

## 🚀 Common Workflows

### Search and Open
```typescript
const workspacePath = useWorkspaceStore.getState().workspacePath;

// 1. Search
const results = await executeSearchNotes(workspacePath, "budget review");

// 2. Open the best result
if (results.length > 0) {
  await executeOpenPage(results[0].pageId);
}
```

### With AI API (Claude)
```typescript
import { ToolExecutor } from '@/utils/copilot/toolExecutor';

// Get tools for Claude
const tools = ToolExecutor.getToolsForAPI();

// Include in API request
const response = await claude.messages.create({
  model: "claude-3-5-sonnet-20241022",
  max_tokens: 1024,
  tools: tools,
  messages: [{
    role: "user",
    content: "Open my Q1 planning notes"
  }]
});

// Process Claude's response with tool calls
const results = await processAIResponse(response, workspacePath);
```

## 📂 File Structure

```
src/utils/copilot/
├── pageTools.ts          # search_notes & open_page implementations
├── toolRegistry.ts       # Manages all available tools
├── toolExecutor.ts       # Routes and executes tools
├── examples.ts           # 8 usage examples
├── TOOLS.md             # Detailed documentation
├── README.md            # Full guide
└── __tests__/           # Unit tests
```

## 🔧 Direct Imports

```typescript
// Search and open directly
import { executeSearchNotes, executeOpenPage } from '@/utils/copilot/pageTools';

// Use tool executor
import { ToolExecutor } from '@/utils/copilot/toolExecutor';

// Process AI responses
import { processAIResponse } from '@/utils/copilot/toolExecutor';

// Get tool definitions
import { getPageTools } from '@/utils/copilot/pageTools';
```

## ✅ Input Validation

```typescript
// Check if input is valid before execution
if (!ToolExecutor.validateToolInput("search_notes", { query: "test" })) {
  console.error("Invalid input");
}
```

## 🧪 Testing

```bash
# Run copilot tools tests
npm run test -- src/utils/copilot/__tests__
```

## 📊 Search Features

- **Full-text search**: Uses SQLite FTS5 (fast, indexed)
- **Multi-language**: Works with any language
- **Ranking**: Results ranked by relevance score
- **Snippets**: Shows context with matching text highlighted
- **Limit**: Returns top 10 results

## 🎓 Examples

8 complete examples in `examples.ts`:

1. Simple search and open
2. Multi-language search
3. Process AI response
4. Direct tool execution
5. Input validation
6. Tool inspection
7. Error handling
8. Complete chat workflow

Run them:
```typescript
import { example1_SearchAndOpen, runAllExamples } from '@/utils/copilot/examples';

// Run one
await example1_SearchAndOpen();

// Run all
await runAllExamples();
```

## 🚨 Error Handling

```typescript
try {
  const results = await executeSearchNotes(workspacePath, "test");
  
  if (results.length === 0) {
    console.log("No pages found");
    return;
  }
  
  await executeOpenPage(results[0].pageId);
} catch (error) {
  console.error("Failed:", error.message);
}
```

## 📝 Tool Definitions (Claude API Format)

```json
{
  "name": "search_notes",
  "description": "Search for notes/pages by title or content",
  "input_schema": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Search query" }
    },
    "required": ["query"]
  }
}
```

```json
{
  "name": "open_page",
  "description": "Open a specific page by ID",
  "input_schema": {
    "type": "object",
    "properties": {
      "pageId": { "type": "string", "description": "Page ID to open" }
    },
    "required": ["pageId"]
  }
}
```

## 🔍 Tool Registry

```typescript
import { toolRegistry } from '@/utils/copilot/toolRegistry';

// Get all tools
const allTools = toolRegistry.getAllTools();

// Get specific tool
const tool = toolRegistry.getTool("search_notes");

// Check if tool exists
const exists = toolRegistry.hasTool("search_notes");

// Get names
const names = toolRegistry.getToolNames(); // ["search_notes", "open_page"]
```

## 🎯 Typical AI Workflow

```
User: "Open my Q1 2024 budget review"
  ↓
AI thinks: I should search for pages
  ↓
AI calls: search_notes(query="Q1 2024 budget review")
  ↓
Backend returns: [{pageId: "abc-123", pageTitle: "Q1 2024 Budget", ...}]
  ↓
AI calls: open_page(pageId="abc-123")
  ↓
Page opens in app
  ↓
AI responds: "I found and opened your Q1 2024 Budget Review page"
```

## 🔗 Integration Points

```typescript
// In copilot chat component
import { useCopilotUiStore } from '@/stores/copilotUiStore';

async function handleAIMessage(userMessage: string) {
  // Send to Claude with tools
  const response = await claude.messages.create({
    tools: ToolExecutor.getToolsForAPI(),
    messages: [{ role: "user", content: userMessage }]
  });

  // Process tool calls
  const results = await processAIResponse(response, workspacePath);

  // Update UI
  for (const result of results) {
    if (result.type === "text") {
      useCopilotUiStore.getState().addChatMessage("assistant", result.content);
    }
  }
}
```

## 📚 Learn More

- **TOOLS.md**: Complete specifications and examples
- **README.md**: Full guide with all features
- **examples.ts**: 8 runnable usage examples
- **__tests__/**: Test files showing expected behavior

## ⚙️ Configuration

No configuration needed! Tools work out of the box with:
- Current workspace path
- Page store for page operations
- Tauri API for search

## 🎨 Extending

To add a new tool:

1. Create in `pageTools.ts` (or new file)
2. Export executor function
3. Add to `toolRegistry.ts`
4. Update `toolExecutor.ts` switch statement
5. Write tests
6. Update docs

## ❓ FAQ

**Q: Do I need Vector search?**
A: No, FTS5 full-text search is excellent for this.

**Q: How fast is search?**
A: Sub-second for most queries thanks to SQLite FTS5 indexing.

**Q: Can I search in other languages?**
A: Yes, works seamlessly with any language.

**Q: How many results do I get?**
A: Top 10 results, ranked by relevance.

**Q: Can I cache search results?**
A: Currently no, but can be added if needed.

---

**Quick Links:**
- TOOLS.md - Detailed specs
- README.md - Full guide
- examples.ts - See it in action
- pageTools.ts - Search & open logic