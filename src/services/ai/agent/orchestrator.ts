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
import systemPromptContent from "./system-prompt.md?raw";

interface ToolCallHistory {
  toolName: string;
  params: unknown;
  timestamp: number;
}

export class AgentOrchestrator implements IAgentOrchestrator {
  private state: AgentState;
  private aiProvider: IAIProvider;
  private shouldStop = false;
  private toolCallHistory: ToolCallHistory[] = [];

  constructor(aiProvider: IAIProvider) {
    this.aiProvider = aiProvider;
    this.state = {
      executionId: "",
      goal: "",
      status: "idle",
      steps: [],
      iterations: 0,
      maxIterations: 10,
      taskProgress: {
        phase: "idle",
        completedSteps: [],
        pendingSteps: [],
        createdResources: {
          pages: [],
          blocks: [],
        },
      },
    };
  }

  async *execute(
    goal: string,
    config: AgentConfig
  ): AsyncGenerator<AgentStep, void, unknown> {
    this.shouldStop = false;
    this.toolCallHistory = []; // Reset history for new execution

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
      `[AgentOrchestrator] Starting execution ${executionId} with goal: "${goal}"`
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
          `[AgentOrchestrator] Iteration ${this.state.iterations}/${this.state.maxIterations}`
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

              // Record tool call for looping detection
              this.toolCallHistory.push({
                toolName,
                params,
                timestamp: Date.now(),
              });

              // Detect looping patterns
              const loopCheck = this.detectLooping();
              if (loopCheck.isLooping) {
                console.warn(
                  `[AgentOrchestrator] ⚠️ Looping detected: ${loopCheck.reason}`
                );

                // Inject guidance into conversation history
                conversationHistory.push({
                  role: "user",
                  content: `⚠️ LOOPING DETECTED: ${
                    loopCheck.reason
                  }\n\nYou are repeating the same actions without making progress. Based on the information you already have:\n\n${this.getProgressSummary()}\n\nContinue with the next logical step. If you cannot complete the task with available information, provide a final answer summarizing what you've accomplished.`,
                });

                // Clear recent history to break the loop
                const lastAssistantIdx =
                  conversationHistory.length - 2 >= 0
                    ? conversationHistory.length - 2
                    : 0;
                conversationHistory.splice(lastAssistantIdx, 2);
              }

              console.log(
                `[AgentOrchestrator] Tool called: ${toolName}`,
                params
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
                config.context
              );

              console.log(
                "[AgentOrchestrator] Tool result:",
                result.success ? "✓ Success" : "✗ Failed"
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
                  params
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
              "[AgentOrchestrator] Final answer received, completing execution"
            );

            yield finalStep;
            break;
          }

          if (!toolWasCalled && !finalAnswerReceived) {
            console.log(
              "[AgentOrchestrator] No tool call and no final answer, AI may need more guidance"
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
            errorMessage
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
          `[AgentOrchestrator] Max iterations (${this.state.maxIterations}) reached without completion`
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
        `[AgentOrchestrator] Execution ${executionId} finished with status: ${this.state.status}`
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

  /**
   * Detect looping patterns in tool calls
   */
  private detectLooping(): { isLooping: boolean; reason?: string } {
    const recentCalls = this.toolCallHistory.slice(-5);

    // Pattern 1: Same tool called 3+ times in a row
    if (recentCalls.length >= 3) {
      const lastThree = recentCalls.slice(-3);
      const allSameTool = lastThree.every(
        (call) => call.toolName === lastThree[0].toolName
      );
      if (allSameTool) {
        return {
          isLooping: true,
          reason: `Same tool '${lastThree[0].toolName}' called 3+ times consecutively`,
        };
      }
    }

    // Pattern 2: Only read-only tools called repeatedly (list_pages, query_pages, get_page_blocks, query_blocks)
    const readOnlyTools = [
      "list_pages",
      "query_pages",
      "get_page_blocks",
      "query_blocks",
    ];
    const last4 = recentCalls.slice(-4);
    if (
      last4.length >= 4 &&
      last4.every((call) => readOnlyTools.includes(call.toolName))
    ) {
      return {
        isLooping: true,
        reason:
          "Only read-only query tools called repeatedly without taking action",
      };
    }

    // Pattern 3: Create operation followed by repeated list/query calls (verification loop)
    if (recentCalls.length >= 3) {
      const hasCreate = recentCalls.some((call) =>
        call.toolName.includes("create")
      );
      const last2 = recentCalls.slice(-2);
      const last2AreQueries = last2.every(
        (call) =>
          call.toolName === "list_pages" || call.toolName === "query_pages"
      );
      if (hasCreate && last2AreQueries) {
        return {
          isLooping: true,
          reason: "Unnecessary verification queries after create operation",
        };
      }
    }

    return { isLooping: false };
  }

  /**
   * Get summary of progress made so far
   */
  private getProgressSummary(): string {
    const createdPages = new Set<string>();
    const createdBlocks = new Set<string>();
    const pagesListed = this.toolCallHistory.some(
      (c) => c.toolName === "list_pages"
    );
    const blocksRetrieved = this.toolCallHistory.some(
      (c) => c.toolName === "get_page_blocks"
    );

    // Analyze tool results to find created resources
    for (const step of this.state.steps) {
      if (step.type === "observation" && step.toolResult?.success) {
        const data = step.toolResult.data as Record<string, unknown>;
        if (data?.pageId) {
          createdPages.add(String(data.pageId));
        }
        if (data?.blocksCreated || data?.blocks) {
          const count =
            (data.blocksCreated as number) ??
            (data.blocks as unknown[]).length ??
            0;
          createdBlocks.add(`page:${data.pageId}:${count} blocks`);
        }
      }
    }

    let summary = "";
    if (pagesListed) {
      summary += "- Pages have been listed\n";
    }
    if (createdPages.size > 0) {
      summary += `- ${createdPages.size} page(s) created\n`;
    }
    if (blocksRetrieved) {
      summary += "- Page blocks have been retrieved\n";
    }
    if (createdBlocks.size > 0) {
      summary += "- Blocks have been created\n";
    }
    if (summary === "") {
      summary = "- No significant progress made yet\n";
    }

    return summary;
  }

  /**
   * Build system prompt using system-prompt.md file + dynamic context
   */
  /**
   * Update task progress based on actions taken
   */
  private updateTaskProgress(toolName?: string, result?: ToolResult): void {
    // Determine new phase based on tool call
    if (toolName?.includes("create_page") && result?.success) {
      this.state.taskProgress.phase = "creating_page";
      this.state.taskProgress.completedSteps.push("Page created");
      this.state.taskProgress.pendingSteps = [
        "Generate markdown",
        "Validate markdown",
        "Create blocks",
        "Verify results",
      ];
      if (result.data) {
        const data = result.data as { id: string; title: string };
        this.state.taskProgress.createdResources.pages.push({
          id: data.id,
          title: data.title,
        });
      }
    } else if (toolName === "validate_markdown_structure" && result?.success) {
      this.state.taskProgress.phase = "creating_blocks";
      this.state.taskProgress.completedSteps.push("Markdown validated");
      this.state.taskProgress.pendingSteps = ["Create blocks"];
    } else if (toolName === "create_blocks_from_markdown" && result?.success) {
      this.state.taskProgress.phase = "verifying";
      this.state.taskProgress.completedSteps.push("Blocks created");
      this.state.taskProgress.pendingSteps = ["Verify results"];
      if (result.data) {
        const data = result.data as { blocksCreated: number };
        this.state.taskProgress.createdResources.blocks.push({
          id: `page:${result.data?.pageId || "unknown"}`,
          pageId: result.data?.pageId || "unknown",
        });
      }
    } else if (this.state.taskProgress.phase === "verifying" && toolName !== "create_blocks_from_markdown") {
      // Still in verification phase
      if (toolName === "get_page_blocks") {
        this.state.taskProgress.completedSteps.push("Blocks retrieved");
        this.state.taskProgress.pendingSteps = [];
      }
    }

    // Mark as complete if all done
    if (
      this.state.taskProgress.createdResources.pages.length > 0 &&
      this.state.taskProgress.createdResources.blocks.length > 0 &&
      this.state.taskProgress.phase === "verifying"
    ) {
      this.state.taskProgress.phase = "complete";
      this.state.taskProgress.completedSteps.push("Task completed");
      this.state.taskProgress.pendingSteps = [];
    }
  }

  private buildSystemPrompt(_config: AgentConfig): string {
    let prompt = systemPromptContent;

    // Add dynamic context section
    const blockStore = useBlockStore.getState();
    const pageStore = usePageStore.getState();
    const uiStore = useBlockUIStore.getState();

    prompt += "\n\n---\n\n## Dynamic Context\n\n";

    // Current focused block
    const focusedId = uiStore.focusedBlockId;
    if (focusedId) {
      const block = blockStore.blocksById[focusedId];
      if (block) {
        prompt += `- **Current focused block**: "${block.content}" (ID: ${focusedId})\n`;
      }
    }

    // Current page
    const pageId = blockStore.currentPageId;
    if (pageId) {
      const page = pageStore.pagesById[pageId];
      if (page) {
        prompt += `- **Current page**: "${page.title}" (ID: ${pageId})\n`;
        if (page.isDirectory) {
          prompt += "  - This is a **directory** (contains other pages)\n";
        } else {
          prompt += `  - This is a **regular page** (contains blocks)\n`;
            }
          }

        // Inject task progress
        const progress = this.state.taskProgress;
        if (progress.phase !== "idle") {
          prompt += `\n\n## Task Progress\n\n`;
          prompt += `- **Current Phase**: ${progress.phase}\n`;
          if (progress.completedSteps.length > 0) {
            prompt += `- **Completed**: ${progress.completedSteps.join(", ")}\n`;
          }
          if (progress.pendingSteps.length > 0) {
            prompt += `- **Pending**: ${progress.pendingSteps.join(", ")}\n`;
          }
        }

        return prompt;
    // Selected blocks
    const selectedIds = uiStore.selectedBlockIds;
    if (selectedIds.length > 0) {
      prompt += `- **Selected blocks**: ${selectedIds.length} block(s) selected\n`;
      for (const id of selectedIds.slice(0, 3)) {
        const block = blockStore.blocksById[id];
        if (block) {
          prompt += `  - "${block.content.substring(0, 50)}${
            block.content.length > 50 ? "..." : ""
          }"\n`;
        }
      }
      if (selectedIds.length > 3) {
        prompt += `  - ... and ${selectedIds.length - 3} more\n`;
      }
    }

    return prompt;
  }
}
