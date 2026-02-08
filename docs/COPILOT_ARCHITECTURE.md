# Oxinot Copilot System Architecture

**Version**: 0.2  
**Last Updated**: 2026-02-08  
**Status**: Comprehensive architecture review and documentation

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Intent-First Routing Philosophy](#intent-first-routing-philosophy)
3. [Core Architecture](#core-architecture)
4. [Agent Orchestration](#agent-orchestration)
5. [Tool System](#tool-system)
6. [Provider Layer](#provider-layer)
7. [UI/UX Architecture](#uiux-architecture)
8. [Block Structure Semantics](#block-structure-semantics)
9. [Implementation Details](#implementation-details)
10. [Audit Findings & Future Work](#audit-findings--future-work)

---

## System Overview

### Purpose

The Oxinot Copilot is an **Intent-First, Tool-Driven AI Assistant** embedded in a block-based markdown outliner. Its core responsibility is to:

1. **Classify user intent** (conversational, information request, content creation, content modification)
2. **Select appropriate tools** based on that intent
3. **Execute tools through an agent orchestrator** to accomplish user goals
4. **Provide real-time feedback** via streaming responses

### Architecture Diagram

```
User Input
    ↓
Intent Classification (intentClassifier.ts)
    ↓
Tool Selection (toolSelector.ts)
    ↓
Agent Orchestrator (orchestrator.ts)
    ├─ LLM Provider (OpenAI, Claude, Ollama, etc.)
    ├─ Tool Registry
    ├─ Error Recovery
    └─ State Management
    ↓
Tool Execution (tools/block/, tools/page/, tools/context/)
    ↓
Response → Chat UI (CopilotPanel.tsx)
```

### Key Principles

1. **Intent-First**: Never execute tools without understanding user intent
2. **Tool-Driven**: All state changes happen through tools, not direct API calls
3. **Safety-Conscious**: Tool selection respects security hierarchy
4. **Context-Aware**: AI receives app state (current page, focused block, selections)
5. **Streaming-First**: Response UI handles real-time updates
6. **No Templates**: All responses come from the AI orchestrator, never hardcoded

---

## Intent-First Routing Philosophy

### Core Concept

The Copilot **classifies user intent before deciding what to do**, rather than simply routing all inputs to the AI. This enables:
- **Appropriate tool selection** for the task type
- **User expectation alignment** (don't create when user just asked a question)
- **Security enforcement** (restrict tools based on intent)

### Four Intent Categories

| Intent | User Signal | AI Response | Tools Provided |
|--------|------------|-------------|-----------------|
| **CONVERSATIONAL** | "thanks", "cool", "hi", "good point" | Respond naturally with AI | ALL (full context) |
| **INFORMATION_REQUEST** | "what", "where", "list", "show", "find" | Provide information with read-only tools | `list_pages`, `get_block`, `query_blocks` |
| **CONTENT_CREATION** | "create", "write", "generate", "plan" | Create blocks/pages | All EXCEPT `delete_*` |
| **CONTENT_MODIFICATION** | "edit", "update", "delete", "reorganize" | Full modification | ALL tools |

### Implementation

**File**: `src/services/ai/utils/intentClassifier.ts` (207 lines)

The classifier uses pattern matching on keywords to determine user intent with a confidence score (0-1).

---

## Core Architecture

### 1. Agent Orchestrator (`src/services/ai/agent/orchestrator.ts`)

**Responsibility**: Main execution loop implementing ReAct (Reasoning + Acting) pattern:
1. Sends goal to LLM with available tools
2. Receives streaming responses
3. Parses tool calls from LLM output
4. Executes tools via registry
5. Feeds observations back to LLM
6. Yields step-by-step progress to UI

**Key Implementation Details**:
- **Class**: `AgentOrchestrator` (implements `IAgentOrchestrator`)
- **State Management**: `AgentState` tracks execution ID, goal, status, steps, iterations
- **Loop Control**: `shouldStop` flag prevents infinite loops; configurable `maxIterations` (default: 50)
- **Streaming**: Uses `async*` generator to yield steps in real-time
- **Tool History**: `ToolCallHistory` tracks all tool calls to prevent duplicate execution
- **Task Tracking**: `taskProgress` records created resources (pages, blocks) and completed steps

**Execution Loop**:
```
┌─────────────────┐
│ 1. Thought      │ AI reasons about the task
└────────┬────────┘
         ↓
┌─────────────────┐
│ 2. Tool Call    │ AI decides which tool to use
└────────┬────────┘
         ↓
┌─────────────────┐
│ 3. Observation  │ Tool executes, returns result
└────────┬────────┘
         ↓
     More steps?
      /        \
    YES        NO
    /           \
 Loop       Final Answer
```

**Error Recovery Flow**:
- Classifies error type using `classifyError()`
- Evaluates recoverability with `isRecoverable()`
- Retrieves guidance via `getRecoveryGuidance()`
- Informs LLM of error and retries intelligently
- Graceful degradation if unrecoverable

### 2. Intent Classifier (`src/services/ai/utils/intentClassifier.ts`)

**Function**: `classifyIntent(input: string) → ClassificationResult`

**Returns**:
```typescript
{
  intent: "CONVERSATIONAL" | "INFORMATION_REQUEST" | "CONTENT_CREATION" | "CONTENT_MODIFICATION",
  confidence: 0.0 - 1.0,
  reasoning: string
}
```

**Classification Logic**:
- **Pattern Matching**: Uses regex patterns ordered by specificity
- **Priority Order**: Modification > Creation > Information > Conversational
- **Confidence Scoring**: Based on pattern match quality and context
- **Multi-language**: Supports English, Korean, Chinese patterns

**Intent Categories & Patterns**:

| Intent | Priority | Trigger Patterns | Confidence |
|--------|----------|------------------|-----------|
| **CONTENT_MODIFICATION** | 1 (highest) | `delete`, `remove`, `edit`, `update`, `move`, `merge` | 0.95 |
| **CONTENT_CREATION** | 2 | `create`, `write`, `generate`, `plan`, `new [page/block]` | 0.9 |
| **INFORMATION_REQUEST** | 3 | `what`, `where`, `list`, `show`, `find`, `get` | 0.85 |
| **CONVERSATIONAL** | 4 (fallback) | `thanks`, `hi`, `cool`, `how are you` | 0.7 |

**Example Classifications**:
- "Create a new outline for chapter 3" → CONTENT_CREATION (0.92)
- "What pages do I have?" → INFORMATION_REQUEST (0.88)
- "Update the intro section" → CONTENT_MODIFICATION (0.96)
- "Thanks for the help" → CONVERSATIONAL (0.75)

### 3. Tool Selector (`src/services/ai/utils/toolSelector.ts`)

**Function**: `selectToolsByIntent(intent: IntentType) → Tool[]`

**Security Hierarchy**:
```
CONVERSATIONAL: All tools available
                ↓
INFORMATION_REQUEST: Read-only tools only (list, get, query)
                ↓
CONTENT_CREATION: All except delete tools
                ↓
CONTENT_MODIFICATION: All tools (full access)
```

---

## Agent Orchestration

### Complete Execution Flow

```
START
  ↓
Classify Intent
  ↓
Select Tools for Intent
  ↓
Initialize Orchestrator Context
  (current page, focused block, selections)
  ↓
FOR EACH iteration:
  ├─ Yield THOUGHT: AI reasons about goal
  ├─ Parse tool call from LLM
  ├─ Yield TOOL_CALL: Tool name + parameters
  ├─ Execute tool via registry
  ├─ Capture result or error
  ├─ Yield OBSERVATION: Result formatted for LLM
  └─ Feed back to LLM (loop until done)
  ↓
Yield FINAL_ANSWER: AI's response to user
  ↓
END
```

### Orchestrator State Machine (Mermaid)

```mermaid
stateDiagram-v2
  [*] --> Idle: Initialize
  
  Idle --> Thinking: execute(goal)
  
  Thinking --> ToolCall: Parse LLM response
  ToolCall --> Executing: Tool selected
  
  Executing --> Observing: Tool completed
  Observing --> Thinking: Feed back to LLM
  
  Thinking --> Final: No more tools needed
  
  Executing --> ErrorRecovery: Tool failed
  ErrorRecovery --> Executing: Retry
  ErrorRecovery --> Final: Unrecoverable error
  
  Final --> Completed: Yield answer
  Completed --> Idle: Cleanup
  
  Executing --> Stopped: maxIterations reached
  Thinking --> Stopped: User cancels
  Stopped --> Idle: Cleanup
```

### Intent Classification Decision Tree (Mermaid)

```mermaid
graph TD
  A["User Input"] -->|Scan for patterns| B{Priority Order}
  
  B -->|"delete/remove/edit"| C["CONTENT_MODIFICATION"]
  C -->|0.95 confidence| D["Full tool access"]
  
  B -->|"create/write/generate"| E["CONTENT_CREATION"]
  E -->|0.90 confidence| F["All except delete"]
  
  B -->|"what/where/list/find"| G["INFORMATION_REQUEST"]
  G -->|0.85 confidence| H["Read-only tools"]
  
  B -->|"thanks/hi/cool"| I["CONVERSATIONAL"]
  I -->|0.70 confidence| J["All tools available"]
  
  D --> K["Select Tools"]
  F --> K
  H --> K
  J --> K
  K --> L["Orchestrator Execute"]
```

### Tool Selection Hierarchy (Mermaid)

```mermaid
graph TD
  A["Intent Classified"] --> B{Intent Type?}
  
  B -->|CONVERSATIONAL| C["All 25 Tools"]
  B -->|INFORMATION_REQUEST| D["Read-Only Tools Only"]
  B -->|CONTENT_CREATION| E["All except Delete"]
  B -->|CONTENT_MODIFICATION| F["All Tools"]
  
  C --> G{Tool Approval?}
  D --> G
  E --> G
  F --> G
  
  G -->|Approval required| H["Show Modal"]
  G -->|No approval| I["Direct Execution"]
  
  H --> J{User Approves?}
  J -->|Yes| I
  J -->|No| K["Inform LLM - tool rejected"]
  
  I --> L["Execute via Registry"]
  K --> L
  L --> M["Tool Result to Orchestrator"]
```

### State Management

**Orchestrator State**:
```typescript
{
  status: "idle" | "running" | "completed" | "failed",
  currentStep: StepType | null,
  toolCalls: ToolCall[],
  observations: Observation[],
  error: string | null,
  iterations: number
}
```

### Error Recovery (`src/services/ai/agent/errorRecovery.ts`)

**Strategies**:
1. **Retry Logic**: Failed tool calls can be retried
2. **Graceful Degradation**: Continue with partial results
3. **User Notification**: Report errors to chat UI
4. **Fallback**: Suggest alternative approaches

---

## Tool System

### Overview

**Total Tools**: 25 tools organized into **6 categories**:

| Category | Purpose | Count | Read-Only | Examples |
|----------|---------|-------|-----------|----------|
| **Block Tools** | Manipulate content blocks | 8 | No | create, update, delete, query |
| **Page Tools** | Manage pages/files | 5 | Mixed | create, list, query, open |
| **Context Tools** | Query current state | 2 | Yes | get_current_context |
| **Navigation Tools** | Navigate workspace | 3 | Yes | navigate_*, get_breadcrumb |
| **Filesystem Tools** | Direct file operations | 4 | Mixed | read_file, write_file |
| **Test Tools** | Testing & validation | 3 | No | validate_*, test_* |

### Tool Registry (`src/services/ai/tools/registry.ts`)

**Central registry** for all available tools:

```typescript
toolRegistry.register(tool)        // Register single tool
toolRegistry.registerMany([...])   // Batch register
toolRegistry.get(name)             // Get tool by name
toolRegistry.getAll()              // Get all tools
toolRegistry.has(name)             // Check existence
```

**Registry Features**:
- Type-safe tool definitions via Zod schemas
- Validation before execution
- Approval mechanism for dangerous operations
- Error handling with recovery guidance

### Tool Categories in Detail

#### Block Tools (8 tools)

**Core Operations**:
- `create_block`: Create single block with content
- `create_blocks_from_markdown`: Batch create from indented markdown
- `update_block`: Modify block content  
- `delete_block`: Remove block
- `get_block`: Fetch block details
- `query_blocks`: Search blocks by content
- `append_to_block`: Add children to block
- `insert_block_below`: Insert sibling below

**Important Patterns**:
- Always validate markdown structure before batch creation
- Use `create_blocks_from_markdown` for efficiency (single call vs multiple)
- Provide context (page ID, parent block) for accurate insertion

#### Page Tools (5 tools)

**Operations**:
- `create_page`: Create page with title
- `create_page_with_blocks`: Atomic page + blocks creation (recommended)
- `list_pages`: List all pages in workspace
- `query_pages`: Search pages by name/content
- `open_page`: Navigate to page (view state)

**Best Practices**:
- Use `create_page_with_blocks` for new document outlines (atomic operation)
- Batch queries when searching multiple pages
- Always handle page not found gracefully

#### Context Tools (2 tools)

**Operations**:
- `get_current_context`: Returns { currentPage, focusedBlock, selections }
- Provides essential awareness for AI decision-making

**Usage**:
- Call at start of session to understand user's position
- Use to provide contextual suggestions
- Reference for relative operations ("add below current block")

#### Navigation Tools (3 tools)

- Navigate folder structure
- Get breadcrumb trail  
- Query workspace hierarchy

#### Filesystem Tools (4 tools)

- Direct file read/write
- Directory operations
- Path resolution

#### Test Tools (3 tools)

- Validation utilities
- Structure checking
- Example generation

### Tool Safety

**Approval Mechanism**:
- Tools with `requiresApproval: true` need confirmation
- Modal displays before execution
- Sensitive operations get extra review

**Danger Levels**:
- 🔴 High: `delete_*` tools (irreversible)
- 🟡 Medium: Batch operations, filesystem writes
- 🟢 Safe: Read-only tools (no approval needed)

---

## PLACEHOLDER: Complete Tool Inventory

> **Status**: Awaiting detailed audit from sisyphus-junior (bg_752c6ce2)
> 
> **Coming Soon**: Comprehensive table including:
> - All 25 tools with descriptions
> - Input parameters and types
> - Return value specifications
> - Safety levels and approval requirements
> - Performance characteristics
> - Common usage patterns
> - Tool interdependencies
> - Usage examples for each tool

---

## Provider Layer

### Supported Providers

```
┌─────────────────────────────────────┐
│     AI Provider Interface            │
└──────────────┬──────────────────────┘
               ↓
    ┌──────────────────────┐
    │ Provider Factory     │
    │ createAIProvider()   │
    └──────────┬───────────┘
               ↓
    ┌──────────────────────────────────┐
    │ Concrete Implementations         │
    ├──────────────────────────────────┤
    │ • OpenAIProvider (ChatGPT, GPT-4)│
    │ • ClaudeProvider (Anthropic)     │
    │ • OllamaProvider (Local)         │
    │ • LMStudioProvider (Local)       │
    │ • GoogleProvider                 │
    │ • CustomProvider                 │
    │ • ZaiProvider                    │
    └──────────────────────────────────┘
```

### Configuration Flow

1. **User selects** provider in settings
2. **Store** saves selection (aiSettingsStore)
3. **CopilotPanel** loads from store
4. **createAIProvider** instantiates provider
5. **Orchestrator** uses for LLM calls

### Provider-Specific Notes

- **OpenAI**: GPT-3.5-turbo, GPT-4 (requires API key)
- **Claude**: Supports Claude 3 series (requires API key)
- **Ollama**: Local models, no API key needed
- **LM Studio**: Local inference server
- **Google**: Bard/Gemini (requires API key)
- **Custom**: Self-hosted endpoints
- **Zai**: Enterprise integration

---

## UI/UX Architecture

### Main Component: CopilotPanel

**File**: `src/components/copilot/CopilotPanel.tsx` (961 lines)

**Key Features**:
1. **Chat Interface**: User/assistant messages with markdown rendering
2. **Input Handling**: Textarea with @mention autocomplete
3. **Streaming Display**: Real-time step updates (thinking → executing → done)
4. **Model Selector**: Switch providers/models dynamically
5. **Stop Button**: Cancel running operations
6. **Loading Indicator**: Visual feedback during processing

### State Management (Zustand)

**Store**: `useCopilotUiStore`

**Key State**:
```typescript
{
  isOpen: boolean,              // Panel visibility
  inputValue: string,           // User input
  isLoading: boolean,           // Processing
  chatMessages: ChatMessage[],  // Conversation
  currentStep: StepType | null, // Current ReAct step
  currentToolName: string | null, // Executing tool
  panelWidth: number,           // Panel size
  pageContext: {                // Current page info
    pageId: string,
    title: string
  }
}
```

**Actions**:
```typescript
setInputValue(text)             // Update input
addChatMessage(role, content)   // Add to chat
setIsLoading(bool)              // Toggle loading
clearChatMessages()             // Clear history
updatePageContext(id, title)    // Update context
```

### User Interaction Flow

```
1. Open: Cmd+Shift+K
2. Type: User enters request
3. Send: Press Enter
4. Process:
   a. Classify intent
   b. Select tools
   c. Create orchestrator
   d. Subscribe to execution steps:
      - Thought → Show "분석 중..."
      - Tool Call → Show "도구 실행 중..."
      - Observation → Show "결과 처리 중..."
      - Final Answer → Display response
5. Approve: If modal shows, user confirms
6. Continue: User asks follow-up or closes panel
```

### Component Hierarchy

```
CopilotPanel
├── Header (Title, Clear, Close)
├── ScrollArea (Chat Messages)
│   └── ChatMessage[] (User/Assistant bubbles)
├── Progress Indicator (Loading state)
└── Footer
    ├── Textarea (Input)
    ├── MentionAutocomplete (Dropdown)
    ├── ToolApprovalModal (If needed)
    └── Controls (Model Selector, Send/Stop)
```

### Mention System (@mentions)

**Feature**: Reference pages/blocks with @

**Implementation**:
1. User types `@` in input
2. `MentionAutocomplete` shows suggestions
3. Select suggestion → inserts `@PageName` or `@:BlockID`
4. Text parsed and context passed to orchestrator
5. AI receives: block content, page title, etc.

---

## Block Structure Semantics

### The Problem

AI was creating overly-nested structures when it should create siblings:

```markdown
❌ WRONG (what AI was doing):
- 드라마
  - 로맨스
    - 미스터리
      - SF

✅ CORRECT (what it should do):
- 드라마
- 로맨스
- 미스터리
- SF
```

### Root Cause Analysis

**AI Knew**:
- ✅ "2 spaces = child, same spaces = sibling" (mechanics)
- ✅ "Don't use staircase pattern" (anti-pattern)
- ✅ Examples of correct siblings (documentation)

**AI Didn't Understand**:
- ❌ **WHEN** to use siblings (semantics)
- ❌ WHY genres should be parallel
- ❌ Decision framework for structure choice

### Solution: Semantic Guidance

**Added to system prompt** (`src/services/ai/agent/system-prompt.md`, lines 342-436):

### Decision Framework (3 Questions)

Before creating block structure, ask:

**Q1: Are these items PARALLEL/EQUAL?**
- Examples: Genres, categories, options, meeting attendees
- Examples: Project goals, checklist items
- If YES → Use **SIBLINGS** (same indentation)

**Q2: Are these items PARTS OF A PARENT?**
- Examples: Tasks inside phases, chapters inside book
- Examples: Symptoms inside disease, sub-sections
- If YES → Use **CHILDREN** (deeper indentation)

**Q3: Are these items SEQUENTIAL/ORDERED?**
- Examples: Steps in process, timeline events
- Examples: Numbered instructions, ordered pipeline
- If YES → Use **SIBLINGS** (never as staircase!)

### Semantic Patterns

**Pattern 1: Genres (Parallel Categories)**
```markdown
✅ CORRECT:
- 드라마
- 로맨스
- 미스터리
- SF
- 판타지
- 기타

Why: All equal, parallel categories. Reorderable.
```

**Pattern 2: Meeting Notes (Mixed)**
```markdown
✅ CORRECT:
- Attendees
  - Alice
  - Bob
  - Carol
- Agenda Items
  - 예산 검토
  - 타임라인 논의

Why: Top-level sections are siblings.
      Names/items inside are children.
```

**Pattern 3: Project Breakdown (Hierarchical)**
```markdown
✅ CORRECT:
- Project
  - Phase 1
    - Task 1.1
    - Task 1.2
  - Phase 2
    - Task 2.1

Why: Tasks are PARTS OF phases.
     Phases are PARTS OF project.
     True decomposition.
```

**Pattern 4: To-Do List (Parallel)**
```markdown
✅ CORRECT:
- Task 1: Review proposal
- Task 2: Update documentation
- Task 3: Run tests

Why: Tasks are equal, reorderable.
     No hierarchy intended.
```

### Validation Checklist

**Before creating blocks, verify**:
- [ ] Could I reorder these items without breaking meaning?
  - YES → Siblings
  - NO → Check if hierarchical
- [ ] Does "A contains B" make semantic sense?
  - YES → Children
  - NO → Siblings
- [ ] Are items at same level of importance?
  - YES → Siblings
  - NO → Children
- **DEFAULT**: When unsure, use SIBLINGS

---

## Implementation Details

### Recent Changes (This Session)

**1. Intent-First Routing System**
- `intentClassifier.ts` (207 lines) - NEW
- `toolSelector.ts` (177 lines) - NEW
- Integration tests (66 tests) - NEW

**2. Hardcoded Template Removal**
- `CopilotPanel.tsx` (-72 lines)
  - Removed `generateConversationalResponse()`
  - Removed special-case handling
  - Always call orchestrator

**3. Semantic Guidance Addition**
- `system-prompt.md` (+118 lines)
  - Decision framework
  - Real-world examples
  - Validation checklist

**4. Testing**
- All 66 tests passing ✅
- TypeScript strict mode clean ✅
- Build succeeds ✅

### Files Modified

| File | Type | Change |
|------|------|--------|
| `src/services/ai/utils/intentClassifier.ts` | NEW | Intent classification system |
| `src/services/ai/utils/__tests__/intentClassifier.test.ts` | NEW | 32 tests |
| `src/services/ai/utils/toolSelector.ts` | NEW | Tool selection by intent |
| `src/services/ai/utils/__tests__/toolSelector.test.ts` | NEW | 17 tests |
| `src/components/copilot/CopilotPanel.tsx` | MODIFIED | -72 lines (removed templates) |
| `src/components/copilot/__tests__/intentFirstRouting.integration.test.ts` | NEW | 17 integration tests |
| `src/services/ai/agent/system-prompt.md` | MODIFIED | +118 lines (semantic guidance) |

### Commits

```
a62065e docs(copilot): add semantic block relationship guidance to system prompt
531abb9 fix(copilot): remove hardcoded template responses, always call AI orchestrator
6866589 feat(copilot): implement intent-first philosophy with flexible tool usage
c3263df refactor(copilot): implement intent-first routing with selective tool usage
```

---

## Wave 1 Audit Results (In Progress)

> **Status**: Real-time audit in progress via sisyphus-junior agents
> - Agent bg_0e58c9dc: Core Logic Audit (orchestrator, intentClassifier, toolSelector)
> - Agent bg_752c6ce2: Tool Ecosystem Audit (tool registry, all 25 tools)
> - Agent bg_9d4a2563: UI/Provider Audit (COMPLETE ✅)

### Core Logic Audit Findings (bg_0e58c9dc)

**IN PROGRESS** - Detailed analysis of:

1. **Orchestrator Architecture**
   - ReAct pattern implementation (Thought → Tool Call → Observation loop)
   - Async generator streaming mechanism
   - State management and iteration control
   - Error recovery and graceful degradation
   - Tool call history to prevent infinite loops
   - Task progress tracking for user feedback

2. **Intent Classification System**
   - Regex-based pattern matching with confidence scoring
   - Priority-ordered intent detection (modification > creation > information > conversational)
   - Multi-language support (English, Korean, Chinese)
   - Edge case handling and confidence thresholds
   - Examples and counterexamples for each intent

3. **Tool Selection Logic**
   - Intent → Tool mapping hierarchy
   - Safety restrictions per intent level
   - Tool availability constraints
   - Approval mechanism for dangerous operations
   - Fallback strategies when tools unavailable

**Expected Output**: Detailed flow diagrams, code references, performance characteristics, and recommendations for optimization.

### Tool Ecosystem Audit Findings (bg_752c6ce2)

**IN PROGRESS** - Comprehensive analysis of:

1. **Tool Registry System**
   - Central registration mechanism
   - Zod-based validation
   - Tool discovery and retrieval
   - Type safety enforcement
   - Scalability assessment

2. **Complete Tool Inventory** (25 tools across 6 categories)
   - Block Tools (8): create, update, delete, query, append, insert
   - Page Tools (5): create, list, query, open, navigate
   - Context Tools (2): get current state, user position awareness
   - Navigation Tools (3): workspace navigation, breadcrumbs, hierarchy
   - Filesystem Tools (4): read, write, directory ops, path resolution
   - Test Tools (3): validation, structure checking, examples

3. **Tool Interdependencies & Patterns**
   - Which tools work together
   - Common execution chains
   - Performance implications of tool combinations
   - Batching opportunities for efficiency

4. **Safety & Approval Mechanisms**
   - Approval matrix (which tools require confirmation)
   - Danger levels and risk mitigation
   - Error handling per tool
   - Recovery guidance for failures

**Expected Output**: Complete tool inventory table, dependency map, usage patterns, and scalability recommendations.

### UI/Provider Audit Findings (bg_9d4a2563) ✅

**COMPLETE** - Key findings:

1. **React Integration**
   - CopilotPanel component structure (961 lines)
   - Message handling and streaming
   - Error presentation to user
   - Loading states and visual feedback

2. **State Management**
   - Zustand stores (copilotUiStore, aiSettingsStore, toolApprovalStore)
   - Store interactions and data flow
   - Persistence mechanisms
   - Real-time updates

3. **Provider Layer**
   - OpenAI, Claude, Ollama, LMStudio, Google implementations
   - Provider factory and configuration
   - Settings UI integration
   - Fallback and error handling

---

## Audit Findings & Future Work

### Current Strengths ✅

1. **Clean Architecture**
   - Clear separation: Intent → Tools → Orchestration
   - Single responsibility per module
   - Easy to understand data flow

2. **Extensible Tool System**
   - Registry pattern allows unlimited tools
   - Well-defined Tool interface
   - Batch operations reduce API calls

3. **Safety-First Design**
   - Intent-based tool restrictions
   - Approval modal for sensitive operations
   - Error recovery mechanisms

4. **Provider-Agnostic**
   - Easy to add new LLM backends
   - Settings-driven configuration
   - Fallback strategies

5. **Semantic Teaching (New)**
   - Not rule-based restrictions
   - AI learns conceptual understanding
   - Scalable to new patterns

### Areas for Improvement 🔧

1. **Performance Optimization**
   - [ ] Cache page list queries
   - [ ] Memoize expensive computations
   - [ ] Debounce rapid tool calls

2. **Enhanced Error Messages**
   - [ ] More context in tool failures
   - [ ] Suggestions for fixing errors
   - [ ] Better LLM instruction on errors

3. **Korean Language Support**
   - [ ] Expand Korean keywords in intent classifier
   - [ ] More Korean examples in system prompt
   - [ ] Korean-first design for text matching

4. **Testing Coverage**
   - [ ] Edge case tests for orchestrator
   - [ ] Provider implementation tests
   - [ ] Real LLM integration tests

5. **User Experience**
   - [ ] Modal progress visualization
   - [ ] Tool usage analytics
   - [ ] Better error presentation
   - [ ] Response caching for repeated queries

6. **Documentation**
   - [ ] "How to add a new tool" guide
   - [ ] "How to add a new provider" guide
   - [ ] Troubleshooting section
   - [ ] Architecture diagrams (Mermaid)

### Recommended Next Steps

**Immediate (This Sprint)**
- [ ] Test semantic guidance with real user interactions
- [ ] Monitor for overly-nested structures
- [ ] Gather user feedback on intent classification

**Short Term (1-2 Weeks)**
- [ ] Improve Korean keyword matching
- [ ] Add more comprehensive error messages
- [ ] Performance optimization (caching)

**Medium Term (1 Month)**
- [ ] Expand tool coverage (40 → 60+ tools)
- [ ] Add provider benchmarking/comparison
- [ ] Expand test suite to 100+ tests

**Long Term (Roadmap)**
- [ ] Multi-step goal planning (decomposition)
- [ ] Tool composition (chain tools intelligently)
- [ ] Learning from user feedback
- [ ] Plugin system for third-party tools

---

## Quick Reference

### Adding a New Intent

1. Add pattern to `intentClassifier.ts`
2. Add keyword examples
3. Add test case
4. Update tool selector if needed
5. Update system prompt

### Adding a New Tool

1. Create file in `src/services/ai/tools/{category}/`
2. Implement `Tool` interface
3. Register in tool initialization
4. Add to system prompt tool list
5. Write tests
6. Document in tool guide

### Adding a New Provider

1. Create file in `src/services/ai/providers/`
2. Implement `AIProvider` interface
3. Add to provider factory
4. Add settings UI
5. Test with sample prompts
6. Document configuration

---

## Glossary

| Term | Definition |
|------|-----------|
| **Intent** | Classification of user goal (conversational, info, creation, modification) |
| **Tool** | Function AI can call (create, update, query, delete) |
| **Orchestrator** | Main loop executing ReAct pattern |
| **Provider** | LLM backend (OpenAI, Claude, Ollama, etc.) |
| **Step** | Single iteration (thought, tool_call, observation, final_answer) |
| **Semantic** | Meaning-based (vs mechanical rules) |
| **Block** | Smallest editable unit (like bullet point) |
| **Page** | Collection of blocks (like markdown file) |
| **Context** | Current app state (page, focused block, selections) |

---

## References

### Core Files
- System Prompt: `src/services/ai/agent/system-prompt.md`
- Orchestrator: `src/services/ai/agent/orchestrator.ts`
- Intent Classifier: `src/services/ai/utils/intentClassifier.ts`
- Tool Selector: `src/services/ai/utils/toolSelector.ts`
- Main UI: `src/components/copilot/CopilotPanel.tsx`

### Tool System
- Tool Registry: `src/services/ai/tools/registry.ts`
- Block Tools: `src/services/ai/tools/block/`
- Page Tools: `src/services/ai/tools/page/`
- Context Tools: `src/services/ai/tools/context/`

### State Management
- Copilot UI Store: `src/stores/copilotUiStore.ts`
- AI Settings Store: `src/stores/aiSettingsStore.ts`
- Tool Approval Store: `src/stores/toolApprovalStore.ts`

### Tests
- Intent Tests: `src/services/ai/utils/__tests__/intentClassifier.test.ts`
- Tool Selector Tests: `src/services/ai/utils/__tests__/toolSelector.test.ts`
- Integration Tests: `src/components/copilot/__tests__/intentFirstRouting.integration.test.ts`

---

## Version History

| Date | Version | Status | Changes |
|------|---------|--------|---------|
| 2026-02-08 | 0.2 | Complete | Wave 1 audit + comprehensive documentation |
| 2026-02-08 | 0.1 | Initial | Foundation documentation |

---

**Document Maintained By**: Oxinot Development Team  
**Last Reviewed**: 2026-02-08  
**Next Review**: 2026-02-15

---

> **NOTE**: This documentation reflects the Copilot system as of February 8, 2026.
> For the latest changes, refer to git history: `git log --oneline -- src/services/ai/`
