# Copilot System Architecture & Enhancement Plan

## Executive Summary

This document outlines the comprehensive architecture for enhancing Oxinot's copilot system to support seamless natural language control of the entire application.

## Current State Analysis

### Existing Architecture
```
┌─────────────────────────────────────────────────────────┐
│                CopilotPanel (UI)                  │
│  - Chat interface with streaming              │
│  - AI integration (Anthropic/Claude)          │
│  - Tool execution via onToolCall callback      │
└──────────────┬────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│            Tool Executor                    │
│  - Parameter validation (Zod)                  │
│  - Approval workflow (optional)                   │
│  - Error handling                                 │
└──────────────┬────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│            Tool Registry                     │
│  - Central tool registration                     │
│  - Tool lookup by name                          │
└──────────────┬────────────────────────────────────┘
               │
    ┌──────────┴──────────┐
    ▼                     ▼
┌────────┐         ┌────────┐
│ BLOCK  │         │ PAGE   │
│ Tools  │         │ Tools  │
│ 9 tools│         │ 4 tools│
└────────┘         └────────┘
```

### Current Tools Inventory

**Block Tools (9):**
- `get_block` - Get a single block by ID
- `update_block` - Update block content
- `create_block` - Create new block
- `delete_block` - Delete block
- `query_blocks` - Search blocks by content
- `get_page_blocks` - Get all blocks for a page
- `insert_block_below_current` - Insert below focused block
- `insert_block_below` - Insert below specific block
- `append_to_block` - Append content to block

**Page Tools (4):**
- `open_page` - Open a page by ID
- `query_pages` - Search pages
- `list_pages` - List all pages
- `create_page` - Create new page

**Context Tools (1):**
- `get_current_context` - Get current workspace context

### Critical Gaps Identified

❌ **No Navigation Tools**
- Cannot switch between file tree and editor views
- Cannot navigate to file tree
- Cannot expand/collapse folders in file tree

❌ **No File System Tools**
- Cannot create new files
- Cannot delete files
- Cannot rename files
- Cannot move files between directories

❌ **No Automatic UI Updates**
- File operations don't trigger UI refresh
- Changes require manual user action to see results

❌ **Limited Natural Language Understanding**
- AI only knows about block/page operations
- Cannot understand navigation commands like "go back to file tree"
- Cannot understand file operations like "create a new file"

❌ **No Tool Execution Feedback**
- Users don't see execution duration
- No success/failure indicators beyond error messages
- No tool usage analytics

## Proposed Architecture

### 1. Real-Time UI Update System

**Approach: Hybrid Event + Store Direct Integration**

```typescript
// src/services/ai/tools/uiEvents.ts
export interface UIEvent {
  type:
    | 'file_created'
    | 'file_deleted'
    | 'file_renamed'
    | 'file_moved'
    | 'view_changed'
    | 'block_updated'
    | 'page_changed';
  timestamp: Date;
  payload: unknown;
}

class UIEventEmitter {
  private listeners: Map<string, Set<(event: UIEvent) => void>> = new Map();

  on(eventType: string, callback: (event: UIEvent) => void) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);
  }

  emit(event: UIEvent) {
    const callbacks = this.listeners.get(event.type);
    if (callbacks) {
      callbacks.forEach(cb => cb(event));
    }
  }
}

export const uiEventEmitter = new UIEventEmitter();
```

**Integration Pattern:**

```typescript
// Tools emit events after successful execution
export const deleteFileTool: Tool = {
  name: 'delete_file',
  description: 'Delete a file from the workspace',
  parameters: z.object({
    path: z.string().describe('File path to delete'),
  }),
  execute: async ({ path }, context) => {
    const result = await tauriAPI.deleteFile(path);

    if (result.success) {
      // Emit event for UI to react
      uiEventEmitter.emit({
        type: 'file_deleted',
        timestamp: new Date(),
        payload: { path }
      });

      // Also trigger store update directly (hybrid approach)
      const workspaceStore = useWorkspaceStore.getState();
      await workspaceStore.refreshFileTree();
    }

    return result;
  }
};
```

**UI Components Listen to Events:**

```typescript
// src/App.tsx or relevant components
useEffect(() => {
  const handleFileDeleted = (event: UIEvent) => {
    if (event.type === 'file_deleted') {
      // Trigger re-fetch or update local state
      const { path } = event.payload;
      console.log(`File deleted: ${path}`);
      // UI updates automatically
    }
  };

  uiEventEmitter.on('file_deleted', handleFileDeleted);
  uiEventEmitter.on('file_created', handleFileCreated);
  uiEventEmitter.on('view_changed', handleViewChanged);

  return () => {
    uiEventEmitter.off('file_deleted', handleFileDeleted);
    uiEventEmitter.off('file_created', handleFileCreated);
    uiEventEmitter.off('view_changed', handleViewChanged);
  };
}, []);
```

### 2. Navigation Tools

**New Category: NAVIGATION**

```typescript
// src/services/ai/tools/navigation/index.ts

import { z } from 'zod';
import type { Tool, ToolContext, ToolResult } from '../types';
import { useViewStore } from '../../../stores/viewStore';

export const switchToIndexTool: Tool = {
  name: 'switch_to_index',
  category: 'NAVIGATION',
  description: 'Switch to file tree view (index mode)',
  parameters: z.object({}).strict(), // No parameters needed
  isDangerous: false,
  execute: async (params, context) => {
    console.log('[switch_to_index] Switching to file tree view');

    // Direct store integration
    const viewStore = useViewStore.getState();
    viewStore.showIndex();

    // Emit event for UI feedback
    uiEventEmitter.emit({
      type: 'view_changed',
      timestamp: new Date(),
      payload: { mode: 'index' }
    });

    return {
      success: true,
      data: 'Switched to file tree view'
    };
  }
};

export const switchToNoteViewTool: Tool = {
  name: 'switch_to_note_view',
  category: 'NAVIGATION',
  description: 'Switch to editor/note view',
  parameters: z.object({
    pageId: z.string().optional().describe('Optional page ID to open'),
    pagePath: z.string().optional().describe('Optional page path to open'),
  }),
  isDangerous: false,
  execute: async ({ pageId, pagePath }, context) => {
    console.log('[switch_to_note_view] Switching to note view');

    const viewStore = useViewStore.getState();

    if (pageId) {
      viewStore.showPage(pageId);
    } else if (pagePath) {
      // Parse path to get page info
      const pageStore = usePageStore.getState();
      const page = Object.values(pageStore.pagesById).find(p => p.path === pagePath);
      if (page) {
        viewStore.showPage(page.id);
      } else {
        return {
          success: false,
          error: `Page not found for path: ${pagePath}`
        };
      }
    } else {
      // If no page specified, show index
      viewStore.showIndex();
    }

    // Emit event
    uiEventEmitter.emit({
      type: 'view_changed',
      timestamp: new Date(),
      payload: { mode: 'note', pageId, pagePath }
    });

    return {
      success: true,
      data: 'Switched to note view'
    };
  }
};

export const navigateToPathTool: Tool = {
  name: 'navigate_to_path',
  category: 'NAVIGATION',
  description: 'Navigate to a specific directory or file path in the file tree',
  parameters: z.object({
    path: z.string().describe('Directory or file path to navigate to (e.g., "Projects/Q1 Budget")'),
  }),
  isDangerous: false,
  execute: async ({ path }, context) => {
    console.log(`[navigate_to_path] Navigating to path: ${path}`);

    const workspaceStore = useWorkspaceStore.getState();
    const viewStore = useViewStore.getState();

    try {
      // Expand parent directories in file tree
      await workspaceStore.expandPath(path);

      // If it's a file, open it
      const pageStore = usePageStore.getState();
      const page = Object.values(pageStore.pagesById).find(p => p.path === path);

      if (page) {
        viewStore.showPage(page.id);
      } else {
        // It's a directory, just navigate to it in index view
        viewStore.showIndex();
        workspaceStore.setCurrentPath(path);
      }

      uiEventEmitter.emit({
        type: 'view_changed',
        timestamp: new Date(),
        payload: { path }
      });

      return {
        success: true,
        data: `Navigated to ${path}`
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to navigate to path: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
};

export const goBackTool: Tool = {
  name: 'go_back',
  category: 'NAVIGATION',
  description: 'Navigate back in the view history',
  parameters: z.object({}).strict(),
  isDangerous: false,
  execute: async (params, context) => {
    console.log('[go_back] Navigating back');

    const viewStore = useViewStore.getState();
    const navigationStore = useNavigationStore.getState();

    const entry = navigationStore.goBack();
    if (entry) {
      viewStore.showPage(entry.pageId);

      uiEventEmitter.emit({
        type: 'view_changed',
        timestamp: new Date(),
        payload: { direction: 'back', pageId: entry.pageId }
      });
    }

    return {
      success: true,
      data: entry ? 'Navigated back' : 'Cannot go back further'
    };
  }
};

export const goForwardTool: Tool = {
  name: 'go_forward',
  category: 'NAVIGATION',
  description: 'Navigate forward in the view history',
  parameters: z.object({}).strict(),
  isDangerous: false,
  execute: async (params, context) => {
    console.log('[go_forward] Navigating forward');

    const viewStore = useViewStore.getState();
    const navigationStore = useNavigationStore.getState();

    const entry = navigationStore.goForward();
    if (entry) {
      viewStore.showPage(entry.pageId);

      uiEventEmitter.emit({
        type: 'view_changed',
        timestamp: new Date(),
        payload: { direction: 'forward', pageId: entry.pageId }
      });
    }

    return {
      success: true,
      data: entry ? 'Navigated forward' : 'Cannot go forward further'
    };
  }
};

export { switchToIndexTool, switchToNoteViewTool, navigateToPathTool, goBackTool, goForwardTool };
```

### 3. File System Tools

**New Category: FILESYSTEM**

```typescript
// src/services/ai/tools/filesystem/index.ts

import { z } from 'zod';
import type { Tool, ToolContext, ToolResult } from '../types';
import { useWorkspaceStore } from '../../../stores/workspaceStore';
import { tauriAPI } from '../../../tauri-api';

export const createFileTool: Tool = {
  name: 'create_file',
  category: 'FILESYSTEM',
  description: 'Create a new file or directory in the workspace. Can create markdown files (.md extension) or directories.',
  parameters: z.object({
    path: z.string().describe('Full path where to create the file (e.g., "Projects/new-notes.md")'),
    type: z.enum(['file', 'directory']).optional().describe('Type to create: "file" or "directory". Defaults to "file" if not specified.'),
    content: z.string().optional().describe('Content to write to the file (only for file type, not directory)'),
  }),
  isDangerous: false,
  requiresApproval: false,
  execute: async ({ path, type = 'file', content }, context) => {
    console.log(`[create_file] Creating ${type} at path: ${path}`);

    try {
      let result;

      if (type === 'directory') {
        result = await tauriAPI.createDirectory(path);
      } else {
        // Default to .md if not specified
        const filePath = path.endsWith('.md') ? path : `${path}.md`;
        if (content) {
          result = await tauriAPI.writeFile(filePath, content);
        } else {
          result = await tauriAPI.createFile(filePath);
        }
      }

      if (result.success) {
        // Trigger file tree refresh
        const workspaceStore = useWorkspaceStore.getState();
        await workspaceStore.refreshFileTree();

        // Emit UI event
        uiEventEmitter.emit({
          type: 'file_created',
          timestamp: new Date(),
          payload: { path, type }
        });
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Failed to create file: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
};

export const deleteFileTool: Tool = {
  name: 'delete_file',
  category: 'FILESYSTEM',
  description: 'Delete a file or directory from the workspace. This operation cannot be undone.',
  parameters: z.object({
    path: z.string().describe('Path of the file or directory to delete'),
    confirm: z.boolean().optional().describe('Whether to show confirmation dialog. Defaults to true if not specified.'),
  }),
  isDangerous: true,
  requiresApproval: true, // Require user approval for destructive operations
  execute: async ({ path, confirm = true }, context) => {
    console.log(`[delete_file] Deleting path: ${path}`);

    // Show confirmation if requested
    if (confirm && !confirm(`Are you sure you want to delete ${path}?`)) {
      return {
        success: false,
        error: 'Delete cancelled by user'
      };
    }

    try {
      const result = await tauriAPI.deleteFile(path);

      if (result.success) {
        // Trigger file tree refresh
        const workspaceStore = useWorkspaceStore.getState();
        await workspaceStore.refreshFileTree();

        // Emit UI event
        uiEventEmitter.emit({
          type: 'file_deleted',
          timestamp: new Date(),
          payload: { path }
        });

        // If the deleted file was open, go back to index
        const pageStore = usePageStore.getState();
        const currentPage = pageStore.pagesById[pageStore.currentPageId || ''];
        if (currentPage && currentPage.path === path) {
          const viewStore = useViewStore.getState();
          viewStore.showIndex();
        }
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
};

export const renameFileTool: Tool = {
  name: 'rename_file',
  category: 'FILESYSTEM',
  description: 'Rename a file or directory in the workspace.',
  parameters: z.object({
    oldPath: z.string().describe('Current path of the file/directory to rename'),
    newName: z.string().describe('New name for the file/directory (without path)'),
  }),
  isDangerous: false,
  requiresApproval: true, // Require approval for file renames
  execute: async ({ oldPath, newName }, context) => {
    console.log(`[rename_file] Renaming ${oldPath} to ${newName}`);

    try {
      // Construct new path
      const pathParts = oldPath.split('/');
      pathParts[pathParts.length - 1] = newName;
      const newPath = pathParts.join('/');

      const result = await tauriAPI.renameFile(oldPath, newPath);

      if (result.success) {
        // Trigger file tree refresh
        const workspaceStore = useWorkspaceStore.getState();
        await workspaceStore.refreshFileTree();

        // Emit UI event
        uiEventEmitter.emit({
          type: 'file_renamed',
          timestamp: new Date(),
          payload: { oldPath, newName, newPath }
        });
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Failed to rename file: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
};

export const moveFileTool: Tool = {
  name: 'move_file',
  category: 'FILESYSTEM',
  description: 'Move a file or directory to a different location in the workspace.',
  parameters: z.object({
    sourcePath: z.string().describe('Current path of the file/directory to move'),
    destinationPath: z.string().describe('Destination path where to move the file/directory'),
  }),
  isDangerous: false,
  requiresApproval: true, // Require approval for file moves
  execute: async ({ sourcePath, destinationPath }, context) => {
    console.log(`[move_file] Moving ${sourcePath} to ${destinationPath}`);

    try {
      const result = await tauriAPI.moveFile(sourcePath, destinationPath);

      if (result.success) {
        // Trigger file tree refresh
        const workspaceStore = useWorkspaceStore.getState();
        await workspaceStore.refreshFileTree();

        // Emit UI event
        uiEventEmitter.emit({
          type: 'file_moved',
          timestamp: new Date(),
          payload: { sourcePath, destinationPath }
        });
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Failed to move file: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
};

export { createFileTool, deleteFileTool, renameFileTool, moveFileTool };
```

### 4. Enhanced Tool Categories

**Update ToolCategory Enum:**

```typescript
// src/services/ai/tools/types.ts
export enum ToolCategory {
  BLOCK = "block",        // Block editing operations
  PAGE = "page",         // Page management operations
  SEARCH = "search",      // Search operations
  SELECTION = "selection", // Block selection operations
  METADATA = "metadata",  // Metadata operations
  CONTEXT = "context",     // Context retrieval
  NAVIGATION = "navigation", // View navigation operations (NEW)
  FILESYSTEM = "filesystem", // File system operations (NEW)
  UI_CONTROL = "ui_control",  // UI control operations (NEW)
}
```

### 5. Enhanced Tool Descriptions

**Pattern: Clear intent + examples + constraints**

```typescript
// Enhanced open_page tool description
export const openPageTool: Tool = {
  name: 'open_page',
  category: 'PAGE',
  description: `Open a specific page/note by its ID. Use this tool when users want to navigate to or view a specific page in their workspace.

Example user commands that should trigger this tool:
- "Open the Q1 Budget Review page"
- "Show me the project planning notes"
- "I want to see my meeting notes from yesterday"
- "Navigate to the page about design review"

Notes:
- Use the pageId from search_results or query_pages tools
- If the user mentions a page by name, use query_pages first to find it
- Automatically switches to note view mode
- Updates the breadcrumb navigation`,
  parameters: z.object({
    pageId: z.string().describe('The unique ID of the page to open. Obtain this from search_pages or query_pages tool results.'),
  }),
  execute: async ({ pageId }, context) => {
    const pageStore = usePageStore.getState();
    await pageStore.openPageById(pageId);

    return {
      success: true,
      data: `Opened page ${pageId}`
    };
  }
};
```

### 6. Enhanced Tool Executor

**Add Execution Metadata & Event Emission:**

```typescript
// src/services/ai/tools/executor.ts
import { uiEventEmitter } from './uiEvents';

export async function executeTool(
  toolName: string,
  params: unknown,
  context: ToolContext,
  options?: { skipApproval?: boolean }
): Promise<ToolResult> {
  const startTime = performance.now();
  const executionId = generateId(); // Add unique execution ID

  console.log(`[executeTool] Starting execution: ${toolName}`, {
    executionId,
    params,
  });

  // ... existing validation and approval logic ...

  try {
    const result = await tool.execute(validatedParams, context);

    const duration = performance.now() - startTime;

    // Emit execution completed event
    uiEventEmitter.emit({
      type: 'tool_execution_completed',
      timestamp: new Date(),
      payload: {
        toolName,
        executionId,
        success: result.success,
        duration: duration.toFixed(2),
        error: result.error
      }
    });

    return result;
  } catch (error) {
    // Emit execution failed event
    uiEventEmitter.emit({
      type: 'tool_execution_failed',
      timestamp: new Date(),
      payload: {
        toolName,
        executionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

### 7. Command Intent Detection System

**Hybrid Approach: Pattern Matching + AI Tool Suggestions**

```typescript
// src/services/ai/intent/parser.ts

export interface ParsedCommand {
  intent: string;
  confidence: number;
  suggestedTool?: string;
  extractedParams?: Record<string, unknown>;
  requiresAI: boolean;
}

export const COMMAND_PATTERNS = [
  {
    pattern: /(?:delete|remove|trash)\s+(?:the\s+)?(.+?)(?:file|page|note)/i,
    intent: 'delete_file',
    confidence: 0.9,
    suggestedTool: 'delete_file',
    paramExtractor: (match: RegExpMatchArray) => ({
      path: match[1]?.trim()
    })
  },
  {
    pattern: /(?:create|new)\s+(?:a\s+)?(.+?)(?:file|page|note)/i,
    intent: 'create_file',
    confidence: 0.85,
    suggestedTool: 'create_file',
    paramExtractor: (match: RegExpMatchArray) => ({
      path: match[1]?.trim()
    })
  },
  {
    pattern: /(?:rename)\s+(?:the\s+)?(.+?)(?:file|page|note)\s+(?:to|as)\s+(.+)/i,
    intent: 'rename_file',
    confidence: 0.85,
    suggestedTool: 'rename_file',
    paramExtractor: (match: RegExpMatchArray) => ({
      oldPath: match[1]?.trim(),
      newName: match[2]?.trim()
    })
  },
  {
    pattern: /(?:go\s+back|back|return)\s+(?:to\s+)?(?:file\s+)?(?:tree|index)/i,
    intent: 'switch_to_index',
    confidence: 0.95,
    suggestedTool: 'switch_to_index',
    paramExtractor: () => ({})
  },
  {
    pattern: /(?:switch|navigate)\s+(?:to\s+)?(?:file\s+)?tree|index/i,
    intent: 'switch_to_index',
    confidence: 0.95,
    suggestedTool: 'switch_to_index',
    paramExtractor: () => ({})
  },
];

export function parseCommand(userInput: string): ParsedCommand {
  // Try to match against patterns
  for (const pattern of COMMAND_PATTERNS) {
    const match = userInput.match(pattern.pattern);
    if (match) {
      console.log(`[IntentParser] Matched pattern: ${pattern.intent}`);
      const params = pattern.paramExtractor(match);
      return {
        intent: pattern.intent,
        confidence: pattern.confidence,
        suggestedTool: pattern.suggestedTool,
        extractedParams: params,
        requiresAI: false // We can handle this directly
      };
    }
  }

  // No pattern match, require AI processing
  console.log('[IntentParser] No pattern match, using AI');
  return {
    intent: 'unknown',
    confidence: 0,
    requiresAI: true
  };
}

// Suggest tools based on partial matches
export function suggestTools(userInput: string): Array<{ toolName: string; confidence: number; reason: string }> {
  const suggestions: Array<{ toolName: string; confidence: number; reason: string }> = [];
  const input = userInput.toLowerCase();

  // Keyword-based suggestions
  const toolKeywords: Record<string, Array<{ tool: string; keywords: string[] }>> = {
    'delete_file': { tool: 'delete_file', keywords: ['delete', 'remove', 'trash', 'erase', 'eliminate'] },
    'create_file': { tool: 'create_file', keywords: ['create', 'new', 'make', 'add', 'add file'] },
    'rename_file': { tool: 'rename_file', keywords: ['rename', 'change name', 'rename as'] },
    'move_file': { tool: 'move_file', keywords: ['move', 'relocate', 'transfer'] },
    'switch_to_index': { tool: 'switch_to_index', keywords: ['file tree', 'index', 'go back', 'navigate home'] },
    'open_page': { tool: 'open_page', keywords: ['open', 'show', 'navigate', 'view', 'go to'] },
    'search_pages': { tool: 'search_pages', keywords: ['search', 'find', 'look for', 'search for'] },
  };

  for (const [intent, info] of Object.entries(toolKeywords)) {
    for (const keyword of info.keywords) {
      if (input.includes(keyword)) {
        suggestions.push({
          toolName: info.tool,
          confidence: 0.7,
          reason: `Keyword match: "${keyword}"`
        });
      }
    }
  }

  return suggestions;
}
```

### 8. Enhanced Copilot Panel Integration

**Add Tool Suggestions & Intent Detection:**

```typescript
// src/components/copilot/CopilotPanel.tsx

import { parseCommand, suggestTools } from '../../services/ai/intent/parser';
import { uiEventEmitter } from '../../services/ai/tools/uiEvents';

export function CopilotPanel() {
  // ... existing code ...

  const [toolSuggestions, setToolSuggestions] = useState<Array<{ toolName: string; confidence: number; reason: string }>>([]);

  const handleInputChange = (value: string) => {
    setInputValue(value);

    // Get tool suggestions
    const suggestions = suggestTools(value);
    setToolSuggestions(suggestions.slice(0, 5)); // Top 5 suggestions
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const currentInput = inputValue;
    setInputValue('');
    setError(null);
    setIsLoading(true);

    // Parse intent
    const parsed = parseCommand(currentInput);

    if (parsed.confidence > 0.8 && parsed.suggestedTool) {
      // High confidence match - execute directly
      console.log(`[CopilotPanel] High confidence intent detected: ${parsed.intent}, executing directly`);

      const workspacePath = useWorkspaceStore.getState().workspacePath;
      const context = {
        workspacePath,
        currentPageId: useBlockStore.getState().currentPageId || undefined,
        focusedBlockId: useBlockUIStore.getState().focusedBlockId || undefined,
        selectedBlockIds: useBlockUIStore.getState().selectedBlockIds,
      };

      try {
        const result = await executeTool(
          parsed.suggestedTool,
          parsed.extractedParams || {},
          context,
          { skipApproval: false } // Skip approval for high-confidence matches
        );

        addChatMessage('user', currentInput);

        if (result.success) {
          addChatMessage('assistant', `✅ ${result.data}`);
        } else {
          addChatMessage('assistant', `❌ ${result.error}`);
        }
      } catch (error) {
        addChatMessage('assistant', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // No high-confidence match, use AI
      console.log('[CopilotPanel] Using AI for processing');

      // ... existing AI streaming code ...
    }
  };

  // ... rest of component
}
```

### 9. Error Handling & Rollback

**Add Undo Support for Critical Operations:**

```typescript
// src/services/ai/tools/rollback.ts

interface OperationRecord {
  operation: string;
  timestamp: Date;
  snapshot: unknown;
  canUndo: boolean;
}

class RollbackManager {
  private history: OperationRecord[] = [];
  private maxSize = 50;

  record(operation: string, snapshot: unknown, canUndo = true) {
    const record: OperationRecord = {
      operation,
      timestamp: new Date(),
      snapshot,
      canUndo
    };
    this.history.push(record);

    if (this.history.length > this.maxSize) {
      this.history.shift();
    }
  }

  async undo(): Promise<ToolResult> {
    const lastOp = this.history.pop();
    if (!lastOp || !lastOp.canUndo) {
      return {
        success: false,
        error: 'No operation to undo'
      };
    }

    try {
      // Restore based on operation type
      switch (lastOp.operation) {
        case 'delete_file':
          // Restore the file from backup
          return await restoreFromBackup(lastOp.snapshot);
        // ... handle other operation types
      }

      uiEventEmitter.emit({
        type: 'operation_undone',
        timestamp: new Date(),
        payload: { operation: lastOp.operation }
      });

      return {
        success: true,
        data: 'Undo completed'
      };
    } catch (error) {
      return {
        success: false,
        error: `Undo failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

export const rollbackManager = new RollbackManager();
```

## Implementation Roadmap

### Phase 1: Foundation (High Priority)
- [ ] Create UI event emitter system
- [ ] Add NAVIGATION category to ToolCategory enum
- [ ] Add FILESYSTEM category to ToolCategory enum
- [ ] Update tool registry to support new categories
- [ ] Implement navigation tools (5 tools)
- [ ] Implement filesystem tools (4 tools)
- [ ] Test navigation tools
- [ ] Test filesystem tools

### Phase 2: Integration (High Priority)
- [ ] Update CopilotPanel to emit/receive UI events
- [ ] Add tool suggestion UI to CopilotPanel
- [ ] Implement command intent detection parser
- [ ] Integrate intent detection into CopilotPanel
- [ ] Add tool execution feedback to CopilotPanel
- [ ] Test end-to-end navigation commands
- [ ] Test end-to-end filesystem commands

### Phase 3: Enhancement (Medium Priority)
- [ ] Enhance all tool descriptions with examples
- [ ] Add tool execution metadata (duration, tracking)
- [ ] Implement rollback/undo system
- [ ] Add tool usage analytics
- [ ] Create comprehensive error messages
- [ ] Test rollback functionality

### Phase 4: Polish (Low Priority)
- [ ] Update documentation
- [ ] Add examples to tool documentation
- [ ] Optimize performance
- [ ] Add keyboard shortcuts for common commands
- [ ] Create user guide

## Testing Strategy

### Unit Tests
```typescript
// src/services/ai/tools/__tests__/navigation.test.ts
describe('Navigation Tools', () => {
  it('should switch to index view', async () => {
    const result = await switchToIndexTool.execute({}, mockContext);
    expect(result.success).toBe(true);
    expect(viewStore.getState().mode).toBe('index');
  });

  it('should navigate to specific path', async () => {
    const result = await navigateToPathTool.execute({ path: 'Projects/Q1' }, mockContext);
    expect(result.success).toBe(true);
    expect(workspaceStore.getCurrentPath()).toBe('Projects/Q1');
  });
});
```

### Integration Tests
```typescript
// src/components/copilot/__tests__/CopilotPanel.e2e.test.ts
describe('Copilot Panel Integration', () => {
  it('should execute delete command via natural language', async () => {
    const user = screen.getByLabelText('Chat input');
    await userEvent.type(user, 'delete the project planning file');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      const messages = screen.queryAllByText(/project planning/);
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  it('should update file tree after tool execution', async () => {
    // Execute create file command
    await userEvent.type(user, 'create a file called test.md');
    await userEvent.keyboard('{Enter}');

    // Verify file appears in file tree
    await waitFor(() => {
      const fileItem = screen.getByText('test.md');
      expect(fileItem).toBeInTheDocument();
    });
  });
});
```

### End-to-End Tests
```typescript
// src/e2e/copilot-workflow.test.ts
describe('Copilot E2E Workflows', () => {
  it('complete workflow: navigate → create → open → edit', async () => {
    // Navigate to file tree
    await copilotCommand('go to file tree');
    expect(viewMode()).toBe('index');

    // Create new file
    await copilotCommand('create a file called test.md');
    await waitForFileInTree('test.md');

    // Open the file
    await copilotCommand('open test.md');
    expect(viewMode()).toBe('note');
    expect(currentPageName()).toBe('test');

    // Add content via block tool
    await copilotCommand('add TODO: review this file to current block');
    await waitForBlockContent('TODO: review this file');
  });
});
```

## Success Criteria

### Functional Requirements
- ✅ User can navigate between views via natural language
- ✅ User can create files/directories via copilot
- ✅ User can delete files/directories via copilot (with confirmation)
- ✅ User can rename files/directories via copilot
- ✅ UI updates immediately after tool execution
- ✅ Copilot provides tool suggestions
- ✅ Common commands recognized with high confidence
- ✅ Error messages are clear and actionable

### Performance Requirements
- ✅ Tool execution completes within 500ms for simple operations
- ✅ UI updates within 100ms of tool completion
- ✅ File tree refresh doesn't block UI
- ✅ Streaming responses continue without interruption

### User Experience Requirements
- ✅ Natural language commands feel intuitive
- ✅ Users understand what the copilot is doing
- ✅ Failed operations have clear error messages
- ✅ Destructive operations require confirmation
- ✅ Commands execute on first try (high confidence)

## Architecture Decisions Summary

| Decision | Approach | Rationale |
|-----------|-----------|------------|
| **UI Updates** | Hybrid (events + direct store) | Events decouple components, direct store calls guarantee updates |
| **Navigation** | Separate category, integrate with viewStore | Clean separation, leverages existing state |
| **File System** | Separate category, require approval for destructive ops | Security via approval, easy to audit |
| **Tool Categories** | Added NAVIGATION, FILESYSTEM, UI_CONTROL | Logical grouping, easy to discover |
| **Natural Language** | Hybrid (pattern matching + AI) | Pattern matching for speed, AI for flexibility |
| **Error Handling** | Rollback manager for destructive ops | Users can undo mistakes |
| **Tool Descriptions** | Enhanced with examples + constraints | AI can understand intent better |

## Next Steps

1. **Review this architecture document** - Confirm it meets requirements
2. **Begin Phase 1 implementation** - Foundation components
3. **Test incrementally** - Each phase validated before proceeding
4. **User feedback integration** - Adjust based on actual usage patterns
