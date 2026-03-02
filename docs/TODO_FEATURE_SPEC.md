# Oxinot TODO Functionality Technical Specification

**Version**: 1.0  
**Created**: 2026-02-21  
**Last Updated**: 2026-02-21  
**Status**: Implementation-Ready  
**Branch**: `feature/todo-functionality`

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Decisions](#architecture-decisions)
3. [Data Model](#data-model)
4. [Architecture](#architecture)
5. [Implementation Phases](#implementation-phases)
6. [Keyboard Shortcuts](#keyboard-shortcuts)
7. [UI/UX Design](#uiux-design)
8. [AI Copilot Integration](#ai-copilot-integration)
9. [Testing Strategy](#testing-strategy)
10. [Migration & Compatibility](#migration--compatibility)
11. [Performance Considerations](#performance-considerations)
12. [Future Considerations](#future-considerations)
13. [References](#references)

---

## Overview

### Problem Statement

Oxinot is a Logseq-style block-based markdown outliner. Users need task management capabilities that:
- Integrate naturally with the block-based editing experience
- Support both quick capture and structured organization
- Leverage the existing AI Copilot for enhanced productivity
- Maintain compatibility with standard markdown formats (especially Logseq)

### Goals

1. **Natural Integration**: TODOs feel like native blocks, not a separate system
2. **Progressive Complexity**: Simple by default, powerful when needed
3. **AI-Enhanced**: Leverage Copilot for natural language task creation and queries
4. **Cross-Platform**: Work seamlessly across markdown files and tools
5. **Queryable**: Support filtered views (Today, This Week, Priority, Overdue, etc.)

### Non-Goals

- Team collaboration features
- Time tracking
- Gantt charts / Timeline views
- Mobile app sync (requires separate effort)
- Slack-style scheduling patterns (deprioritized)

### Design Philosophy

```
┌─────────────────────────────────────────────────────────────┐
│                 OXINOT TODO DESIGN PRINCIPLES               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. BLOCK-FIRST        Every TODO is a block first,        │
│                        with optional task metadata          │
│                                                             │
│  2. CONTENT IS TRUTH   Status prefix in content is the     │
│                        source of truth; metadata derived    │
│                                                             │
│  3. PROGRESSIVE        Level 1: Status prefix only         │
│     COMPLEXITY         Level 2: + Dates (scheduled/due)    │
│                        Level 3: + Priority                  │
│                        Level 4: + Recurring + Reminders    │
│                                                             │
│  4. AI-NATIVE          Natural language → Structured task   │
│                        Copilot as the primary rich input    │
│                                                             │
│  5. MARKDOWN           Compatible with Logseq format       │
│     COMPATIBLE         Files remain readable without app   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Inspiration Sources

| App | What We Adopt |
|-----|---------------|
| **Logseq** | `TODO`/`DONE`/`DOING`/`LATER`/`CANCELED` markers, block-centric approach |
| **Things 3** | Fixed smart views (Today, Upcoming, Anytime, Someday), minimal UI |
| **Todoist** | Natural language date parsing, inline priority syntax |
| **Notion** | Document + task unification, flexible views |
| **Apple Reminders** | Progressive disclosure, Siri-style capture |
| **Microsoft To Do** | "My Day" daily focus concept, AI suggestions |

---

## Architecture Decisions

Six critical architecture decisions were identified and resolved during the design phase.

### Decision 1: Content Prefix is Source of Truth, Metadata is Derived

**Decision**: The status keyword lives in block content (e.g., `TODO Buy milk`). On save, the Rust backend extracts the prefix and writes `todoStatus:: todo` to `block_metadata`. This is a one-way derivation: **content → metadata**. Never the reverse.

**Rationale**:
- Logseq compatibility: files look identical to Logseq-produced markdown
- Plain-text readability: status is visible in any text editor
- Single source of truth eliminates bidirectional sync bugs
- Metadata enables fast SQL-based queries without content parsing

**Status Prefix Rules**:
- Recognized prefixes: `TODO `, `DOING `, `DONE `, `LATER `, `CANCELED ` (uppercase, trailing space required)
- Must appear at the very start of block content
- When status changes via UI (icon click), the content prefix is modified → triggers normal save → metadata re-derived

**Metadata Keys Derived from Content**:
- `todoStatus` — `todo` | `doing` | `done` | `later` | `canceled`

**Metadata Keys Set Independently** (via UI or Copilot, not from content):
- `scheduled` — ISO 8601 date string
- `deadline` — ISO 8601 date string
- `priority` — `A` | `B` | `C`

### Decision 2: Checkbox and TODO Coexist Independently

**Decision**: The existing `- [ ]`/`- [x]` checkbox system (handled by `TaskListHandler.ts` + `CheckboxWidget.ts`) remains completely unchanged. The `TODO`/`DONE` status system is separate and independent.

**Rationale**:
- Checkboxes are a lightweight inline toggle — different use case from structured task management
- No automatic mapping between `- [x]` and `DONE` status
- Users can use either or both — checkboxes for simple lists, TODO markers for managed tasks
- Avoids breaking existing checkbox behavior

### Decision 3: todoStore Queries Backend Directly

**Decision**: `todoStore.ts` calls Rust commands directly for workspace-wide queries (Today, Overdue, etc.). It does NOT derive from `blockStore`.

**Rationale**:
- `blockStore` only holds blocks for the **current page** — useless for workspace-wide task views
- Rust backend can query `block_metadata` table directly with SQL, which is far more efficient
- `todoStore` actions that modify blocks (e.g., status change) go through `blockStore.updateBlockContent()` to maintain the single source of truth
- `todoStore` maintains a lightweight cache, invalidated on block save events from Tauri

### Decision 4: TODO Detection on Rust-side Content Save

**Decision**: When `update_block_content` is called on the Rust side, extract the status prefix and update `block_metadata` in the same database transaction.

**Rationale**:
- Eliminates frontend timing complexity (debounce, race conditions)
- Piggybacks on existing 1-second debounced auto-save
- Atomic: content + metadata update in one transaction
- Visual feedback is still immediate because CodeMirror shows the typed text; React reads metadata for the icon indicator
- Same detection runs on file import/sync, ensuring consistency

### Decision 5: Composite Index on block_metadata(key, value)

**Decision**: Add `CREATE INDEX IF NOT EXISTS idx_block_metadata_key_value ON block_metadata(key, value);` to the schema.

**Rationale**:
- Current indexes: `idx_block_metadata_block(block_id)` and `idx_block_metadata_key(key)` — neither supports efficient `WHERE key = 'todoStatus' AND value = 'todo'` queries
- Composite index makes TODO queries fast
- ISO 8601 string comparison works correctly for date ranges (lexicographic ordering matches chronological ordering)
- No schema migration needed — just `CREATE INDEX IF NOT EXISTS`

### Decision 6: React-side Status Rendering (Outside CodeMirror)

**Decision**: `BlockComponent.tsx` reads `useBlockMetadata(id)` and renders a clickable status icon to the left of the bullet point. The `TODO` text also remains visible inside CodeMirror content. In preview mode (unfocused blocks), a lightweight CodeMirror ViewPlugin hides the prefix text to avoid visual duplication.

**Rationale**:
- React rendering is simpler, more accessible, and easier to style than CodeMirror decorations
- `useBlockMetadata(id)` selector already exists (`blockStore.ts:1187-1188`)
- The prefix text stays in content (source of truth) but is visually hidden when not editing
- No Lezer grammar changes needed — the ViewPlugin just applies `display: none` to the prefix range
- When a block gains focus, the prefix becomes visible for direct editing

---

## Data Model

### Important Type Distinction

**Two different Block types exist in the codebase:**

- `Block` in `src/outliner/types.ts` — editor/tree structure with `children: Block[]`, `parent: Block | null`. **NO metadata field.** Do NOT use for TODO.
- `BlockData` in `src/stores/blockStore.ts:16-28` — Zustand store data, flat structure with `metadata?: Record<string, string>`. **This is what TODO uses.**

All TODO data is stored in the existing `block_metadata` table via `BlockData.metadata`. No schema changes needed beyond the composite index.

### Metadata Keys

| Key | Values | Source | Phase |
|-----|--------|--------|-------|
| `todoStatus` | `todo`, `doing`, `done`, `later`, `canceled` | Derived from content prefix (Rust) | 1 |
| `scheduled` | ISO 8601 date (`2026-03-15`) | Set via UI/Copilot | 2 |
| `deadline` | ISO 8601 date (`2026-03-20`) | Set via UI/Copilot | 2 |
| `priority` | `A`, `B`, `C` | Set via UI/Copilot | 2 |
| `repeat` | RRULE string (e.g., `FREQ=WEEKLY;BYDAY=MO`) | Set via UI/Copilot | 4 |

### Status Lifecycle

```
              ┌──────────────────────────────────────┐
              │                                      │
              ▼                                      │
┌──────┐   ┌──────┐   ┌──────┐   ┌───────┐   ┌──────────┐
│ TODO │──▶│DOING │──▶│ DONE │   │ LATER │   │CANCELED  │
└──────┘   └──────┘   └──────┘   └───────┘   └──────────┘
   │          │                      ▲            ▲
   │          │                      │            │
   └──────────┴──────────────────────┴────────────┘
                   (any → any)
```

Default cycle on click: `TODO → DOING → DONE → TODO`  
Context menu: Access all statuses including `LATER` and `CANCELED`

### Status Semantics

| Status | Icon | Color Variable | Meaning |
|--------|------|---------------|---------|
| `todo` | `○` (empty circle) | `--color-accent` | Not started, needs attention |
| `doing` | `◐` (half circle) | `--color-warning` | In progress |
| `done` | `●` (filled circle) | `--color-success` | Completed |
| `later` | `◌` (dashed circle) | `--color-text-tertiary` | Deferred, someday |
| `canceled` | `⊘` (circle with slash) | `--color-text-tertiary` | Abandoned |

> Icons will be SVG, not emoji. All colors use CSS variables from the theme system.

### Priority Semantics

| Priority | Display | Color Variable | Sort Order |
|----------|---------|---------------|------------|
| `A` | Red dot | `--color-error` | 1 (first) |
| `B` | Orange dot | `--color-warning` | 2 |
| `C` | Blue dot | `--color-accent` | 3 |
| (none) | — | — | 4 (last) |

### Markdown Representation

A TODO block in a markdown file:

```markdown
- TODO Buy groceries
  ID:: abc-123
  todoStatus:: todo
  scheduled:: 2026-03-15
  priority:: A
```

- The `TODO` prefix in the first line is the source of truth
- The `todoStatus:: todo` metadata is derived from the prefix by Rust on save
- `scheduled` and `priority` are set independently via UI/Copilot
- This format is compatible with Logseq's block metadata syntax

### TypeScript Type Definitions

```typescript
// src/types/todo.ts

/** Recognized TODO status values */
type TodoStatus = "todo" | "doing" | "done" | "later" | "canceled";

/** Priority levels */
type Priority = "A" | "B" | "C";

/** Status prefixes recognized in block content */
const STATUS_PREFIXES: Record<string, TodoStatus> = {
  "TODO ": "todo",
  "DOING ": "doing",
  "DONE ": "done",
  "LATER ": "later",
  "CANCELED ": "canceled",
};

/** Reverse mapping: status → prefix string */
const STATUS_TO_PREFIX: Record<TodoStatus, string> = {
  todo: "TODO ",
  doing: "DOING ",
  done: "DONE ",
  later: "LATER ",
  canceled: "CANCELED ",
};

/** Default click cycle (short cycle) */
const STATUS_CYCLE: TodoStatus[] = ["todo", "doing", "done"];

/** Check if a block is a TODO block based on its metadata */
function isTodoBlock(metadata?: Record<string, string>): boolean {
  return metadata?.todoStatus !== undefined;
}

/** Extract status prefix from block content */
function extractStatusPrefix(
  content: string,
): { status: TodoStatus; rest: string } | null {
  for (const [prefix, status] of Object.entries(STATUS_PREFIXES)) {
    if (content.startsWith(prefix)) {
      return { status, rest: content.slice(prefix.length) };
    }
  }
  return null;
}

/** Replace or add status prefix in content */
function setStatusPrefix(content: string, newStatus: TodoStatus): string {
  const extracted = extractStatusPrefix(content);
  const rest = extracted ? extracted.rest : content;
  return STATUS_TO_PREFIX[newStatus] + rest;
}

/** Remove status prefix from content */
function removeStatusPrefix(content: string): string {
  const extracted = extractStatusPrefix(content);
  return extracted ? extracted.rest : content;
}
```

---

## Architecture

### System Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                         TODO SYSTEM FLOW                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  CAPTURE                     PROCESS                    QUERY        │
│  ───────                     ───────                    ─────        │
│                                                                      │
│  ┌─────────────┐   save     ┌──────────────┐   SQL    ┌──────────┐  │
│  │  CodeMirror  │──────────▶│  Rust Backend │◀────────│ todoStore│  │
│  │  (user types │  content  │              │  query   │          │  │
│  │   "TODO .." )│           │  1. Save     │         │  Today   │  │
│  └─────────────┘           │     content  │         │  Overdue │  │
│                             │  2. Extract  │         │  By prio │  │
│  ┌─────────────┐   tool    │     prefix   │         └──────────┘  │
│  │  AI Copilot  │──────────▶│  3. Write    │                       │
│  │  (natural    │  call     │     metadata │   event  ┌──────────┐  │
│  │   language)  │           │  4. Emit     │────────▶│ React UI │  │
│  └─────────────┘           │     event    │         │          │  │
│                             └──────────────┘         │  Status  │  │
│  ┌─────────────┐   click                             │  Icon    │  │
│  │  Status Icon │──────────▶ blockStore               │  + Badge │  │
│  │  (React)     │  .updateBlockContent()              └──────────┘  │
│  └─────────────┘                                                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### Layer 1: Capture

How TODO blocks are created:

| Method | Flow | Phase |
|--------|------|-------|
| **Inline typing** | User types `TODO Buy milk` → auto-save → Rust extracts prefix → metadata written | 1 |
| **Keyboard shortcut** | `Cmd+Enter` inserts `TODO ` prefix at block start → same flow | 1 |
| **Status icon click** | React calls `blockStore.updateBlockContent(id, newContent)` with prefix change | 1 |
| **AI Copilot Input** | `create_todo` tool via Copilot Input — natural language creates block with dates/priority | 3 |

#### Layer 2: Store (Persistence)

**Rust-side processing** (in `update_block_content` handler):

```rust
// Pseudocode for the extraction logic in update_block_content
fn extract_todo_status(content: &str) -> Option<&str> {
    let prefixes = [
        ("TODO ", "todo"),
        ("DOING ", "doing"),
        ("DONE ", "done"),
        ("LATER ", "later"),
        ("CANCELED ", "canceled"),
    ];
    for (prefix, status) in prefixes {
        if content.starts_with(prefix) {
            return Some(status);
        }
    }
    None
}

// Inside update_block_content transaction:
// 1. Save content to blocks table
// 2. Extract status prefix
// 3. If status found: upsert block_metadata(block_id, "todoStatus", status)
//    If no status found: delete block_metadata where key = "todoStatus"
// All in the same transaction
```

**Frontend stores**:

- `blockStore` — owns block content + metadata for current page. Provides `updateBlockContent()` and `useBlockMetadata()`.
- `todoStore` — workspace-wide TODO queries. Calls Rust backend directly. Does NOT subscribe to blockStore.

**Critical API distinction**:
- `updateBlock(id, Partial<BlockData>)` — sends metadata to Rust. Content is NOT sent.
- `updateBlockContent(id, content)` — sends content to Rust. Metadata is NOT sent.
- Cannot atomically update both in one call. Status changes always go through `updateBlockContent`.

#### Layer 3: Query

`todoStore` uses dedicated Rust commands for workspace-wide queries:

```rust
// New Rust commands (src-tauri/src/commands/todo.rs)

#[tauri::command]
pub async fn query_todos(
    workspace_path: String,
    filter: TodoFilter,
) -> Result<Vec<TodoResult>, String>;

pub struct TodoFilter {
    pub status: Option<Vec<String>>,       // ["todo", "doing"]
    pub priority: Option<Vec<String>>,     // ["A"]
    pub scheduled_from: Option<String>,    // ISO date
    pub scheduled_to: Option<String>,      // ISO date
    pub deadline_from: Option<String>,     // ISO date
    pub deadline_to: Option<String>,       // ISO date
    pub overdue_only: Option<bool>,        // deadline < today AND status != done/canceled
    pub page_id: Option<String>,           // filter to specific page
}

// SQL generation strategy:
// Build query using self-joins on block_metadata:
//
// SELECT DISTINCT bm_status.block_id, b.content, b.page_id, p.title
// FROM block_metadata bm_status
// JOIN blocks b ON b.id = bm_status.block_id
// JOIN pages p ON p.id = b.page_id
// LEFT JOIN block_metadata bm_sched
//   ON bm_sched.block_id = bm_status.block_id AND bm_sched.key = 'scheduled'
// LEFT JOIN block_metadata bm_dead
//   ON bm_dead.block_id = bm_status.block_id AND bm_dead.key = 'deadline'
// LEFT JOIN block_metadata bm_prio
//   ON bm_prio.block_id = bm_status.block_id AND bm_prio.key = 'priority'
// WHERE bm_status.key = 'todoStatus'
//   AND bm_status.value IN ('todo', 'doing')
//   [AND bm_sched.value >= ? AND bm_sched.value < ?]
// ORDER BY bm_prio.value ASC, bm_sched.value ASC
```

#### Layer 4: Render

**Block-level rendering** (in `BlockComponent.tsx`):

```
  Focused (editing):
  ┌──────────────────────────────────────────────────────┐
  │  [Status Icon]  [Bullet]  [CodeMirror Content]       │
  │       ○           •       TODO Buy groceries|        │
  └──────────────────────────────────────────────────────┘

  Unfocused (preview):
  ┌──────────────────────────────────────────────────────┐
  │  [Status Icon]  [Bullet]  [CodeMirror Content]       │
  │       ○           •       Buy groceries              │  ← prefix hidden
  └──────────────────────────────────────────────────────┘
```

- **Status icon**: React component, positioned left of bullet. Reads `useBlockMetadata(id)`.
- **Content prefix**: Visible in CodeMirror when block is focused. Hidden by ViewPlugin when unfocused.
- **Click behavior**: Left-click cycles `TODO → DOING → DONE → TODO`. Right-click opens context menu with all statuses.

---

## Implementation Phases

### Phase 1: Core TODO System

**Goal**: Basic TODO/DOING/DONE/LATER/CANCELED status with visual feedback and click cycling.

**Scope**: Type a status prefix → see an icon → click to cycle.

#### Files to Create

| File | Purpose |
|------|---------|
| `src/types/todo.ts` | Type definitions, constants, helper functions |
| `src/stores/todoStore.ts` | Workspace-wide TODO query store (Phase 1: minimal) |
| `src/components/todo/TodoStatusIcon.tsx` | Clickable status icon component |
| `src/editor/extensions/handlers/TodoPrefixHandler.ts` | ViewPlugin to hide prefix in unfocused blocks |
| `src-tauri/src/commands/todo.rs` | Rust TODO commands |

#### Files to Modify

| File | Change |
|------|--------|
| `src/outliner/BlockComponent.tsx` | Add `TodoStatusIcon` left of bullet when `todoStatus` metadata exists |
| `src-tauri/src/commands/block.rs` | In `update_block_content`: extract prefix → upsert/delete `todoStatus` metadata |
| `src-tauri/src/db/schema.rs` | Add composite index `idx_block_metadata_key_value` |
| `src-tauri/src/commands/mod.rs` | Register `todo` command module |
| `src-tauri/src/lib.rs` | Register `query_todos` command |

#### Detailed Implementation Steps

**Step 1: Type definitions** (`src/types/todo.ts`)
- Define `TodoStatus`, `Priority` types
- Define `STATUS_PREFIXES`, `STATUS_TO_PREFIX`, `STATUS_CYCLE` constants
- Implement `extractStatusPrefix()`, `setStatusPrefix()`, `removeStatusPrefix()`, `isTodoBlock()`

**Step 2: Composite index** (`src-tauri/src/db/schema.rs`)
- Add `CREATE INDEX IF NOT EXISTS idx_block_metadata_key_value ON block_metadata(key, value);`

**Step 3: Rust prefix extraction** (`src-tauri/src/commands/block.rs`)
- In `update_block_content` (or the function it calls to persist content):
  - After writing content to DB, extract status prefix
  - If prefix found: upsert `block_metadata` row with `key = "todoStatus"`, `value = <status>`
  - If no prefix found AND existing `todoStatus` metadata exists: delete it
  - All within the same transaction

**Step 4: TodoStatusIcon component** (`src/components/todo/TodoStatusIcon.tsx`)
- Props: `blockId: string`, `status: TodoStatus`
- Renders SVG icon based on status (see [Status Semantics](#status-semantics))
- Left-click: cycle through `STATUS_CYCLE` → call `blockStore.updateBlockContent()` with new prefix
- Right-click: open status picker popover with all 5 statuses + "Remove TODO" option
- Uses theme CSS variables for colors

**Step 5: BlockComponent integration** (`src/outliner/BlockComponent.tsx`)
- Read metadata: `const metadata = useBlockMetadata(blockId);`
- If `metadata?.todoStatus` exists, render `<TodoStatusIcon>` to the left of the bullet
- Ensure the icon doesn't shift block layout (absolute positioning or flex)

**Step 6: Prefix hiding ViewPlugin** (`src/editor/extensions/handlers/TodoPrefixHandler.ts`)
- Implements a CodeMirror `ViewPlugin`
- When a block is unfocused and content starts with a status prefix, applies `Decoration.replace({})` on the prefix range to visually hide it
- When the block gains focus, the decoration is removed, revealing the prefix for editing
- Register in the editor extension chain

**Step 7: Basic todoStore** (`src/stores/todoStore.ts`)
- Minimal for Phase 1: `setTodoStatus(blockId, status)` action
- This action calls `blockStore.updateBlockContent()` with the new prefix
- Workspace-wide queries deferred to Phase 2

**Step 8: Basic Rust query command** (`src-tauri/src/commands/todo.rs`)
- `query_todos(workspace_path, filter)` — returns blocks matching `TodoFilter`
- Phase 1 supports filtering by `status` only
- Returns `Vec<TodoResult>` with `{ blockId, content, pageId, pageTitle, status }`

#### Acceptance Criteria

- [ ] Type `TODO Buy milk` → on save, `block_metadata` contains `todoStatus:: todo`
- [ ] Block displays a status icon (○) to the left of the bullet
- [ ] Click icon → content changes to `DOING Buy milk`, icon updates to ◐
- [ ] Click again → `DONE Buy milk`, icon updates to ●
- [ ] Click again → `TODO Buy milk`, icon updates to ○
- [ ] Right-click icon → popover shows all 5 statuses, selecting one updates content prefix
- [ ] Unfocused TODO block: prefix text hidden in CodeMirror, icon shows status
- [ ] Focused TODO block: prefix text visible for editing
- [ ] Removing prefix entirely (editing `TODO Buy milk` to `Buy milk`) → `todoStatus` metadata deleted
- [ ] Existing `- [ ]`/`- [x]` checkboxes continue working unchanged
- [ ] `query_todos` Rust command returns correct results when filtered by status

---

### Phase 2: Smart Views & Dates

**Goal**: Date properties (scheduled/deadline), smart view panel, workspace-wide TODO queries.

#### Files to Create

| File | Purpose |
|------|---------|
| `src/components/todo/TodoPanel.tsx` | Sidebar panel with smart view list |
| `src/components/todo/TodoListView.tsx` | Renders a filtered list of TODO blocks |
| `src/components/todo/TodoDatePicker.tsx` | Date picker popover for scheduled/deadline |
| `src/utils/dateParser.ts` | Natural language date parsing (Korean + English) |

#### Files to Modify

| File | Change |
|------|--------|
| `src/stores/todoStore.ts` | Add workspace-wide queries, cache, and invalidation |
| `src-tauri/src/commands/todo.rs` | Full `TodoFilter` support with date ranges, priority, overdue |
| `src/stores/blockStore.ts` | Add `setBlockMetadata(blockId, key, value)` action |
| `src/outliner/BlockComponent.tsx` | Add date/priority badges next to status icon |

#### Acceptance Criteria

- [ ] Set scheduled date via date picker → `scheduled:: 2026-03-15` in metadata
- [ ] "Today" view shows blocks with `scheduled` = today
- [ ] "Overdue" view shows blocks with `deadline` < today AND status not `done`/`canceled`
- [ ] Smart view panel in sidebar shows counts for each view
- [ ] Natural language parsing: "내일" → tomorrow, "next Friday" → correct date
- [ ] Priority set via context menu → `priority:: A` in metadata
- [ ] Views sort by priority (A first), then by date

---

### Phase 3: AI Copilot Integration (Unified Interface)

**Goal**: Natural language task creation and queries via Copilot Input — the unified interface for AI requests, TODO creation, and natural language date parsing.

**Design Philosophy**: The Copilot Input serves as a unified command interface (like a terminal), handling:
- AI questions and requests
- TODO/task creation with natural language dates
- TODO queries and updates
- General assistant functionality

#### Files to Create

| File | Purpose |
|------|---------|
| `src/services/ai/tools/todo/createTodoTool.ts` | Create TODO block with metadata |
| `src/services/ai/tools/todo/queryTodosTool.ts` | Query/search TODO blocks |
| `src/services/ai/tools/todo/updateTodoTool.ts` | Update TODO status/dates/priority |
| `src/services/ai/tools/todo/suggestMyDayTool.ts` | AI suggests today's focus tasks |

#### Files to Modify

| File | Change |
|------|--------|
| `src/services/ai/tools/initialization.ts` | Register TODO tools via `toolRegistry.registerMany()` |
| `src/services/ai/agent/system-prompt.md` | Add TODO management section |

#### Acceptance Criteria

- [ ] "내일 회의 일정 잡아줘" → Creates TODO with scheduled date
- [ ] "오늘 할 일 뭐 있어?" → Lists today's tasks
- [ ] "우선순위 높은 일 보여줘" → Shows priority A tasks
- [ ] "이거 완료했어" → Updates focused task to DONE
- [ ] Tools registered under `METADATA` category

---

### Phase 4: Advanced Features

**Goal**: Enhanced productivity features for power users.

#### Potential Features

| Feature | Description |
|---------|-------------|
| Recurring Tasks | RRULE-based recurrence, completion triggers next instance |
| Task Statistics | Completion rates, productivity trends |
| Bulk Operations | Multi-select and batch update status/dates |
| Calendar View | Monthly calendar showing scheduled tasks |
| Kanban Board | Column-based view grouped by status |

Note: These are deferred to future planning based on user feedback.

---

### Phase 5: Future Considerations

Deferred to future planning. See [Future Considerations](#future-considerations).

---

## Keyboard Shortcuts

All shortcuts are chosen to avoid conflicts with existing bindings.

| Shortcut | Action | Phase |
|----------|--------|-------|
| `Cmd+Enter` | Toggle TODO on current block (add/remove `TODO ` prefix) | 1 |
| `Cmd+Shift+Enter` | Cycle status on current TODO block (→ DOING → DONE → TODO) | 1 |

**Existing shortcuts NOT available**:
- `Cmd+P` → `search`
- `Cmd+K` → `command_palette`
- `Cmd+N` → `new_page`
- `Cmd+G` → `graph_view`

---

## UI/UX Design

### Block-Level Status Indicator

```
  UNFOCUSED (preview mode):
  ┌─────────────────────────────────────────────┐
  │  ○  •  Buy groceries                        │  ← Prefix "TODO " hidden
  │  ◐  •  Write documentation                  │  ← Prefix "DOING " hidden
  │  ●  •  Fix login bug                        │  ← Prefix "DONE " hidden
  │  ◌  •  Research alternatives                │  ← Prefix "LATER " hidden
  └─────────────────────────────────────────────┘

  FOCUSED (edit mode):
  ┌─────────────────────────────────────────────┐
  │  ○  •  TODO Buy groceries|                  │  ← Prefix visible, cursor active
  └─────────────────────────────────────────────┘
```

### Status Icon Interaction

- **Left-click**: Cycle through short cycle (TODO → DOING → DONE → TODO)
- **Right-click**: Open popover with all 5 statuses + "Remove TODO" option
- **Hover**: Tooltip showing current status name

### Date & Priority Badges (Phase 2+)

```
  ┌──────────────────────────────────────────────────────────┐
  │  ○  •  Buy groceries            📅 Mar 15  🔴           │
  │  ◐  •  Write docs               📅 Mar 18               │
  │  ○  •  Review PR                 ⚠️ Overdue (Mar 13)     │
  └──────────────────────────────────────────────────────────┘
```

- Date badge: right-aligned, subtle
- Priority badge: colored dot, right-aligned
- Overdue: red text with warning icon

### Smart Views Panel (Phase 2+)

**Location**: Left sidebar, below file tree (collapsible section)

```
  ┌─────────────────────────┐
  │  📋 Tasks               │
  ├─────────────────────────┤
  │  📅 Today          (3)  │
  │  📆 Upcoming       (7)  │
  │  ⚠️ Overdue        (2)  │
  │  🚩 High Priority  (4)  │
  │  📥 All Tasks     (28)  │
  │  ✅ Completed      (15) │
  └─────────────────────────┘
```

### Quick Add via Copilot Input (Phase 3)

Instead of a separate dialog, TODO quick add is handled through the Copilot Input:

```
┌─────────────────────────────────────────────────────────┐
│  Copilot Input                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │ 내일 오후 3시에 팀 미팅 잡아줘                      │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘

→ Copilot processes natural language
→ create_todo(content="팀 미팅", scheduled="2026-02-23T15:00")
→ ✅ "팀 미팅" TODO가 현재 페이지에 생성되었습니다
```

**Unified Interface Benefits**:
- Single input for all interactions (AI, TODO, general)
- Consistent user experience
- AI can handle ambiguous input gracefully
- No need to remember separate shortcuts

---

## AI Copilot Integration

### Tool Definitions

```typescript
// createTodoTool.ts
const createTodoTool: Tool = {
  name: "create_todo",
  description: "Create a new TODO block with optional metadata",
  category: ToolCategory.METADATA,
  parameters: z.object({
    content: z.string().describe("Task description (without status prefix)"),
    status: z.enum(["todo", "doing", "later"]).default("todo"),
    scheduled: z.string().optional().describe("ISO 8601 date"),
    deadline: z.string().optional().describe("ISO 8601 date"),
    priority: z.enum(["A", "B", "C"]).optional(),
    pageId: z.string().optional().describe("Target page (default: current)"),
  }),
  execute: async (params, context: ToolContext) => {
    // 1. Build content: `TODO ${params.content}`
    // 2. Create block via blockStore
    // 3. Set date/priority metadata via blockStore
    // 4. Return confirmation
  },
};

// queryTodosTool.ts
const queryTodosTool: Tool = {
  name: "query_todos",
  description: "Search and filter TODO blocks across the workspace",
  category: ToolCategory.METADATA,
  parameters: z.object({
    status: z.array(z.enum(["todo", "doing", "done", "later", "canceled"])).optional(),
    priority: z.array(z.enum(["A", "B", "C"])).optional(),
    dateRange: z.enum(["today", "this_week", "overdue", "upcoming"]).optional(),
    query: z.string().optional().describe("Full-text search in task content"),
  }),
  execute: async (params, context: ToolContext) => {
    // Call todoStore query methods, format results
  },
};

// updateTodoTool.ts
const updateTodoTool: Tool = {
  name: "update_todo",
  description: "Update a TODO block's status, dates, or priority",
  category: ToolCategory.METADATA,
  parameters: z.object({
    blockId: z.string(),
    status: z.enum(["todo", "doing", "done", "later", "canceled"]).optional(),
    scheduled: z.string().nullable().optional(),
    deadline: z.string().nullable().optional(),
    priority: z.enum(["A", "B", "C"]).nullable().optional(),
  }),
  execute: async (params, context: ToolContext) => {
    // Update content prefix if status changed
    // Update metadata for dates/priority
  },
};
```

### Natural Language Patterns

```
User: "내일 오후 3시에 회의 일정 잡아줘"
→ create_todo(content="회의 일정", scheduled="2026-02-22T15:00")

User: "오늘 할 일 뭐 있어?"
→ query_todos(status=["todo","doing"], dateRange="today")

User: "프로젝트 기획안 완료했어"
→ update_todo(blockId=<found>, status="done")

User: "우선순위 높은 거 보여줘"
→ query_todos(priority=["A"], status=["todo","doing"])

User: "이번 주 마감인 것들 보여줘"
→ query_todos(dateRange="this_week")
```

### System Prompt Addition

Add to `src/services/ai/agent/system-prompt.md`:

```markdown
## TODO Management

You can help users manage tasks. Tasks are blocks with a status prefix.

### Creating Tasks
Use `create_todo`. The status prefix (TODO, DOING, etc.) is automatically added.

### Status Values
- TODO: Not started (prefix: `TODO `)
- DOING: In progress (prefix: `DOING `)
- DONE: Completed (prefix: `DONE `)
- LATER: Deferred (prefix: `LATER `)
- CANCELED: Abandoned (prefix: `CANCELED `)

### Priority Values
- A: High (urgent/important)
- B: Medium (important, not urgent)
- C: Low (nice to have)

### Date Properties
- scheduled: When the task should be started
- deadline: When the task must be completed

### Examples
User: "내일 회의 준비해줘" → create_todo(content="회의 준비", scheduled=<tomorrow>)
User: "오늘 할 일 알려줘" → query_todos(status=["todo","doing"], dateRange="today")
User: "이거 완료했어" → update_todo(blockId=<focused>, status="done")
```

### Natural Language + AI Hybrid Approach

Per user instruction, natural language processing and AI-based processing can be mixed:

1. **Rule-based** (fast, offline): Date parsing for common Korean/English patterns via `dateParser.ts`
2. **AI-based** (rich, online): Complex queries, task summarization, "My Day" suggestions via Copilot tools
3. **Mixed**: Quick Add dialog uses rule-based parsing for preview, AI for ambiguous cases

---

## Testing Strategy

### Unit Tests

```
src/types/__tests__/todo.test.ts
├── extractStatusPrefix() — all 5 prefixes + edge cases (no prefix, partial match)
├── setStatusPrefix() — replace existing prefix, add to plain content
├── removeStatusPrefix() — strip prefix, handle no-prefix content
└── isTodoBlock() — with metadata, without, undefined

src/utils/__tests__/dateParser.test.ts   (Phase 2)
├── Korean date patterns (내일, 모레, 다음주, 월요일, etc.)
├── English date patterns (tomorrow, next Friday, in 3 days, etc.)
├── ISO date strings (2026-03-15, 2026-03-15T14:00)
└── Invalid/ambiguous inputs → null
```

### Integration Tests

```
src/stores/__tests__/todoStore.test.ts
├── setTodoStatus() → verifies blockStore.updateBlockContent called with correct prefix
├── loadTodayTodos() → verifies Rust command called with correct filter  (Phase 2)
└── Cache invalidation on block save event  (Phase 2)

src-tauri/tests/todo_test.rs
├── update_block_content with "TODO task" → metadata has todoStatus=todo
├── update_block_content with "DOING task" → metadata has todoStatus=doing
├── update_block_content with "task" (no prefix) → todoStatus metadata deleted
├── query_todos filter by status → correct results
├── query_todos filter by date range → correct results  (Phase 2)
├── query_todos filter by priority → correct results  (Phase 2)
└── query_todos overdue logic → deadline < today, status active  (Phase 2)
```

### E2E Tests

```
e2e/todo.spec.ts
├── Type "TODO Buy milk" → verify status icon appears
├── Click status icon → verify content prefix cycles
├── Right-click status icon → verify all statuses in popover
├── Focus/unfocus block → verify prefix show/hide
└── Existing checkboxes still work alongside TODOs
```

---

## Migration & Compatibility

### Existing Blocks

- Blocks without a status prefix are unaffected. No migration needed.
- On first save of a page containing `TODO`/`DONE` etc. prefixes (e.g., imported from Logseq), the save path will automatically generate `todoStatus` metadata.

### Logseq Files

- Logseq uses identical status prefix format (`TODO`, `DONE`, `DOING`, `LATER`, `CANCELED`)
- Logseq metadata format (`key:: value`) is already supported by Oxinot's markdown parser
- Files created in Logseq work in Oxinot and vice versa

### Checkboxes

- `- [ ]` / `- [x]` checkboxes are a separate system (Decision 2)
- A block can have both: `- [x] DONE Completed task`
- No automatic conversion between the two systems

### Backward Compatibility

- Markdown files remain readable in any text editor
- Status prefixes are plain text
- Metadata stored in standard `key:: value` format (Logseq-compatible)
- Removing Oxinot: files retain all task information as plain text

---

## Performance Considerations

### Database Index

- Composite index `(key, value)` on `block_metadata` ensures TODO queries are fast with 10,000+ blocks
- Existing indexes `(block_id)` and `(key)` remain for other use cases

### Query Performance

- `query_todos` uses SQL self-joins — efficient with the composite index
- Workspace-wide queries bounded by total TODO count (typically < 1000 active)
- ISO 8601 date strings enable range queries without type conversion

### todoStore Cache

- Cache invalidated on Tauri block-save events (listen for `block-updated` event)
- Stale cache acceptable for ~1 second (matches auto-save debounce)
- No polling — event-driven invalidation only

### Rendering

- Status icons are lightweight SVG — no performance impact
- ViewPlugin for prefix hiding runs only on affected lines, not full document
- Smart view lists use `react-virtuoso` for 100+ items

### Debounce

- Content changes debounced at 1 second (existing auto-save behavior)
- Status icon clicks immediately update content (no debounce — instant feedback)
- todoStore cache refresh debounced at 500ms after save events

---

## Future Considerations

### Phase 5+ Features

1. **Recurring Tasks** — RRULE-based recurrence, completion triggers next instance
2. **Calendar View** — Monthly calendar showing scheduled tasks
3. **Task Statistics** — Completion rates, productivity trends
4. **Bulk Operations** — Multi-select and batch update status/dates
5. **Kanban Board** — Column-based view grouped by status
6. **Custom Statuses** — User-defined status labels beyond the default 5
7. **Calendar Integration** — Sync with Google Calendar / Apple Calendar
8. **Tag System** — Tag-based filtering and organization

### Extensibility

- Plugin API for custom views
- Custom status definitions
- Webhook integrations for external tools

---

## References

### Codebase References

| File | Relevant Lines | Description |
|------|---------------|-------------|
| `src/stores/blockStore.ts` | L16-28 | `BlockData` type with `metadata?: Record<string, string>` |
| `src/stores/blockStore.ts` | L571-606 | `updateBlock()` — sends metadata to Rust (NOT content) |
| `src/stores/blockStore.ts` | L608+ | `updateBlockContent()` — sends content to Rust (NOT metadata) |
| `src/stores/blockStore.ts` | L1187-1188 | `useBlockMetadata(id)` selector |
| `src/outliner/types.ts` | — | `Block` type — NO metadata field, do NOT use for TODO |
| `src/outliner/BlockComponent.tsx` | — | Block UI component (add status icon here) |
| `src/editor/extensions/handlers/TaskListHandler.ts` | — | Existing `- [ ]`/`- [x]` handler |
| `src/editor/extensions/widgets/CheckboxWidget.ts` | — | Existing checkbox widget |
| `src/editor/extensions/handlers/types.ts` | — | `DecorationHandler` interface, `BaseHandler` class |
| `src-tauri/src/commands/block.rs` | L1796 | `save_block_metadata()` |
| `src-tauri/src/commands/block.rs` | L1733 | `load_block_metadata()` |
| `src-tauri/src/commands/query.rs` | L202-243 | Batch metadata loading for query results |
| `src-tauri/src/models/block.rs` | L4-19 | Rust `Block` model with `metadata: HashMap<String, String>` |
| `src-tauri/src/db/schema.rs` | L63-74 | `block_metadata` table schema |
| `src-tauri/src/utils/markdown.rs` | L44 | `is_metadata_line()` function |
| `src/services/ai/tools/types.ts` | — | `Tool` interface, `ToolCategory`, `ToolContext` |
| `src/services/ai/tools/initialization.ts` | — | `toolRegistry.registerMany()` pattern |
| `src/stores/shortcutStore.ts` | — | Default shortcuts (conflict reference) |

### External References

- [Logseq Task Management](https://docs.logseq.com/#/page/tasks)
- [chrono-node Library](https://github.com/wanasit/chrono) — Natural language date parsing
- [Tauri Notification Plugin](https://v2.tauri.app/plugin/notification/)

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-21 | 0.1 | Initial specification draft |
| 2026-02-21 | 1.0 | Resolved all 6 architecture decisions; fixed Block vs BlockData type confusion; corrected updateBlock vs updateBlockContent separation; added Rust-side extraction flow; added composite index; detailed Phase 1 steps; removed shortcut conflicts; added performance section |

---

**Document Maintained By**: Oxinot Development Team  
**Branch**: `feature/todo-functionality`  
**Next Step**: Phase 1 implementation
