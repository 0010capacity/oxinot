# Oxinot TODO Functionality Technical Specification

**Version**: 0.1  
**Created**: 2026-02-21  
**Status**: Draft - Design Phase  
**Branch**: `feature/todo-functionality`

---

## Table of Contents

1. [Overview](#overview)
2. [Design Philosophy](#design-philosophy)
3. [Competitive Analysis Summary](#competitive-analysis-summary)
4. [Data Model](#data-model)
5. [Architecture](#architecture)
6. [Implementation Phases](#implementation-phases)
7. [AI Copilot Integration](#ai-copilot-integration)
8. [UI/UX Design](#uiux-design)
9. [API Reference](#api-reference)
10. [Testing Strategy](#testing-strategy)
11. [Migration & Compatibility](#migration--compatibility)
12. [Future Considerations](#future-considerations)

---

## Overview

### Problem Statement

Oxinot is a Logseq-style block-based markdown outliner. Users need task management capabilities that:
- Integrate naturally with the block-based editing experience
- Support both quick capture and structured organization
- Leverage the existing AI Copilot for enhanced productivity
- Maintain compatibility with standard markdown formats

### Goals

1. **Natural Integration**: TODOs feel like native blocks, not a separate system
2. **Progressive Complexity**: Simple by default, powerful when needed
3. **AI-Enhanced**: Leverage Copilot for natural language task creation
4. **Cross-Platform**: Work seamlessly across markdown files and tools
5. **Queryable**: Support filtered views (Today, This Week, Priority, etc.)

### Non-Goals

- Team collaboration features (Phase 2+)
- Time tracking
- Gantt charts / Timeline views (Phase 2+)
- Mobile app sync (requires separate effort)

---

## Design Philosophy

### Core Principles

```
┌─────────────────────────────────────────────────────────────┐
│                 OXINOT TODO DESIGN PRINCIPLES               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. BLOCK-FIRST        Every TODO is a block first,        │
│                       with optional task metadata           │
│                                                             │
│  2. PROGRESSIVE        Level 1: Checkbox only               │
│     COMPLEXITY         Level 2: Status + Date               │
│                       Level 3: Priority + Tags              │
│                       Level 4: Recurring + Reminders        │
│                                                             │
│  3. AI-NATIVE          Natural language → Structured task   │
│                       Copilot as the primary interface      │
│                                                             │
│  4. MARKDOWN           Compatible with standard markdown    │
│     COMPATIBLE         task syntax where possible           │
│                                                             │
│  5. QUERY-POWERED      Smart views via existing query       │
│                       system extension                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Inspiration Sources

| App | What We Adopt |
|-----|---------------|
| **Logseq** | `TODO`/`DONE`/`DOING`/`LATER` markers, block-centric approach |
| **Things 3** | Fixed smart views (Today, Upcoming, Anytime, Someday), minimal UI |
| **Todoist** | Natural language date parsing, inline priority syntax |
| **Notion** | Document + task unification, flexible views |
| **Apple Reminders** | Progressive disclosure, Siri-style capture |
| **Microsoft To Do** | "My Day" daily focus concept, AI suggestions |

---

## Competitive Analysis Summary

### Feature Matrix

| Feature | Logseq | Things 3 | Todoist | Notion | Apple | MS To Do | **Oxinot** |
|---------|--------|----------|---------|--------|-------|----------|------------|
| Block-based | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Status markers | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Natural language | ⚠️ | ✅ | ✅✅ | ❌ | ✅ | ⚠️ | ✅ (AI) |
| Smart views | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Document integration | ✅ | ❌ | ❌ | ✅✅ | ❌ | ❌ | ✅ |
| AI assistant | ❌ | ❌ | ⚠️ | ✅ | ⚠️ | ⚠️ | ✅✅ |
| Local-first | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Open format | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

### Key Differentiators for Oxinot

1. **AI-First Capture**: Copilot handles natural language → structured metadata
2. **Block-Native**: No separate task database, everything is a block
3. **Outliner Power**: Leverage existing hierarchy, folding, navigation
4. **Markdown Pure**: Files remain readable without Oxinot

---

## Data Model

### Block Extension

TODO functionality extends the existing `BlockData` interface via the `metadata` field:

```typescript
// src/stores/blockStore.ts

// Existing metadata field (already persisted)
metadata?: Record<string, string>;

// New TODO-specific metadata keys
interface TodoMetadata {
  // Status (required for TODO blocks)
  todoStatus?: "todo" | "doing" | "done" | "later" | "canceled";
  
  // Dates (optional)
  scheduled?: string;      // ISO 8601 date-time (start date)
  deadline?: string;       // ISO 8601 date-time (due date)
  
  // Priority (optional)
  priority?: "A" | "B" | "C";  // A = High, B = Medium, C = Low
  
  // Tags (optional) - stored as comma-separated or JSON array
  tags?: string;
  
  // Recurrence (Phase 4)
  repeat?: RecurrenceRule;
  
  // Reminder (Phase 3)
  reminder?: string;       // ISO 8601 date-time
}

// Type guard for TODO blocks
function isTodoBlock(block: BlockData): boolean {
  return block.metadata?.todoStatus !== undefined;
}
```

### Status Semantics

| Status | Display | Color | Meaning |
|--------|---------|-------|---------|
| `todo` | 🔵 TODO | Blue | Not started, needs attention |
| `doing` | 🟡 DOING | Yellow | In progress |
| `done` | ✅ DONE | Green | Completed |
| `later` | ⏸️ LATER | Gray | Deferred, no specific date |
| `canceled` | ❌ CANCELED | Red | Abandoned |

### Priority Semantics

| Priority | Display | Color | Sort Order |
|----------|---------|-------|------------|
| `A` | #A | Red (High) | First |
| `B` | #B | Orange (Medium) | Second |
| `C` | #C | Blue (Low) | Third |
| (none) | - | Default | Last |

### Markdown Representation

**Option A: Status Prefix (Logseq-style)**
```markdown
- TODO Review pull request
- DOING Write documentation
- DONE Fix login bug
- LATER Research alternatives
```

**Option B: Metadata Lines (Current Oxinot format)**
```markdown
- Review pull request
  ID:: abc123
  todoStatus:: todo
  priority:: A
  scheduled:: 2024-03-15
```

**Decision**: Support **both** formats:
- Parse status prefix on import
- Store in metadata for queryability
- Serialize with prefix for readability

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      TODO SYSTEM                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌────────────┐  │
│  │   Capture    │────▶│    Parser    │────▶│   Store    │  │
│  │              │     │              │     │            │  │
│  │ - Inline     │     │ - Status     │     │ - metadata │  │
│  │ - Copilot    │     │ - Dates      │     │ - content  │  │
│  │ - Quick Add  │     │ - Priority   │     │ - children │  │
│  └──────────────┘     └──────────────┘     └────────────┘  │
│                                                     │       │
│                                                     ▼       │
│  ┌──────────────┐     ┌──────────────┐     ┌────────────┐  │
│  │    Views     │◀────│    Query     │◀────│  Backend   │  │
│  │              │     │    Engine    │     │  (Rust)    │  │
│  │ - Today      │     │              │     │            │  │
│  │ - This Week  │     │ - Filters    │     │ - SQLite   │  │
│  │ - Priority   │     │ - Sorts      │     │ - FTS5     │  │
│  │ - All Tasks  │     │ - Groups     │     │ - Metadata │  │
│  └──────────────┘     └──────────────┘     └────────────┘  │
│         │                                          │       │
│         ▼                                          ▼       │
│  ┌──────────────┐                          ┌────────────┐  │
│  │   Renderer   │                          │   Notify   │  │
│  │              │                          │            │  │
│  │ - Checkbox   │                          │ - Desktop  │  │
│  │ - Status     │                          │ - Sound    │  │
│  │ - Priority   │                          │ - Badge    │  │
│  └──────────────┘                          └────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### 1. Capture Layer

**Inline Editing**
- Type `TODO`, `DONE`, etc. at block start → auto-detect
- Type date patterns → highlight and parse
- Keyboard shortcut `Cmd+T` → create TODO block

**Copilot Integration**
- "내일 오후 3시에 회의 일정 잡아줘" → Creates block with metadata
- "이번 주에 해야 할 일 정리해줘" → Queries and summarizes

**Quick Add**
- Global shortcut (Tauri) for system-wide capture
- Opens minimal input → parses → saves

#### 2. Parser Layer

**File**: `src/utils/todoParser.ts`

```typescript
interface ParsedTodo {
  content: string;           // Clean task text
  status: TodoStatus;        // Parsed status
  scheduled?: Date;          // Parsed date
  deadline?: Date;           // Parsed deadline
  priority?: Priority;       // Parsed priority
  tags?: string[];           // Parsed tags
}

function parseTodoBlock(content: string): ParsedTodo;
function parseNaturalDate(text: string): Date | null;
function extractPriority(text: string): Priority | null;
```

**Natural Language Date Parser**

```typescript
// Hybrid approach: Rules + AI fallback
import * as chrono from 'chrono-node';

function parseDate(text: string): Date | null {
  // 1. ISO format (2024-03-15)
  if (isISODate(text)) return parseISO(text);
  
  // 2. Korean patterns
  const koreanDate = parseKoreanDate(text);
  if (koreanDate) return koreanDate;
  
  // 3. English patterns (chrono-node)
  const englishDate = chrono.parseDate(text);
  if (englishDate) return englishDate;
  
  // 4. AI fallback (via Copilot)
  return null; // Let AI handle complex cases
}

// Korean patterns
const KOREAN_PATTERNS = {
  '내일': () => addDays(new Date(), 1),
  '모레': () => addDays(new Date(), 2),
  '다음주': () => addWeeks(new Date(), 1),
  '월요일': () => nextMonday(new Date()),
  // ... more patterns
};
```

#### 3. Store Layer

**New Store**: `src/stores/todoStore.ts`

```typescript
interface TodoStore {
  // Computed views (derived from blockStore)
  todayTodos: BlockData[];
  upcomingTodos: BlockData[];
  overdueTodos: BlockData[];
  priorityTodos: BlockData[];
  
  // Actions
  toggleTodoStatus: (blockId: string) => void;
  setTodoStatus: (blockId: string, status: TodoStatus) => void;
  setTodoScheduled: (blockId: string, date: Date | null) => void;
  setTodoPriority: (blockId: string, priority: Priority | null) => void;
  
  // Queries
  getTodosByDate: (date: Date) => BlockData[];
  getTodosByPriority: (priority: Priority) => BlockData[];
  searchTodos: (query: string) => BlockData[];
}
```

#### 4. Query Layer

**Extension to existing query system**

```typescript
// src-tauri/src/models/query.rs - Extended

pub struct TodoFilter {
    pub status: Option<Vec<TodoStatus>>,
    pub priority: Option<Vec<Priority>>,
    pub scheduled_range: Option<DateRange>,
    pub deadline_range: Option<DateRange>,
    pub overdue_only: bool,
    pub tags: Option<Vec<String>>,
}

// New query syntax examples:
// {{query (todo status:todo,doing scheduled:today)}}
// {{query (todo priority:A overdue:true)}}
// {{query (todo scheduled:this_week)}}
```

#### 5. View Layer

**Components**:
- `TodoView.tsx` - Main task list view
- `TodoItem.tsx` - Single task row
- `TodoFilters.tsx` - Filter controls
- `TodoQuickAdd.tsx` - Quick capture input

#### 6. Notification Layer

**Tauri Integration**:

```typescript
import { sendNotification, isPermissionGranted } from '@tauri-apps/plugin-notification';

async function scheduleTodoReminder(block: BlockData) {
  if (!block.metadata?.reminder) return;
  
  const granted = await isPermissionGranted();
  if (!granted) return;
  
  // Schedule notification
  await sendNotification({
    title: 'Task Reminder',
    body: block.content,
    schedule: { at: new Date(block.metadata.reminder) }
  });
}
```

---

## Implementation Phases

### Phase 1: Core TODO System (Week 1-2)

**Goal**: Basic TODO/DOING/DONE/LATER status with visual feedback

**Deliverables**:
1. Status parsing from block content
2. Status toggle in block UI
3. Status indicators (icons/colors)
4. Markdown serialization

**Files to Create/Modify**:
```
CREATE:
  src/utils/todoParser.ts
  src/stores/todoStore.ts
  src/components/todo/TodoStatusIndicator.tsx
  src/components/todo/TodoCheckbox.tsx

MODIFY:
  src/stores/blockStore.ts (add helper methods)
  src/outliner/BlockComponent.tsx (integrate status UI)
  src/utils/markdownBlockParser.ts (parse status markers)
  src/outliner/blockUtils.ts (serialize status markers)
  src-tauri/src/models/query.rs (todo filter support)
```

**Acceptance Criteria**:
- [ ] Type `TODO Task` → Creates block with `todoStatus:: todo`
- [ ] Click status → Cycles through: todo → doing → done → later → todo
- [ ] Status shows colored icon
- [ ] Saved as `TODO Task` in markdown (with ID:: and todoStatus:: metadata)

---

### Phase 2: Smart Views & Dates (Week 3-4)

**Goal**: Scheduled/deadline dates + filtered views

**Deliverables**:
1. Natural language date parsing
2. Scheduled/deadline metadata
3. "Today" view
4. "This Week" view
5. "Overdue" view
6. Date picker UI

**Files to Create/Modify**:
```
CREATE:
  src/utils/dateParser.ts
  src/components/todo/TodoDatePicker.tsx
  src/components/todo/TodoViews.tsx
  src/components/todo/TodoViewToday.tsx
  src/components/todo/TodoViewUpcoming.tsx

MODIFY:
  src/utils/todoParser.ts (add date parsing)
  src/stores/todoStore.ts (add date queries)
  src-tauri/src/commands/query.rs (date range filters)
```

**Acceptance Criteria**:
- [ ] "내일 오후 3시" → Parses to scheduled date
- [ ] Tasks show in "Today" view if scheduled for today
- [ ] Overdue tasks highlighted in red
- [ ] Date picker accessible from block context menu

---

### Phase 3: AI Copilot Integration (Week 5-6)

**Goal**: Natural language task creation via Copilot

**Deliverables**:
1. Copilot tools for TODO operations
2. Natural language → metadata extraction
3. "My Day" AI suggestions
4. Batch task creation

**Files to Create/Modify**:
```
CREATE:
  src/services/ai/tools/todo/createTodoTool.ts
  src/services/ai/tools/todo/queryTodosTool.ts
  src/services/ai/tools/todo/updateTodoTool.ts
  src/services/ai/tools/todo/suggestMyDayTool.ts

MODIFY:
  src/services/ai/tools/initialization.ts (register tools)
  src/services/ai/agent/system-prompt.md (TODO tool docs)
  src/components/copilot/CopilotPanel.tsx (TODO-aware)
```

**Copilot Tool Examples**:

```typescript
// createTodoTool.ts
const createTodoTool: Tool = {
  name: 'create_todo',
  description: 'Create a TODO block with parsed metadata',
  parameters: z.object({
    content: z.string().describe('Task content'),
    status: z.enum(['todo', 'doing', 'done', 'later']).optional(),
    scheduled: z.string().optional().describe('Natural language date'),
    priority: z.enum(['A', 'B', 'C']).optional(),
    parentBlockId: z.string().optional(),
    pageId: z.string().optional(),
  }),
  execute: async (params, context) => {
    const parsed = await parseTodoFromNaturalLanguage(params);
    return createBlockWithMetadata(parsed);
  }
};
```

**Acceptance Criteria**:
- [ ] "내일 회의 일정 잡아줘" → Creates TODO with scheduled date
- [ ] "이번 주에 뭐 해야 해?" → Lists this week's tasks
- [ ] "우선순위 높은 일 보여줘" → Shows priority A tasks
- [ ] Copilot suggests tasks for "My Day"

---

### Phase 4: Priority & Notifications (Week 7-8)

**Goal**: Priority system + desktop notifications

**Deliverables**:
1. Priority parsing (#A, #B, #C)
2. Priority sort/filter
3. Desktop notifications (Tauri)
4. Reminder scheduling

**Files to Create/Modify**:
```
CREATE:
  src/components/todo/TodoPriorityIndicator.tsx
  src/services/notificationService.ts
  src-tauri/src/commands/notification.rs

MODIFY:
  src/utils/todoParser.ts (priority parsing)
  src/stores/todoStore.ts (priority queries)
  src-tauri/Cargo.toml (add notification plugins)
```

**Acceptance Criteria**:
- [ ] #A in text → Sets priority to A
- [ ] Tasks sortable by priority
- [ ] Notification appears at scheduled reminder time
- [ ] Notification clicks → Opens relevant page/block

---

### Phase 5: Advanced Features (Week 9-12)

**Goal**: Recurring tasks, calendar view, statistics

**Deliverables**:
1. Recurring task templates
2. Calendar view (monthly)
3. Task statistics
4. Bulk operations

**Files to Create/Modify**:
```
CREATE:
  src/components/todo/TodoCalendarView.tsx
  src/components/todo/TodoStats.tsx
  src/components/todo/TodoRecurringDialog.tsx
  src/stores/todoRecurringStore.ts

MODIFY:
  Multiple files for recurring logic
```

---

## AI Copilot Integration

### Natural Language Patterns

**Task Creation**:
```
User: "회의 준비 내일 오후 2시에 해줘"
Copilot: 
  - Parses: content="회의 준비", scheduled="2024-03-16T14:00"
  - Creates: - TODO 회의 준비
               todoStatus:: todo
               scheduled:: 2024-03-16T14:00

User: "프로젝트 기획안 작성, 높은 우선순위로"
Copilot:
  - Parses: content="프로젝트 기획안 작성", priority="A"
  - Creates: - TODO #A 프로젝트 기획안 작성
```

**Task Queries**:
```
User: "오늘 할 일 뭐 있어?"
Copilot: Queries today's tasks, lists them

User: "이번 주 마감인 것들 보여줘"
Copilot: Queries deadline:this_week, shows list

User: "우선순위 높은데 아직 안 한 거?"
Copilot: Queries priority:A status:todo|doing, shows list
```

**Task Management**:
```
User: "회의 준비 완료했어"
Copilot: Finds "회의 준비" task, sets status to done

User: "모든 미팅 태스크 나중으로 미뤄"
Copilot: Finds tasks with #meeting tag, sets status to later
```

### Copilot Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `create_todo` | Create TODO with metadata | content, status?, scheduled?, priority?, pageId? |
| `update_todo_status` | Change task status | blockId, newStatus |
| `update_todo_date` | Set scheduled/deadline | blockId, field, date |
| `query_todos` | Search/filter tasks | status?, priority?, dateRange?, tags? |
| `suggest_my_day` | AI suggests today's focus | none (uses context) |
| `bulk_update_todos` | Update multiple tasks | blockIds[], updates |

### System Prompt Extension

Add to `src/services/ai/agent/system-prompt.md`:

```markdown
## TODO Management

You can help users manage tasks in their outliner. Tasks are blocks with TODO metadata.

### Status Values
- TODO: Not started
- DOING: In progress  
- DONE: Completed
- LATER: Deferred
- CANCELED: Abandoned

### Priority Values
- A: High priority (#A)
- B: Medium priority (#B)
- C: Low priority (#C)

### Natural Language Dates
Parse Korean and English date expressions:
- "내일", "tomorrow" → tomorrow's date
- "이번 주 금요일", "this Friday" → specific date
- "다음 주", "next week" → start of next week

### Example Interactions

User: "내일 회의 준비해줘"
Action: create_todo with content="회의 준비", scheduled=tomorrow

User: "오늘 할 일 알려줘"
Action: query_todos with status=todo|doing, scheduled=today
Response: List matching tasks

User: "이거 완료했어" (referring to a task)
Action: update_todo_status with newStatus=done
```

---

## UI/UX Design

### Block-Level UI

**Status Indicator** (left of bullet):
```
┌─────────────────────────────────────────┐
│ 🔵  TODO Review pull request            │  ← Click to cycle status
│      todoStatus:: todo                  │  ← Metadata (collapsed by default)
│      scheduled:: 2024-03-15             │
├─────────────────────────────────────────┤
│ 🟡  DOING Write documentation           │
├─────────────────────────────────────────┤
│ ✅  DONE Fix login bug                  │
├─────────────────────────────────────────┤
│ ⏸️  LATER Research alternatives         │
└─────────────────────────────────────────┘
```

**Priority Indicator** (inline with content):
```
- 🔵  TODO #A Urgent bug fix              │  ← #A shows red badge
- 🔵  TODO #B Regular feature             │  ← #B shows orange badge
- 🔵  TODO #C Nice to have                │  ← #C shows blue badge
- 🔵  TODO No priority specified          │  ← No badge
```

### Smart Views Panel

**Location**: Left sidebar (collapsible)

```
┌─────────────────────────┐
│  📋 Tasks               │
├─────────────────────────┤
│  📅 Today (3)           │  ← Click to view
│  📆 This Week (7)       │
│  ⚠️ Overdue (2)         │  ← Red badge
│  🚩 Priority A (4)      │
│  📥 Inbox (12)          │  ← No date, no project
│  ✅ Completed (28)      │
├─────────────────────────┤
│  + New Smart View       │
└─────────────────────────┘
```

### Today View

```
┌─────────────────────────────────────────────────────────┐
│  📅 Today - March 15, 2024                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ⚠️ OVERDUE                                            │
│  ├─ 🔵 TODO Submit report (due Mar 13)                 │
│  └─ 🔵 TODO Review PR (due Mar 14)                     │
│                                                         │
│  🕐 SCHEDULED                                           │
│  ├─ 🟡 DOING Team meeting (14:00)                      │
│  ├─ 🔵 TODO Call client (16:00)                        │
│  └─ 🔵 TODO Review proposal (18:00)                    │
│                                                         │
│  📥 NO TIME                                            │
│  └─ 🔵 TODO Reply to emails                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Quick Add Dialog

**Keyboard shortcut**: `Cmd+Shift+T` (global via Tauri)

```
┌─────────────────────────────────────────────────────────┐
│  ➕ Quick Add Task                           [⌘⇧T]    │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────┐ │
│  │ 내일 오후 3시에 팀 미팅 #A                         │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Parsed:                                                │
│  ├─ Status: TODO                                       │
│  ├─ Scheduled: Mar 16, 2024 15:00                      │
│  └─ Priority: A                                        │
│                                                         │
│  [Cancel]                              [Add to Today]  │
└─────────────────────────────────────────────────────────┘
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+T` | Create new TODO block at cursor |
| `Cmd+Shift+T` | Global quick add dialog |
| `Space` (on TODO) | Toggle between todo/done |
| `Cmd+D` | Set scheduled date |
| `Cmd+P` | Cycle priority |
| `Cmd+1/2/3` | Set priority A/B/C |
| `T` | Today view |
| `U` | Upcoming view |
| `O` | Overdue view |

---

## API Reference

### Store Methods

```typescript
// src/stores/todoStore.ts

interface TodoStore {
  // Getters (computed from blockStore)
  readonly todayTodos: BlockData[];
  readonly upcomingTodos: BlockData[];
  readonly overdueTodos: BlockData[];
  readonly inboxTodos: BlockData[];  // No date, no status
  
  // Actions
  toggleTodoStatus(blockId: string): void;
  setTodoStatus(blockId: string, status: TodoStatus): void;
  setScheduled(blockId: string, date: Date | null): void;
  setDeadline(blockId: string, date: Date | null): void;
  setPriority(blockId: string, priority: Priority | null): void;
  addTags(blockId: string, tags: string[]): void;
  removeTags(blockId: string, tags: string[]): void;
  
  // Queries
  getTodosByDateRange(start: Date, end: Date): BlockData[];
  getTodosByStatus(status: TodoStatus): BlockData[];
  getTodosByPriority(priority: Priority): BlockData[];
  searchTodos(query: string): BlockData[];
  
  // Bulk operations
  bulkSetStatus(blockIds: string[], status: TodoStatus): void;
  bulkReschedule(blockIds: string[], date: Date): void;
}
```

### Parser Functions

```typescript
// src/utils/todoParser.ts

interface ParsedTodo {
  content: string;
  status: TodoStatus;
  scheduled?: Date;
  deadline?: Date;
  priority?: Priority;
  tags?: string[];
}

// Parse block content for TODO metadata
function parseTodoFromContent(content: string): ParsedTodo;

// Extract status prefix (TODO, DONE, etc.)
function extractStatusPrefix(content: string): { status: TodoStatus; remaining: string };

// Parse natural language date
function parseNaturalDate(text: string): Date | null;

// Serialize TODO to markdown
function serializeTodo(block: BlockData): string;
```

### Backend Commands

```rust
// src-tauri/src/commands/todo.rs

#[tauri::command]
pub async fn query_todos(
    workspace_path: String,
    filter: TodoFilter,
) -> Result<Vec<TodoResult>, String>;

#[tauri::command]
pub async fn get_today_todos(
    workspace_path: String,
) -> Result<Vec<TodoResult>, String>;

#[tauri::command]
pub async fn get_overdue_todos(
    workspace_path: String,
) -> Result<Vec<TodoResult>, String>;

struct TodoFilter {
    status: Option<Vec<String>>,
    priority: Option<Vec<String>>,
    scheduled_from: Option<String>,
    scheduled_to: Option<String>,
    deadline_from: Option<String>,
    deadline_to: Option<String>,
    tags: Option<Vec<String>>,
    overdue_only: Option<bool>,
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// src/utils/__tests__/todoParser.test.ts

describe('todoParser', () => {
  describe('extractStatusPrefix', () => {
    it('should extract TODO status', () => {
      expect(extractStatusPrefix('TODO Task')).toEqual({
        status: 'todo',
        remaining: 'Task'
      });
    });
    
    it('should extract DOING status', () => {
      expect(extractStatusPrefix('DOING Work')).toEqual({
        status: 'doing',
        remaining: 'Work'
      });
    });
    
    it('should return default for no prefix', () => {
      expect(extractStatusPrefix('Just text')).toEqual({
        status: null,
        remaining: 'Just text'
      });
    });
  });
  
  describe('parseNaturalDate', () => {
    it('should parse Korean dates', () => {
      // "내일" → tomorrow
      // "모레" → day after tomorrow
    });
    
    it('should parse English dates via chrono', () => {
      // "tomorrow at 3pm"
      // "next Friday"
    });
    
    it('should parse ISO dates', () => {
      // "2024-03-15"
      // "2024-03-15T14:00"
    });
  });
  
  describe('parseTodoFromContent', () => {
    it('should parse full TODO line', () => {
      const result = parseTodoFromContent('TODO #A Task tomorrow at 3pm');
      expect(result.status).toBe('todo');
      expect(result.priority).toBe('A');
      expect(result.scheduled).toBeTruthy();
    });
  });
});
```

### Integration Tests

```typescript
// src/stores/__tests__/todoStore.integration.test.ts

describe('TodoStore Integration', () => {
  it('should sync with blockStore', () => {
    // Create block with todo metadata
    // Verify todoStore computed updates
  });
  
  it('should query today\'s todos', () => {
    // Create todos with various dates
    // Query today
    // Verify correct results
  });
});
```

### E2E Tests

```typescript
// e2e/todo.spec.ts

test('create and complete TODO', async ({ page }) => {
  await page.goto('/');
  
  // Create TODO
  await page.keyboard.press('Cmd+T');
  await page.type('[contenteditable]', 'TODO Test task');
  await page.keyboard.press('Enter');
  
  // Verify created
  await expect(page.locator('text=TODO Test task')).toBeVisible();
  
  // Complete
  await page.click('[data-testid="todo-status"]');
  
  // Verify status changed
  await expect(page.locator('[data-status="done"]')).toBeVisible();
});
```

---

## Migration & Compatibility

### Existing Blocks

Blocks without TODO metadata remain unchanged. No migration needed.

### Import from Other Tools

**Logseq Import**:
- Already uses TODO/DONE/DOING/LATER markers
- Direct compatibility

**Markdown Files**:
- `- [ ] Task` → Maps to `todoStatus:: todo`
- `- [x] Task` → Maps to `todoStatus:: done`

**Todoist Export**:
- Parse CSV/JSON export
- Map priorities (p1→A, p2→B, p3→C)
- Map dates to scheduled

### Backward Compatibility

- Markdown files remain readable without Oxinot
- Status prefix (`TODO`, `DONE`) visible in any editor
- Metadata stored in existing `metadata` field

---

## Future Considerations

### Phase 6+ Features

1. **Recurring Tasks**
   - Templates for daily/weekly/monthly
   - Completion triggers next instance
   - Edit template vs instance

2. **Calendar Integration**
   - Sync with Google Calendar / Apple Calendar
   - Bi-directional updates
   - Event → Task conversion

3. **Team Collaboration**
   - Assign tasks to users
   - Shared projects
   - Activity feed

4. **Time Tracking**
   - Start/stop timer
   - Duration tracking
   - Reports

5. **Advanced Views**
   - Kanban board
   - Gantt timeline
   - Calendar month view

6. **Mobile Companion**
   - iOS/Android app
   - Offline sync
   - Push notifications

### Performance Considerations

- Cache computed views (revalidate on block change)
- Virtualized lists for 1000+ tasks
- Background query refresh
- Lazy load statistics

### Extensibility

- Plugin API for custom views
- Custom status definitions
- Custom date parsers
- Webhook integrations

---

## References

### Related Documentation

- [Copilot Architecture](./COPILOT_ARCHITECTURE.md)
- [Block Store Implementation](../src/stores/blockStore.ts)
- [Query System](../src-tauri/src/commands/query.rs)

### External Resources

- [Logseq Task Management](https://logseq.com/docs/tasks)
- [Todoist Natural Language Dates](https://todoist.com/help/articles/dates-and-times)
- [chrono-node Library](https://github.com/wanasit/chrono)

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-21 | 0.1 | Initial specification draft |

---

**Document Maintained By**: Oxinot Development Team  
**Created**: 2026-02-21  
**Target Implementation**: Q1-Q2 2026
