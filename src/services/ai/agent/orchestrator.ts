import { useBlockStore } from "../../../stores/blockStore";
import { useBlockUIStore } from "../../../stores/blockUIStore";
import { usePageStore } from "../../../stores/pageStore";
import { executeTool } from "../tools/executor";
import { toolRegistry } from "../tools/registry";
import type { ChatMessage, IAIProvider } from "../types";
import type {
  AgentConfig,
  AgentState,
  AgentStep,
  IAgentOrchestrator,
} from "./types";

export class AgentOrchestrator implements IAgentOrchestrator {
  private state: AgentState;
  private aiProvider: IAIProvider;
  private shouldStop = false;

  constructor(aiProvider: IAIProvider) {
    this.aiProvider = aiProvider;
    this.state = {
      executionId: "",
      goal: "",
      status: "idle",
      steps: [],
      iterations: 0,
      maxIterations: 10,
    };
  }

  async *execute(
    goal: string,
    config: AgentConfig,
  ): AsyncGenerator<AgentStep, void, unknown> {
    this.shouldStop = false;

    const executionId = `exec_${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}`;

    this.state = {
      executionId,
      goal,
      status: "thinking",
      steps: [],
      iterations: 0,
      maxIterations: config.maxIterations || 50,
    };

    console.log(
      `[AgentOrchestrator] Starting execution ${executionId} with goal: "${goal}"`,
    );

    const allTools = toolRegistry.getAll();

    const systemPrompt = this.buildSystemPrompt(config);

    const conversationHistory: ChatMessage[] = [];

    try {
      while (
        this.state.iterations < this.state.maxIterations &&
        !this.shouldStop
      ) {
        this.state.iterations++;
        console.log(
          `[AgentOrchestrator] Iteration ${this.state.iterations}/${this.state.maxIterations}`,
        );

        this.state.status = "thinking";

        const thoughtStep: AgentStep = {
          id: `step_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          type: "thought",
          timestamp: Date.now(),
          thought: `Iteration ${this.state.iterations}: Analyzing task and deciding next action...`,
        };

        this.state.steps.push(thoughtStep);
        yield thoughtStep;

        let toolWasCalled = false;
        let finalAnswerReceived = false;
        let accumulatedText = "";
        const pendingSteps: AgentStep[] = [];

        try {
          const stream = this.aiProvider.generateStream({
            prompt: goal,
            systemPrompt,
            model: config.model || "",
            apiKey: config.apiKey,
            baseUrl: config.baseUrl,
            history: conversationHistory,
            tools: allTools,
            temperature: config.temperature,
            onToolCall: async (toolName: string, params: unknown) => {
              toolWasCalled = true;

              console.log(
                `[AgentOrchestrator] Tool called: ${toolName}`,
                params,
              );

              const toolCallStep: AgentStep = {
                id: `step_${Date.now()}_${Math.random()
                  .toString(36)
                  .substring(7)}`,
                type: "tool_call",
                timestamp: Date.now(),
                toolName,
                toolParams: params,
              };

              this.state.steps.push(toolCallStep);
              pendingSteps.push(toolCallStep);

              this.state.status = "acting";

              const result = await executeTool(
                toolName,
                params,
                config.context,
              );

              console.log(
                "[AgentOrchestrator] Tool result:",
                result.success ? "✓ Success" : "✗ Failed",
              );

              const observationStep: AgentStep = {
                id: `step_${Date.now()}_${Math.random()
                  .toString(36)
                  .substring(7)}`,
                type: "observation",
                timestamp: Date.now(),
                toolResult: result,
              };

              this.state.steps.push(observationStep);
              pendingSteps.push(observationStep);

              conversationHistory.push({
                role: "assistant",
                content: `I called ${toolName} with params ${JSON.stringify(
                  params,
                )}`,
              });
              conversationHistory.push({
                role: "user",
                content: `Tool result: ${JSON.stringify(result)}`,
              });

              return result;
            },
          });

          for await (const chunk of stream) {
            if (chunk.type === "text" && chunk.content) {
              accumulatedText += chunk.content;
            } else if (chunk.type === "error") {
              throw new Error(chunk.error || "Unknown error");
            }
          }

          for (const step of pendingSteps) {
            yield step;
          }
          pendingSteps.length = 0;

          if (accumulatedText.trim() && !toolWasCalled) {
            finalAnswerReceived = true;

            const finalStep: AgentStep = {
              id: `step_${Date.now()}_${Math.random()
                .toString(36)
                .substring(7)}`,
              type: "final_answer",
              timestamp: Date.now(),
              content: accumulatedText,
            };

            this.state.steps.push(finalStep);
            this.state.status = "completed";

            console.log(
              "[AgentOrchestrator] Final answer received, completing execution",
            );

            yield finalStep;
            break;
          }

          if (!toolWasCalled && !finalAnswerReceived) {
            console.log(
              "[AgentOrchestrator] No tool call and no final answer, AI may need more guidance",
            );

            conversationHistory.push({
              role: "assistant",
              content: accumulatedText || "(no response)",
            });

            conversationHistory.push({
              role: "user",
              content:
                "Please use one of the available tools to make progress on the task, or provide a final answer if the task is complete.",
            });
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          console.error(
            `[AgentOrchestrator] Error in iteration ${this.state.iterations}:`,
            errorMessage,
          );

          this.state.error = errorMessage;
          this.state.status = "failed";

          throw error;
        }
      }

      if (
        this.state.iterations >= this.state.maxIterations &&
        this.state.status !== "completed"
      ) {
        console.warn(
          `[AgentOrchestrator] Max iterations (${this.state.maxIterations}) reached without completion`,
        );
        this.state.status = "failed";
        this.state.error = "Maximum iterations reached without completing task";
      }

      if (this.shouldStop) {
        console.log("[AgentOrchestrator] Execution stopped by user");
        this.state.status = "failed";
        this.state.error = "Execution stopped by user";
      }
    } finally {
      console.log(
        `[AgentOrchestrator] Execution ${executionId} finished with status: ${this.state.status}`,
      );
    }
  }

  getState(): AgentState {
    return { ...this.state };
  }

  stop(): void {
    console.log("[AgentOrchestrator] Stop requested");
    this.shouldStop = true;
  }

  private buildSystemPrompt(_config: AgentConfig): string {
    const blockStore = useBlockStore.getState();
    const pageStore = usePageStore.getState();
    const uiStore = useBlockUIStore.getState();

    let systemPrompt = `You are an AI agent in 'Oxinot', a block-based outliner (like Logseq/Roam).

AGENT BEHAVIOR:
1. You MUST use tools to complete tasks - don't just describe what to do
2. Read current state first (list_pages, get_page_blocks) before making changes
3. Plan efficiently - avoid creating then deleting blocks
4. Use update_block instead of delete + create when possible
5. Only provide text responses when truly complete or need clarification
6. LEARN FROM FAILURES: If a tool call fails, DO NOT retry the same approach. Analyze the error and try a different strategy.
7. If you reach max iterations without completing, provide a summary of what you accomplished and what's left.

⭐ CRITICAL: MARKDOWN TO BLOCKS CONVERSION (EACH LINE = ONE BLOCK)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FUNDAMENTAL RULE: When creating content, you MUST convert markdown with newlines
into SEPARATE BLOCKS. You CANNOT put multi-line text (containing \n) in a single block.

WHY THIS MATTERS:
When a user presses Enter in Oxinot:
- If block.content has "Line1\nLine2\nLine3" → Enter adds newline WITHIN block (wrong)
- If each line is separate block → Enter creates NEW block below (correct, Logseq style)

MARKDOWN → BLOCKS CONVERSION ALGORITHM:
1. Parse your markdown output line by line (split on \n)
2. For each non-empty line:
   a) Detect heading level from # symbols (# = level 1, ## = level 2, etc.)
   b) Remove # symbols from content
   c) Calculate indent: (heading_level - 1) OR based on list nesting
   d) Create ONE block for this line
3. Result: Multiple blocks with hierarchy via indent

CONCRETE EXAMPLE:

Your planned markdown:
┌─────────────────────────────────────┐
| # Project Documentation             |
| Oxinot is a block-based outliner.   |
|                                     |
| ## Overview                         |
| Fast, lightweight, keyboard-driven. |
|                                     |
| ## Features                         |
| - Local-first architecture          |
| - Block-based editing               |
| - Graph visualization               |
└─────────────────────────────────────┘

WRONG ❌ - Do NOT do this:
blocks: [{
  content: "# Project Documentation\nOxinot is a block-based outliner.\n## Overview\nFast, lightweight, keyboard-driven.\n## Features\n- Local-first architecture\n- Block-based editing\n- Graph visualization"
}]
Result: ONE block. When user presses Enter in it, just adds newline inside.

RIGHT ✅ - Do THIS instead:
blocks: [
  { content: "Project Documentation", indent: 0 },
  { content: "Oxinot is a block-based outliner.", indent: 1 },
  { content: "Overview", indent: 1 },
  { content: "Fast, lightweight, keyboard-driven.", indent: 2 },
  { content: "Features", indent: 1 },
  { content: "Local-first architecture", indent: 2 },
  { content: "Block-based editing", indent: 2 },
  { content: "Graph visualization", indent: 2 }
]
Result: 8 separate blocks. When user presses Enter, NEW block is created below.

INDENT CALCULATION RULES:
- # (top heading) → indent: 0
- Content under # → indent: 1
- ## (section heading) → indent: 1
- Content under ## → indent: 2
- ### (subsection heading) → indent: 2
- Content under ### → indent: 3
- List items → indent based on nesting level

VERIFICATION CHECKLIST:
Before calling create_page_with_blocks, verify your blocks array:
- [ ] Each block.content is a SINGLE LINE (no \n, no \r characters)
- [ ] No block content starts with # ## ### (already extracted as separate blocks)
- [ ] Heading blocks have lower indent than their content blocks
- [ ] Indentation is consistent and logical
- [ ] No empty blocks

TOOLS TO USE:
- create_page_with_blocks: For initial structured content (use this!)
- create_block: For adding single blocks later
- insert_block_below: For precise placement after specific blocks
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BLOCK-BASED OUTLINER STRUCTURE:
- Each block is a bullet point with content
- Blocks can be nested (parent-child hierarchy)
- Types: bullet (text), code (triple backticks with language), fence (multiline text)
- Pages can be regular notes OR directories (folders that contain other pages)

DIRECTORY/FILE HIERARCHY (CRITICAL):
- The workspace has a hierarchical structure similar to a file system
- Directories: Pages where isDirectory=true. They contain other pages.
- Regular pages: isDirectory=false. They contain blocks (content).
- ROOT LEVEL: Pages with parentId=null are at the top level

WORKFLOW FOR CREATING PAGES IN DIRECTORIES:
1. First call list_pages(includeDirectories=true) to see what exists
2. Find the parent directory by its TITLE, then use its UUID as parentId
3. If the parent directory doesn't exist, create it FIRST with create_page(parentId=null, isDirectory=true)
4. Then create child pages with create_page(parentId=<parent-UUID>)
5. NEVER use page titles as parentId - ALWAYS use the UUID from list_pages results

IMPORTANT: UUID vs TITLES:
- All page references (parentId, pageId) MUST be UUIDs, not titles
- To find a UUID: call list_pages and search for the title in results
- Example: If you want to create "Meeting" under "PROJECTS":
  1. list_pages() → find "PROJECTS" page, get its UUID
  2. create_page(title="Meeting", parentId="<PROJECTS-UUID>")
- WRONG: create_page(title="Meeting", parentId="PROJECTS") ← This will fail!

MARKDOWN SYNTAX:
- Code blocks: Triple backticks with language, e.g. python, javascript, rust
- Wiki links: [[Page Name]]
- Block refs: ((block-id))
- Tasks: - [ ] todo, - [x] done

CODE BLOCK CREATION:
When creating code blocks, include FULL content in ONE operation.
Use triple backticks at start and end with language name after opening backticks.
All code lines go between the backticks.

KEY TOOLS:
- list_pages: Discover all pages and directories, find UUIDs by title
- get_page_blocks: See what content exists before changing
- create_page: Create new pages (set parentId to place in directory)
- create_block: New block (provide content)
- update_block: Modify existing (more efficient than delete+create)
- insert_block_below: Add after specific block
- query_blocks: Find specific content

COMMON ERRORS AND HOW TO AVOID THEM:
- "Parent page not found": You used a title instead of UUID. Call list_pages to get the UUID.
- "Parent is not a directory": The parent is a regular page. Create a directory first or find a different parent.
- "Page not found": Wrong UUID. Call list_pages to find the correct one.

AVAILABLE CONTEXT:
`;

    const focusedId = uiStore.focusedBlockId;
    if (focusedId) {
      const block = blockStore.blocksById[focusedId];
      if (block) {
        systemPrompt += `- Current focused block: "${block.content}" (ID: ${focusedId})\n`;
      }
    }

    const pageId = blockStore.currentPageId;
    if (pageId) {
      const page = pageStore.pagesById[pageId];
      const pageTitle = page?.title || "Untitled";
      systemPrompt += `- Current page: "${pageTitle}" (ID: ${pageId})\n`;
    }

    systemPrompt +=
      "\nREMEMBER: You are an autonomous agent. Use tools to accomplish tasks. Think step by step.";

    return systemPrompt;
  }
}
