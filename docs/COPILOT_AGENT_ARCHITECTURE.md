# Copilot Agent Architecture - Design Document

## Overview

This document describes the transformation of the Oxinot copilot from a simple tool executor to an autonomous agent capable of multi-step task completion.

## Previous Architecture

**Before**: The copilot was essentially a chatbot with tool-calling capability:
- User sends a message
- AI decides to call a tool
- Tool executes once
- AI responds with text
- **Problem**: Tools were being displayed as text commands instead of being executed
- **Problem**: No iteration - one tool call per user message

## New Architecture

**After**: The copilot is now an autonomous agent with iterative capabilities:
- User sends a goal/task
- Agent enters agentic loop (up to 10 iterations)
- Agent can call multiple tools in sequence
- Agent evaluates results and decides next action
- Agent continues until task is complete or max iterations reached
- **Solution**: Tools are actually executed via `executeTool()`
- **Solution**: Agent can perform complex multi-step tasks autonomously

## Key Components

### 1. Agent Orchestrator (`src/services/ai/agent/orchestrator.ts`)

The core agentic loop implementation:

```typescript
class AgentOrchestrator {
  async *execute(goal: string, config: AgentConfig): AsyncGenerator<AgentStep> {
    while (iterations < maxIterations && !shouldStop) {
      // 1. Think: Decide what to do next
      // 2. Act: Call tools as needed
      // 3. Observe: Evaluate tool results
      // 4. Continue or Complete
    }
  }
}
```

**Features**:
- Iterative execution (up to 10 iterations by default)
- Tool result evaluation and decision-making
- Conversation history maintenance for context
- Early termination when task is complete
- Error handling and recovery

### 2. Agent State Management (`src/stores/agentStore.ts`)

Zustand store for tracking agent execution:

```typescript
interface AgentState {
  executionId: string;
  goal: string;
  status: "idle" | "thinking" | "acting" | "completed" | "failed";
  steps: AgentStep[];
  iterations: number;
  maxIterations: number;
}
```

### 3. Agent Types (`src/services/ai/agent/types.ts`)

Type definitions for agent operations:

- `AgentStep`: Represents a single action (thought, tool_call, observation, final_answer)
- `AgentState`: Current execution state
- `AgentConfig`: Configuration options
- `IAgentOrchestrator`: Interface for agent implementations

### 4. Updated CopilotPanel (`src/components/copilot/CopilotPanel.tsx`)

Modified to use AgentOrchestrator instead of direct AI provider:

**Changes**:
- Removed direct `generateStream()` call
- Added `AgentOrchestrator` instantiation
- Iterate through agent steps using async generator
- Display step-by-step progress with emojis (💭, 🔧, ✅, ❌)
- Real-time UI updates as agent works

## Agentic Loop Flow

```
User Input: "Create 3 blocks about TypeScript"
    ↓
[Iteration 1]
  💭 Thinking: "I need to create 3 blocks..."
  🔧 Tool Call: create_block("Learn TypeScript basics")
  ✅ Observation: Block created successfully
    ↓
[Iteration 2]
  💭 Thinking: "Created 1, need 2 more..."
  🔧 Tool Call: create_block("Practice with examples")
  ✅ Observation: Block created successfully
    ↓
[Iteration 3]
  💭 Thinking: "Created 2, need 1 more..."
  🔧 Tool Call: create_block("Build a TypeScript project")
  ✅ Observation: Block created successfully
    ↓
[Iteration 4]
  💭 Thinking: "All 3 blocks created, task complete"
  📝 Final Answer: "I've created 3 blocks about learning TypeScript."
    ↓
[COMPLETE]
```

## System Prompt Changes

New system prompt emphasizes autonomous behavior:

```
You are an AI AGENT, not just a chatbot.
Your job is to COMPLETE TASKS using the provided tools.

CRITICAL INSTRUCTIONS:
1. When asked to create/update/delete content, USE THE TOOLS
2. Break down complex tasks into smaller steps
3. After using a tool, evaluate the result
4. Continue until the task is complete
5. DO NOT just describe what you would do - ACTUALLY DO IT
```

## Benefits

### 1. True Task Completion
- Agent can complete multi-step tasks without user intervention
- No need to ask "do X, then Y, then Z" - just say "accomplish goal G"

### 2. Autonomous Decision Making
- Agent evaluates tool results and adapts
- Can recover from errors or unexpected results
- Learns from previous actions in the same session

### 3. Better UX
- Real-time progress updates (step-by-step feedback)
- Clear indication of what agent is doing
- Visual confirmation when tools execute

### 4. Extensibility
- Easy to add new tools - agent will automatically use them
- Agent behavior can be tuned via system prompt
- Iteration limit prevents runaway loops

## Limitations & Future Work

### Current Limitations
1. **No Parallel Execution**: Tools execute sequentially (could be parallelized)
2. **Fixed Iteration Limit**: 10 iterations max (could be dynamic)
3. **No Memory Across Sessions**: Agent forgets after page reload
4. **Limited Planning**: No explicit planning phase (immediate execution)

### Future Enhancements
1. **Planning Phase**: Agent creates execution plan before acting
2. **Tool Parallelization**: Execute independent tools concurrently
3. **Memory Persistence**: Store agent sessions in database
4. **User Interruption**: Allow user to guide agent mid-execution
5. **Reflection**: Agent reviews its work and suggests improvements
6. **Learning**: Agent learns from successes/failures over time

## Testing

See `TESTING_COPILOT_AGENT.md` for detailed test scenarios.

## Migration Notes

No breaking changes for users:
- Same UI (copilot panel)
- Same keyboard shortcut (Cmd/Ctrl + ;)
- All existing tools continue to work
- Backward compatible with previous copilot behavior

Code changes:
- `CopilotPanel.tsx`: Switched from direct AI provider to `AgentOrchestrator`
- New files: `agent/orchestrator.ts`, `agent/types.ts`, `stores/agentStore.ts`
- No changes to existing tool definitions
- No changes to AI provider interfaces

## Performance Considerations

- **Response Time**: Slightly longer due to iteration (2-10s per iteration)
- **Token Usage**: Higher due to multiple AI calls in one task
- **Memory**: Agent state is lightweight (<1KB per execution)
- **UI Updates**: Real-time streaming maintains responsive feel

## Conclusion

The new agent architecture transforms the copilot from a reactive chatbot into a proactive task executor. Users can now delegate complex, multi-step tasks and trust the agent to complete them autonomously.
