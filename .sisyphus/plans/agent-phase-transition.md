# Agent Phase Transition: Execution → Response

## TL;DR

> **Quick Summary**: Refactor the single-agent AI orchestrator to implement a clear "Execution Phase → Response Phase" transition, removing all hardcoded task progress tracking and adding real-time UI feedback during tool execution. The AI decides when it's done with tools; the system enforces response-only mode by passing `tools: undefined`.
>
> **Deliverables**:
> - Orchestrator with automatic phase transition (tools removed after execution completes)
> - No hardcoded `taskProgress` or pattern-matching logic
> - Real-time tool execution feedback in floating panel UI (tool names, status)
> - Updated system prompt with phase documentation
> - Full backward compatibility with `threadBlockService.ts`
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves + final verification
> **Critical Path**: Task 1 (types) → Task 2 (orchestrator) → Task 4 (UI) → Final Verification

---

## Context

### Original Request
User wants "노션AI 정도의 퀄리티있는 에이전트" (Notion AI quality agent). The current orchestrator has 3 problems:
1. `taskProgress` tracking is hardcoded — only works for `create_page → validate_markdown_structure → create_blocks_from_markdown` flow
2. No mechanism to prevent AI from re-calling tools after being asked to generate a final explanation
3. No UI feedback during tool execution — just shows "Thinking..."

### Interview Summary
**Key Discussions**:
- Architecture: Single agent + phase transition (not orchestrator-worker separation)
- `tools: undefined` approach verified safe across all 4 providers (OpenAI, Claude, Google, Ollama)
- OpenAI quirk: `tools: []` is truthy, sends `tool_choice: "auto"` — must normalize to `undefined`
- Claude/Google: `role: "system"` in mid-conversation messages is unsafe — use `role: "user"` for transition
- `threadBlockService.ts` backward compatibility is mandatory
- User constraint: "하드코딩 절대 금지, 패턴매칭 절대 금지. 오케스트레이터가 말해야지"

**Research Findings**:
- All 4 provider implementations fully analyzed with exact line numbers
- `taskProgress` exists only in 3 files: `types.ts`, `orchestrator.ts`, `agentStore.ts`
- `threadBlockService.ts` only consumes `final_answer` steps — internal orchestrator changes are backward compatible
- `agentStore.ts` has `addStep`/`updateStep` but is NOT wired to orchestrator — currently unused
- `getProgressSummary()` only used for budget-exhaustion fallback message

### Metis Review
**Identified Gaps** (addressed):
- OpenAI `tools: []` truthy issue → Normalize to `undefined` in orchestrator before passing to provider
- System prompt still references `taskProgress` in `buildSystemPrompt()` lines 510-520 → Remove entirely
- Text + tools coexistence in same response → Prioritize tools (existing behavior), text saved for potential final answer
- Phase transition message wording → Reuse existing line 276-277 pattern with minor improvement

---

## Work Objectives

### Core Objective
Replace hardcoded `taskProgress` state machine with an automatic, AI-driven "Execution Phase → Response Phase" transition that works for ANY tool combination, not just page creation.

### Concrete Deliverables
- Modified `src/services/ai/agent/types.ts` — new `executionPhase` field, removed `TaskProgress`
- Refactored `src/services/ai/agent/orchestrator.ts` — phase transition logic, no hardcoding
- Updated `src/services/ai/agent/system-prompt.md` — phase documentation
- Enhanced `src/components/ThreadFloatingPanel.tsx` — real-time tool execution feedback
- Updated `src/stores/agentStore.ts` — aligned with new types

### Definition of Done
- [ ] `npm run build` passes with zero errors
- [ ] `npm run lint` passes with zero errors
- [ ] No references to `TaskProgress` or `taskProgress` remain in codebase
- [ ] No hardcoded tool name checks (e.g., `includes("create_page")`) remain in orchestrator
- [ ] AI can complete ANY tool sequence and provide a natural-language summary
- [ ] Floating panel shows tool names during execution (not just "Thinking...")
- [ ] `threadBlockService.ts` works unchanged (no modifications needed)

### Must Have
- Phase transition: When AI returns text-only after having called tools, orchestrator transitions to Response Phase
- Response Phase enforcement: AI physically cannot call tools (tools parameter is `undefined`)
- Tool normalization: `tools: []` always normalized to `undefined` before provider call
- Phase transition message uses `role: "user"` (not `role: "system"`) for Claude/Google compatibility
- Real-time tool feedback in UI during execution

### Must NOT Have (Guardrails)
- NO hardcoded tool name checks (no `toolName.includes("create_page")` patterns)
- NO `TaskProgress` type or any phase state machine with named workflow phases
- NO pattern matching on tool results to determine completion
- NO changes to `AgentStep` interface (backward compatibility)
- NO changes to `threadBlockService.ts` (must work unchanged)
- NO changes to any AI provider files
- NO `role: "system"` messages pushed into conversation history mid-execution
- NO empty catch blocks or suppressed errors
- NO `as any` or `@ts-ignore`

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (Vitest configured)
- **Automated tests**: Tests-after (add test for phase transition logic after implementation)
- **Framework**: Vitest (`npx vitest run`)

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Build verification**: `npm run build` and `npm run lint`
- **Type checking**: `npx tsc --noEmit`
- **Unit tests**: `npx vitest run` for any new test files
- **UI verification**: Playwright for floating panel interaction (tool feedback display)

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — types + system prompt, independent):
├── Task 1: Update types.ts — Remove TaskProgress, add executionPhase [quick]
├── Task 3: Update system-prompt.md — Add phase documentation [quick]
└── Task 5: Update agentStore.ts — Align initialState with new types [quick]

Wave 2 (After Wave 1 — depends on new types):
├── Task 2: Refactor orchestrator.ts — Phase transition logic [deep]
└── Task 4: Enhance ThreadFloatingPanel.tsx — Tool execution UI feedback [visual-engineering]

Wave 3 (After Wave 2 — integration test):
└── Task 6: Integration test — Write Vitest tests for phase transition [unspecified-high]

Wave FINAL (After ALL tasks — independent review, parallel):
├── Task F1: Plan compliance audit [oracle]
├── Task F2: Code quality review [unspecified-high]
├── Task F3: Real manual QA — Playwright [unspecified-high]
└── Task F4: Scope fidelity check [deep]

Critical Path: Task 1 → Task 2 → Task 4 → Task 6 → F1-F4
Parallel Speedup: ~40% faster than sequential
Max Concurrent: 3 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 2, 5 | 1 |
| 3 | — | 2 | 1 |
| 5 | 1 | — | 1 |
| 2 | 1, 3 | 4, 6 | 2 |
| 4 | 2 | 6 | 2 |
| 6 | 2, 4 | F1-F4 | 3 |
| F1-F4 | 6 | — | FINAL |

### Agent Dispatch Summary

- **Wave 1**: 3 tasks — T1 → `quick`, T3 → `quick`, T5 → `quick`
- **Wave 2**: 2 tasks — T2 → `deep`, T4 → `visual-engineering`
- **Wave 3**: 1 task — T6 → `unspecified-high`
- **FINAL**: 4 tasks — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [ ] 1. Update `types.ts` — Remove TaskProgress, add executionPhase

  **What to do**:
  - Delete the entire `TaskProgress` interface (lines 65-86)
  - Remove `taskProgress: TaskProgress;` field from `AgentState` interface (line 59)
  - Add new fields to `AgentState`:
    ```typescript
    /** Current execution phase */
    executionPhase: "execution" | "response";
    /** Number of tool calls made in this execution */
    toolCallsMade: number;
    ```
  - Ensure all exports remain intact — `AgentState`, `AgentStep`, `AgentConfig`, `IAgentOrchestrator`, `AgentEvent` types must all still be exported

  **Must NOT do**:
  - Do NOT modify `AgentStep` interface (backward compatibility with threadBlockService)
  - Do NOT modify `AgentConfig` interface
  - Do NOT modify `IAgentOrchestrator` interface
  - Do NOT add any `import` statements

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple type deletion and field addition in a single file
  - **Skills**: []
    - No special skills needed for type changes
  - **Skills Evaluated but Omitted**:
    - `playwright`: No UI interaction needed
    - `git-master`: Not a git operation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 3, 5)
  - **Blocks**: Tasks 2, 5
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/services/ai/agent/types.ts:36-60` — Current `AgentState` interface — remove `taskProgress` field at line 59, add `executionPhase` and `toolCallsMade`
  - `src/services/ai/agent/types.ts:65-86` — Current `TaskProgress` interface — DELETE entirely

  **API/Type References**:
  - `src/services/ai/agent/types.ts:7-31` — `AgentStep` interface — DO NOT MODIFY (reference only to understand what stays)

  **WHY Each Reference Matters**:
  - `AgentState` is the main type to modify — executor needs to see exactly what fields exist and what to change
  - `TaskProgress` is what to delete — executor needs exact line range
  - `AgentStep` is listed to explicitly show it must NOT be touched

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: TaskProgress type fully removed
    Tool: Bash (grep)
    Preconditions: Task 1 changes applied to types.ts
    Steps:
      1. Run: grep -n "TaskProgress" src/services/ai/agent/types.ts
      2. Assert: command returns empty (exit code 1, no matches)
      3. Run: grep -n "taskProgress" src/services/ai/agent/types.ts
      4. Assert: command returns empty (exit code 1, no matches)
    Expected Result: Zero occurrences of TaskProgress or taskProgress in types.ts
    Failure Indicators: Any line containing TaskProgress or taskProgress
    Evidence: .sisyphus/evidence/task-1-taskprogress-removed.txt

  Scenario: New fields present in AgentState
    Tool: Bash (grep)
    Preconditions: Task 1 changes applied
    Steps:
      1. Run: grep -n "executionPhase" src/services/ai/agent/types.ts
      2. Assert: returns at least 1 match showing the field definition
      3. Run: grep -n "toolCallsMade" src/services/ai/agent/types.ts
      4. Assert: returns at least 1 match showing the field definition
    Expected Result: Both executionPhase and toolCallsMade fields exist in types.ts
    Failure Indicators: Either field missing
    Evidence: .sisyphus/evidence/task-1-new-fields-present.txt

  Scenario: Type checking passes
    Tool: Bash
    Preconditions: Task 1 changes applied (NOTE: agentStore.ts will have type errors until Task 5 is also complete — run tsc only after Wave 1 is fully done)
    Steps:
      1. Run: grep -n "AgentStep" src/services/ai/agent/types.ts
      2. Assert: AgentStep interface still present and unchanged (still has type: "thought" | "tool_call" | "observation" | "final_answer")
    Expected Result: AgentStep interface untouched
    Failure Indicators: AgentStep modified or missing
    Evidence: .sisyphus/evidence/task-1-agentstep-unchanged.txt
  ```

  **Commit**: YES (groups with Tasks 3, 5)
  - Message: `refactor(ai): remove TaskProgress, add executionPhase types`
  - Files: `src/services/ai/agent/types.ts`
  - Pre-commit: `grep -c "TaskProgress" src/services/ai/agent/types.ts` should return 0

- [ ] 3. Update `system-prompt.md` — Add phase execution documentation

  **What to do**:
  - Add a new section after the "## [MUST] Core Principles" section (after line 100, before "## [SHOULD] Recommended Workflow"), titled `## [MUST] Execution Phases`
  - Content of new section:
    ```markdown
    ## [MUST] Execution Phases

    Your execution follows two distinct phases. You do NOT control phase transitions — the system manages them automatically.

    ### Execution Phase
    - You have access to all tools
    - Use tools as needed to accomplish the user's request
    - When you have completed all necessary tool operations, provide your final response as plain text (no tool calls)
    - The system detects when you respond with text instead of tool calls and transitions you to Response Phase

    ### Response Phase
    - Tools are no longer available (the system removes them)
    - Provide a helpful, conversational summary of what you accomplished
    - Explain results, suggest next steps if appropriate
    - This is your final response to the user

    ### Important
    - Do NOT announce phase transitions — just do your work naturally
    - If you need tools, call them. When you're done with tools, speak naturally.
    - The transition is seamless and invisible to the user
    ```
  - Remove or simplify the existing "### 4. Completion Criteria" section (lines 93-99) since completion is now phase-driven, not hardcoded. Replace with:
    ```markdown
    ### 4. Completion
    - When all necessary tool operations are done, provide a conversational final answer
    - The system will automatically transition you to response-only mode
    - Never end with just "Done." — always explain what you did and what the user can do next
    ```

  **Must NOT do**:
  - Do NOT change the block creation/markdown sections (they are correct and unrelated)
  - Do NOT reference "TaskProgress" or "phase" states like "creating_page" or "creating_blocks"
  - Do NOT add instructions about explicitly requesting phase transitions

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Markdown text editing in a single file
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `writing`: Content is technical, not prose — no special writing skill needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 5)
  - **Blocks**: Task 2
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/services/ai/agent/system-prompt.md:57-100` — Current "Core Principles" section — add new Execution Phases section after this
  - `src/services/ai/agent/system-prompt.md:93-99` — Current "Completion Criteria" subsection — replace with simplified version
  - `src/services/ai/agent/system-prompt.md:101-160` — Current "Recommended Workflow" section — keep as-is but the new Execution Phases section goes BEFORE this

  **WHY Each Reference Matters**:
  - Executor needs to know exact insertion point for the new section
  - Completion Criteria must be replaced (not duplicated) to avoid conflicting instructions
  - Recommended Workflow stays — it provides tool usage patterns that are still valid

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Execution Phases section present
    Tool: Bash (grep)
    Preconditions: Task 3 changes applied
    Steps:
      1. Run: grep -n "Execution Phases" src/services/ai/agent/system-prompt.md
      2. Assert: returns match for the new section header
      3. Run: grep -n "Response Phase" src/services/ai/agent/system-prompt.md
      4. Assert: returns matches explaining Response Phase
    Expected Result: New section exists with both phase descriptions
    Failure Indicators: Section header or phase descriptions missing
    Evidence: .sisyphus/evidence/task-3-phases-section.txt

  Scenario: No hardcoded phase references remain
    Tool: Bash (grep)
    Preconditions: Task 3 changes applied
    Steps:
      1. Run: grep -n "creating_page\|creating_blocks\|TaskProgress" src/services/ai/agent/system-prompt.md
      2. Assert: returns empty (no matches)
    Expected Result: No references to old hardcoded phases
    Failure Indicators: Any match found
    Evidence: .sisyphus/evidence/task-3-no-hardcoded-phases.txt
  ```

  **Commit**: YES (groups with Tasks 1, 5)
  - Message: `refactor(ai): remove TaskProgress, add executionPhase types`
  - Files: `src/services/ai/agent/system-prompt.md`

- [ ] 5. Update `agentStore.ts` — Align initialState with new types

  **What to do**:
  - Remove the entire `taskProgress` object from `initialState` (lines 20-28)
  - Add new fields to `initialState`:
    ```typescript
    executionPhase: "execution" as const,
    toolCallsMade: 0,
    ```
  - Ensure the store interface `AgentStore extends AgentState` still works after `AgentState` changes from Task 1

  **Must NOT do**:
  - Do NOT change store actions (`addStep`, `updateStep`, `setStatus`, `setError`, `reset`, `incrementIteration`)
  - Do NOT add new actions — the store is currently unused by orchestrator and adding actions is scope creep

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple field replacement in initialState object
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - None relevant

  **Parallelization**:
  - **Can Run In Parallel**: YES (within Wave 1, but logically depends on Task 1 type changes)
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: None
  - **Blocked By**: Task 1 (needs updated AgentState type)

  **References**:

  **Pattern References**:
  - `src/stores/agentStore.ts:13-29` — Current `initialState` object — remove `taskProgress` block, add `executionPhase` and `toolCallsMade`
  - `src/stores/agentStore.ts:4-11` — `AgentStore` interface extending `AgentState` — verify this still compiles after type changes

  **API/Type References**:
  - `src/services/ai/agent/types.ts:36-60` — Updated `AgentState` from Task 1 — initialState must match

  **WHY Each Reference Matters**:
  - `initialState` must exactly match the new `AgentState` shape from Task 1 or TypeScript will error
  - Store interface extends AgentState — must verify the extension still works

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: taskProgress removed from store
    Tool: Bash (grep)
    Preconditions: Tasks 1 and 5 both applied
    Steps:
      1. Run: grep -n "taskProgress" src/stores/agentStore.ts
      2. Assert: returns empty (no matches)
    Expected Result: No taskProgress references in agentStore.ts
    Failure Indicators: Any match found
    Evidence: .sisyphus/evidence/task-5-store-taskprogress-removed.txt

  Scenario: New fields in initialState
    Tool: Bash (grep)
    Preconditions: Tasks 1 and 5 both applied
    Steps:
      1. Run: grep -n "executionPhase" src/stores/agentStore.ts
      2. Assert: returns match showing executionPhase: "execution"
      3. Run: grep -n "toolCallsMade" src/stores/agentStore.ts
      4. Assert: returns match showing toolCallsMade: 0
    Expected Result: Both new fields present with correct initial values
    Failure Indicators: Either field missing or wrong initial value
    Evidence: .sisyphus/evidence/task-5-new-fields.txt

  Scenario: Type check passes for Wave 1
    Tool: Bash
    Preconditions: Tasks 1, 3, and 5 ALL applied
    Steps:
      1. Run: npx tsc --noEmit
      2. Assert: exits with code 0
    Expected Result: Zero type errors
    Failure Indicators: Any TypeScript error output
    Evidence: .sisyphus/evidence/task-5-tsc-pass.txt
  ```

  **Commit**: YES (groups with Tasks 1, 3)
  - Message: `refactor(ai): remove TaskProgress, add executionPhase types`
  - Files: `src/stores/agentStore.ts`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 2. Refactor `orchestrator.ts` — Implement Execution → Response phase transition

  **What to do**:

  **A. Remove all `taskProgress` logic (DELETE these code blocks):**
  - Delete `taskProgress` initialization in constructor (lines 47-55):
    ```typescript
    // DELETE this entire block from constructor's this.state
    taskProgress: {
      phase: "idle",
      completedSteps: [],
      pendingSteps: [],
      createdResources: { pages: [], blocks: [] },
    },
    ```
  - Delete `taskProgress` initialization in `execute()` (lines 83-91):
    ```typescript
    // DELETE this entire block from execute()'s this.state reset
    taskProgress: {
      phase: "idle",
      completedSteps: [],
      pendingSteps: [],
      createdResources: { pages: [], blocks: [] },
    },
    ```
  - Delete the `this.updateTaskProgress(toolName, result);` call at line 237
  - Delete the entire `updateTaskProgress()` method (lines 431-462)
  - Delete the `taskProgress.phase === "complete"` branching block (lines 265-279):
    ```typescript
    // DELETE this entire if-block
    if (this.state.taskProgress.phase === "complete") {
      if (accumulatedText.trim()) { ... }
      conversationHistory.push({ role: "user", content: "Now provide a helpful final answer..." });
      continue;
    }
    ```
  - Delete the "Task Progress" section from `buildSystemPrompt()` (lines 510-520):
    ```typescript
    // DELETE this entire block
    const progress = this.state.taskProgress;
    if (progress.phase !== "idle") {
      prompt += "\n\n## Task Progress\n\n";
      ...
    }
    ```

  **B. Add new fields to `this.state` initialization (both constructor AND execute()):**
  Replace `taskProgress: { ... }` with:
  ```typescript
  executionPhase: "execution" as const,
  toolCallsMade: 0,
  ```

  **C. Normalize tools before provider call:**
  Change line 134 from:
  ```typescript
  tools: allTools,
  ```
  To:
  ```typescript
  tools: this.state.executionPhase === "response"
    ? undefined
    : allTools.length > 0 ? allTools : undefined,
  ```

  **D. Track tool calls made:**
  After `this.totalToolCalls++;` (line 159), add:
  ```typescript
  this.state.toolCallsMade++;
  ```

  **E. Implement phase transition logic — REPLACE the deleted `taskProgress.phase === "complete"` block (between line 264 and line 281):**
  After the tool calls are processed and before `continue;`, add this logic:
  ```typescript
  // Phase transition: AI called tools AND also returned text
  // → The text IS the final answer (AI decided it's done)
  if (accumulatedText.trim() && this.state.toolCallsMade > 0) {
    const finalStep = this.createFinalStep(accumulatedText);
    this.state.steps.push(finalStep);
    this.state.status = "completed";
    this.state.executionPhase = "response";
    yield finalStep;
    break;
  }
  ```
  This replaces the old `taskProgress.phase === "complete"` check. The key insight: if the AI returns both tool calls AND text in the same response, the text is the final answer.

  **F. Handle the "tools done, no text yet" case — add after tool budget check block (after line 263):**
  When AI called tools but returned NO text, AND all tools succeeded, the orchestrator should NOT inject any transition message — just let the loop continue naturally. The AI will either call more tools or respond with text on the next iteration.

  However, keep the existing `continue;` at line 281 as-is. The loop naturally continues.

  **G. Simplify `getProgressSummary()` (lines 385-429):**
  Replace the entire method body with a simple tool-call count summary:
  ```typescript
  private getProgressSummary(): string {
    return `${this.state.toolCallsMade} tool call(s) made across ${this.state.iterations} iteration(s).`;
  }
  ```
  This method is only used in the budget-exhaustion fallback message (line 257), so it just needs to provide context about what happened.

  **Must NOT do**:
  - Do NOT modify `AgentStep` interface or its usage
  - Do NOT modify `createFinalStep()` method (keep as-is)
  - Do NOT modify error recovery logic or `classifyError`/`getRecoveryGuidance`
  - Do NOT modify `stableStringify()` utility
  - Do NOT modify duplicate detection logic (`getConsecutiveDuplicateCount`, nudge/stop)
  - Do NOT add `role: "system"` messages to `conversationHistory`
  - Do NOT add hardcoded tool name checks — the AI decides when it's done
  - Do NOT modify provider files
  - Do NOT modify `threadBlockService.ts`
  - Do NOT change the import statements unless removing `TaskProgress` import (if present)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Most complex task — multiple code deletions, additions, and behavioral changes in a single file. Requires understanding execution flow, async generators, and provider API semantics. Must be precise about what stays and what goes.
  - **Skills**: []
    - No special skills needed — this is pure TypeScript logic
  - **Skills Evaluated but Omitted**:
    - `playwright`: No UI interaction
    - `git-master`: Not a git operation
    - `frontend-ui-ux`: Backend orchestration code

  **Parallelization**:
  - **Can Run In Parallel**: NO (sequential within Wave 2, but parallel with Task 4)
  - **Parallel Group**: Wave 2 (with Task 4)
  - **Blocks**: Tasks 4, 6
  - **Blocked By**: Tasks 1, 3 (needs updated types and system prompt)

  **References**:

  **Pattern References** (existing code to follow):
  - `src/services/ai/agent/orchestrator.ts:100-350` — Main execution loop — understand the full flow before modifying. The `while` loop runs iterations, each iteration calls the AI provider, processes tool calls, and checks for termination conditions.
  - `src/services/ai/agent/orchestrator.ts:265-281` — Current `taskProgress.phase === "complete"` block — THIS IS WHAT YOU'RE REPLACING with the new phase transition logic
  - `src/services/ai/agent/orchestrator.ts:284-291` — Text-only response handling (no tool calls) — this already works correctly and should NOT be changed. When AI returns text without calling any tools, this block creates the final step and breaks.
  - `src/services/ai/agent/orchestrator.ts:127-136` — Provider call site — this is where `tools: allTools` must be normalized to respect `executionPhase`
  - `src/services/ai/agent/orchestrator.ts:431-462` — `updateTaskProgress()` to DELETE entirely
  - `src/services/ai/agent/orchestrator.ts:510-520` — `buildSystemPrompt()` task progress section to DELETE

  **API/Type References**:
  - `src/services/ai/agent/types.ts` — After Task 1: `AgentState` will have `executionPhase: "execution" | "response"` and `toolCallsMade: number` instead of `taskProgress`
  - `src/services/ai/types.ts:AIRequest` — The `tools` field accepts `ToolDefinition[] | undefined`. When `undefined`, providers skip tool setup entirely.

  **Provider Behavior References** (critical for understanding `tools: undefined`):
  - `src/services/ai/OpenAIProvider.ts:77-85` — OpenAI treats `tools: []` as truthy (sends `tool_choice: "auto"`). MUST send `undefined` not `[]`.
  - `src/services/ai/ClaudeProvider.ts:90-95` — Claude: `tools: []` → omits tools section. `undefined` also safe.
  - `src/services/ai/GoogleProvider.ts:85-90` — Google: `tools: []` → omits tools. `undefined` also safe.
  - `src/services/ai/OllamaProvider.ts` — Ignores tools entirely.

  **WHY Each Reference Matters**:
  - Lines 100-350: Executor MUST understand the full loop before making surgical changes
  - Lines 265-281: This is the exact code being replaced — executor must know what to delete
  - Lines 284-291: This existing text-only handler is CORRECT and must NOT be changed — it handles the case where AI never called any tools
  - Lines 127-136: The provider call must be updated to pass `undefined` tools in response phase
  - Provider files: Explain WHY `tools: undefined` (not `[]`) is critical

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: No TaskProgress references remain in orchestrator
    Tool: Bash (grep)
    Preconditions: Task 2 changes applied to orchestrator.ts
    Steps:
      1. Run: grep -n "taskProgress\|TaskProgress\|updateTaskProgress" src/services/ai/agent/orchestrator.ts
      2. Assert: command returns empty (exit code 1, no matches)
      3. Run: grep -n "creating_page\|creating_blocks\|phase.*complete" src/services/ai/agent/orchestrator.ts
      4. Assert: command returns empty (exit code 1, no matches)
    Expected Result: Zero references to old task progress system
    Failure Indicators: Any match for taskProgress, TaskProgress, or hardcoded phase names
    Evidence: .sisyphus/evidence/task-2-no-taskprogress.txt

  Scenario: executionPhase field is used for tool normalization
    Tool: Bash (grep)
    Preconditions: Task 2 changes applied
    Steps:
      1. Run: grep -n "executionPhase" src/services/ai/agent/orchestrator.ts
      2. Assert: returns matches showing executionPhase initialization AND usage in tools normalization
      3. Run: grep -n "tools:" src/services/ai/agent/orchestrator.ts
      4. Assert: the tools parameter in generateStream call uses conditional based on executionPhase
    Expected Result: executionPhase drives whether tools are passed to provider
    Failure Indicators: Tools always passed regardless of phase, or hardcoded tool filtering
    Evidence: .sisyphus/evidence/task-2-phase-transition-logic.txt

  Scenario: No hardcoded tool name checks in phase logic
    Tool: Bash (grep)
    Preconditions: Task 2 changes applied
    Steps:
      1. Run: grep -n "create_page\|validate_markdown\|create_blocks_from" src/services/ai/agent/orchestrator.ts
      2. Assert: returns empty (exit code 1)
    Expected Result: No hardcoded tool name references in orchestrator
    Failure Indicators: Any tool name string literal found
    Evidence: .sisyphus/evidence/task-2-no-hardcoded-tools.txt

  Scenario: Build passes
    Tool: Bash
    Preconditions: Tasks 1, 2, 3, 5 all applied
    Steps:
      1. Run: npm run build
      2. Assert: exits with code 0
    Expected Result: TypeScript compilation and Vite build succeed
    Failure Indicators: Any compilation error
    Evidence: .sisyphus/evidence/task-2-build-pass.txt

  Scenario: getProgressSummary simplified
    Tool: Bash (grep)
    Preconditions: Task 2 changes applied
    Steps:
      1. Run: grep -A5 "getProgressSummary" src/services/ai/agent/orchestrator.ts
      2. Assert: method body is simple (uses toolCallsMade, no tool name matching)
      3. Run: grep -n "list_pages\|get_page_blocks" src/services/ai/agent/orchestrator.ts
      4. Assert: returns empty — no tool name pattern matching
    Expected Result: getProgressSummary uses generic counters, not tool-specific logic
    Failure Indicators: Method still contains tool name strings or complex parsing
    Evidence: .sisyphus/evidence/task-2-progress-summary-simplified.txt
  ```

  **Commit**: YES
  - Message: `feat(ai): implement execution-to-response phase transition`
  - Files: `src/services/ai/agent/orchestrator.ts`
  - Pre-commit: `npm run build`

- [ ] 4. Enhance `ThreadFloatingPanel.tsx` — Real-time tool execution feedback

  **What to do**:
  - In the `for await` loop (lines 314-328), handle intermediate step types to show real-time feedback:
    ```typescript
    for await (const step of orchestrator.execute(trimmedInput, { ... })) {
      if (step.type === "tool_call" && step.toolName) {
        // Show tool execution feedback
        setCurrentStreamingContent(`🔧 ${step.toolName}...`);
      } else if (step.type === "observation" && step.toolResult) {
        // Show tool completion status
        const status = step.toolResult.success ? "✅" : "❌";
        setCurrentStreamingContent(`${status} ${step.toolResult.success ? "Done" : "Failed"}`);
      } else if (step.type === "final_answer" && step.content) {
        finalContent = step.content;
        setCurrentStreamingContent(finalContent);
      }
    }
    ```
  - This replaces the current code that only handles `final_answer`:
    ```typescript
    // CURRENT (replace this)
    if (step.type === "final_answer" && step.content) {
      finalContent = step.content;
      setCurrentStreamingContent(finalContent);
    }
    ```
  - The streaming content area in the message bubble (line 672-676) already displays `currentStreamingContent` when `isStreaming` is true, so the tool feedback will show there automatically
  - The existing "Thinking..." fallback (line 676) serves as the initial state before any steps arrive

  **Must NOT do**:
  - Do NOT modify the `SessionList` component
  - Do NOT modify the floating button (closed state)
  - Do NOT modify the session management logic (handleNewSession, switchSession, etc.)
  - Do NOT add new state variables or stores — reuse existing `setCurrentStreamingContent`
  - Do NOT modify the message rendering structure — only the data flowing through `setCurrentStreamingContent`
  - Do NOT add complex step tracking (e.g., step history array) — keep it simple, show current step only
  - Do NOT use hardcoded tool names for display — show whatever `step.toolName` provides

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component enhancement — modifying what users see during AI execution. Requires understanding React component flow, streaming state, and visual feedback patterns.
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Crafting user-visible feedback in a React component — understanding streaming state display and loading indicators
  - **Skills Evaluated but Omitted**:
    - `playwright`: Not needed during implementation — QA only
    - `git-master`: Not a git operation

  **Parallelization**:
  - **Can Run In Parallel**: YES (within Wave 2, parallel with Task 2)
  - **Parallel Group**: Wave 2 (with Task 2)
  - **Blocks**: Task 6
  - **Blocked By**: Task 2 (needs orchestrator to yield tool_call/observation steps — though technically the orchestrator already yields these, the new phase transition behavior could affect timing)

  **References**:

  **Pattern References**:
  - `src/components/ThreadFloatingPanel.tsx:314-328` — Current `for await` loop — THIS IS WHAT YOU'RE MODIFYING. Currently only handles `final_answer` steps.
  - `src/components/ThreadFloatingPanel.tsx:672-676` — Message rendering that displays `currentStreamingContent` — this already works, no changes needed here. The streaming content set via `setCurrentStreamingContent` automatically displays.
  - `src/components/ThreadFloatingPanel.tsx:187` — `setCurrentStreamingContent` from store — the existing API to set what's displayed during streaming

  **API/Type References**:
  - `src/services/ai/agent/types.ts:7-31` — `AgentStep` interface — shows all step types and their fields: `type: "thought" | "tool_call" | "observation" | "final_answer"`, with `toolName` on tool_call and `toolResult` on observation
  - `src/services/ai/tools/types.ts:ToolResult` — Has `success: boolean`, `data?: any`, `error?: string` fields

  **WHY Each Reference Matters**:
  - Lines 314-328: Exact code to modify — executor must understand the async generator consumption pattern
  - Lines 672-676: Shows how streaming content reaches the UI — executor must verify this still works after changes
  - `AgentStep`: Executor needs to know exact field names for each step type to display correctly
  - `ToolResult`: Executor needs to know the success/error fields to display appropriate status icons

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Tool call feedback displays during execution
    Tool: Bash (grep)
    Preconditions: Task 4 changes applied
    Steps:
      1. Run: grep -n "tool_call" src/components/ThreadFloatingPanel.tsx
      2. Assert: returns match showing step.type === "tool_call" handling
      3. Run: grep -n "observation" src/components/ThreadFloatingPanel.tsx
      4. Assert: returns match showing step.type === "observation" handling
      5. Run: grep -n "setCurrentStreamingContent" src/components/ThreadFloatingPanel.tsx
      6. Assert: returns at least 3 matches (tool_call, observation, final_answer)
    Expected Result: All 3 step types are handled in the for-await loop
    Failure Indicators: Only final_answer is handled, or missing setCurrentStreamingContent calls
    Evidence: .sisyphus/evidence/task-4-step-handling.txt

  Scenario: No hardcoded tool names in UI display
    Tool: Bash (grep)
    Preconditions: Task 4 changes applied
    Steps:
      1. Run: grep -n "create_page\|validate_markdown\|create_blocks" src/components/ThreadFloatingPanel.tsx
      2. Assert: returns empty (no hardcoded tool names)
    Expected Result: UI uses step.toolName dynamically, never hardcoded names
    Failure Indicators: Any hardcoded tool name in display logic
    Evidence: .sisyphus/evidence/task-4-no-hardcoded-names.txt

  Scenario: Build passes with UI changes
    Tool: Bash
    Preconditions: All Wave 1 and Wave 2 tasks applied
    Steps:
      1. Run: npm run build
      2. Assert: exits with code 0
      3. Run: npm run lint
      4. Assert: exits with code 0
    Expected Result: Build and lint pass
    Failure Indicators: Any compilation or lint error
    Evidence: .sisyphus/evidence/task-4-build-lint.txt
  ```

  **Commit**: YES
  - Message: `feat(copilot): add real-time tool execution feedback in floating panel`
  - Files: `src/components/ThreadFloatingPanel.tsx`
  - Pre-commit: `npm run build`

- [ ] 6. Integration tests — Write Vitest tests for phase transition

  **What to do**:
  - Create `src/services/ai/agent/__tests__/orchestrator.test.ts`
  - Mock the AI provider (`IAIProvider`) to return controlled responses
  - Mock `toolRegistry.getAll()` to return a test tool
  - Mock `executeTool()` to return controlled results
  - Mock the Zustand stores (`useBlockStore`, `usePageStore`, `useBlockUIStore`) to return empty state

  **Test cases to write:**

  1. **"AI returns text-only (no tools) → immediate final_answer"**
     - Mock provider to stream: `{ type: "text", content: "Hello" }`
     - Assert: single `final_answer` step with content "Hello"
     - Assert: orchestrator status is "completed"
     - Assert: `state.executionPhase` is still "execution" (never transitioned because no tools were called)

  2. **"AI calls tool then returns text → phase transition, final_answer"**
     - Mock provider first call: stream `{ type: "tool_call", toolCall: { id: "1", name: "test_tool", arguments: {} } }`
     - Mock executeTool to return `{ success: true, data: {} }`
     - Mock provider second call: stream `{ type: "text", content: "I did it" }`
     - Assert: steps include `tool_call`, `observation`, `final_answer`
     - Assert: final_answer content is "I did it"
     - Assert: `state.toolCallsMade === 1`

  3. **"AI calls tool then returns both text + tools → text is final answer"**
     - Mock provider to stream both text and tool calls in same response
     - Assert: tool calls are processed first, then text becomes final_answer

  4. **"tools: undefined in response phase"**
     - Verify that when `executionPhase === "response"`, the provider receives `tools: undefined`
     - This ensures AI physically cannot call tools in response phase

  5. **"No TaskProgress references in orchestrator"**
     - Simple grep/assertion that the word "TaskProgress" doesn't appear in the source

  6. **"Budget exhaustion produces final step"**
     - Set `maxTotalToolCalls: 2`
     - Mock provider to always return tool calls
     - Assert: after 2 tool calls, orchestrator produces final_answer with budget message
     - Assert: getProgressSummary() returns simple counter string

  **Must NOT do**:
  - Do NOT test provider implementations (out of scope)
  - Do NOT test threadBlockService integration (out of scope)
  - Do NOT import real AI providers — mock everything
  - Do NOT test UI components — this is orchestrator-only

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Test writing requires understanding both the orchestrator's async generator behavior and Vitest mocking patterns. Medium complexity.
  - **Skills**: []
    - No special skills needed
  - **Skills Evaluated but Omitted**:
    - `playwright`: Not browser testing
    - `frontend-ui-ux`: Not UI work

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (alone)
  - **Blocks**: F1-F4 (final verification)
  - **Blocked By**: Tasks 2, 4 (needs completed orchestrator and UI)

  **References**:

  **Pattern References** (existing test patterns to follow):
  - Run `find src -name "*.test.ts" -o -name "*.test.tsx"` to find existing test files — follow their mocking and assertion patterns
  - `vitest.config.ts` or `vite.config.ts` — Check test configuration, path aliases, setup files

  **API/Type References**:
  - `src/services/ai/agent/types.ts` — `AgentStep`, `AgentConfig`, `IAgentOrchestrator` interfaces
  - `src/services/ai/types.ts` — `IAIProvider`, `StreamChunk`, `ChatMessage` interfaces — needed for mocking
  - `src/services/ai/tools/types.ts` — `ToolResult`, `ToolDefinition` — needed for mock tools
  - `src/services/ai/tools/registry.ts` — `toolRegistry` singleton — needs to be mocked
  - `src/services/ai/tools/executor.ts` — `executeTool` function — needs to be mocked

  **Implementation References**:
  - `src/services/ai/agent/orchestrator.ts` — The code under test — after Tasks 1-5 modifications

  **WHY Each Reference Matters**:
  - Existing tests: Follow project conventions for imports, describe/it structure, mocking style
  - Type interfaces: Define the mock shapes needed for provider and tools
  - orchestrator.ts: Understanding what to test — the async generator yield behavior

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All tests pass
    Tool: Bash
    Preconditions: All implementation tasks (1-5) applied, test file created
    Steps:
      1. Run: npx vitest run src/services/ai/agent/__tests__/orchestrator.test.ts
      2. Assert: exits with code 0
      3. Assert: output shows at least 5 test cases passing
    Expected Result: All phase transition tests pass
    Failure Indicators: Any test failure or runtime error
    Evidence: .sisyphus/evidence/task-6-tests-pass.txt

  Scenario: Test file follows project conventions
    Tool: Bash (grep)
    Preconditions: Test file created
    Steps:
      1. Run: grep -n "describe\|it\|expect\|vi.mock" src/services/ai/agent/__tests__/orchestrator.test.ts
      2. Assert: returns matches showing proper test structure with vi.mock for dependencies
      3. Run: grep -n "import.*vitest" src/services/ai/agent/__tests__/orchestrator.test.ts
      4. Assert: uses vitest imports
    Expected Result: Test file uses vitest conventions with proper mocking
    Failure Indicators: Missing mocks, no describe blocks, or wrong testing framework
    Evidence: .sisyphus/evidence/task-6-test-conventions.txt

  Scenario: Full test suite still passes
    Tool: Bash
    Preconditions: All tasks applied
    Steps:
      1. Run: npx vitest run
      2. Assert: exits with code 0 (all existing + new tests pass)
    Expected Result: No regressions — all tests pass
    Failure Indicators: Any pre-existing test broken by changes
    Evidence: .sisyphus/evidence/task-6-full-suite.txt
  ```

  **Commit**: YES
  - Message: `test(ai): add phase transition integration tests`
  - Files: `src/services/ai/agent/__tests__/orchestrator.test.ts`
  - Pre-commit: `npx vitest run`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns (hardcoded tool names, TaskProgress references, role: "system" in history pushes) — reject with file:line if found. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `npx tsc --noEmit` + `npm run lint` + `npm run build`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod (allow console.warn/error for orchestrator), commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names. Verify Biome formatting passes.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start from clean state. Open the app via Playwright. Test 3 scenarios:
  1. Ask AI to create a page with content → verify tool feedback shows in panel → verify final explanation appears
  2. Ask AI to list/read existing pages → verify single tool execution → verify explanation
  3. Send casual message ("thanks!") → verify no tools called → immediate response
  Save screenshots to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [3/3 pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination. Flag unaccounted changes. Verify `threadBlockService.ts` was NOT modified.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| After Task(s) | Commit Message | Files | Pre-commit Check |
|---------------|---------------|-------|-----------------|
| 1, 3, 5 | `refactor(ai): remove TaskProgress, add executionPhase types` | `types.ts`, `system-prompt.md`, `agentStore.ts` | `npx tsc --noEmit` |
| 2 | `feat(ai): implement execution-to-response phase transition` | `orchestrator.ts` | `npm run build` |
| 4 | `feat(copilot): add real-time tool execution feedback in floating panel` | `ThreadFloatingPanel.tsx` | `npm run build` |
| 6 | `test(ai): add phase transition integration tests` | `__tests__/orchestrator.test.ts` | `npx vitest run` |

---

## Success Criteria

### Verification Commands
```bash
npm run build          # Expected: exits 0, no errors
npm run lint           # Expected: exits 0, no errors
npx tsc --noEmit       # Expected: exits 0, no type errors
npx vitest run         # Expected: all tests pass
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] `threadBlockService.ts` unchanged (git diff shows no modifications)
- [ ] No `TaskProgress` references in codebase (`grep -r "TaskProgress\|taskProgress" src/`)
- [ ] No hardcoded tool name checks in orchestrator (`grep -r "create_page\|validate_markdown\|create_blocks_from" src/services/ai/agent/orchestrator.ts` returns empty)
