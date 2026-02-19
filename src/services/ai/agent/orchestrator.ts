import { useBlockStore } from "../../../stores/blockStore";
import { useBlockUIStore } from "../../../stores/blockUIStore";
import { usePageStore } from "../../../stores/pageStore";
import { executeTool } from "../tools/executor";
import { toolRegistry } from "../tools/registry";
import type { ToolResult } from "../tools/types";
import type { ChatMessage, IAIProvider } from "../types";
import {
  classifyError,
  getRecoveryGuidance,
  isRecoverable,
} from "./errorRecovery";
import systemPromptContent from "./system-prompt.md?raw";
import type {
  AgentConfig,
  AgentState,
  AgentStep,
  IAgentOrchestrator,
} from "./types";

const DEFAULT_MAX_ITERATIONS = 50;
const DEFAULT_MAX_TOTAL_TOOL_CALLS = 16;
const CONSECUTIVE_DUPLICATE_NUDGE = 2;
const CONSECUTIVE_DUPLICATE_STOP = 3;

export class AgentOrchestrator implements IAgentOrchestrator {
  private state: AgentState;
  private aiProvider: IAIProvider;
  private shouldStop = false;
  private toolCallHistory: Array<{
    toolName: string;
    argsKey: string;
    timestamp: number;
  }> = [];
  private totalToolCalls = 0;
  private emptyResponseCount = 0;

  constructor(aiProvider: IAIProvider) {
    this.aiProvider = aiProvider;
    this.state = {
      executionId: "",
      goal: "",
      status: "idle",
      steps: [],
      iterations: 0,
      maxIterations: DEFAULT_MAX_ITERATIONS,
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
    config: AgentConfig,
  ): AsyncGenerator<AgentStep, void, unknown> {
    this.shouldStop = false;
    this.toolCallHistory = [];
    this.totalToolCalls = 0;
    this.emptyResponseCount = 0;

    const maxIterations = config.maxIterations || DEFAULT_MAX_ITERATIONS;
    const maxTotalToolCalls =
      config.maxTotalToolCalls || DEFAULT_MAX_TOTAL_TOOL_CALLS;

    const executionId = `exec_${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}`;

    this.state = {
      executionId,
      goal,
      status: "thinking",
      steps: [],
      iterations: 0,
      maxIterations,
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

        let accumulatedText = "";
        const toolCalls: Array<{
          id: string;
          name: string;
          arguments: unknown;
        }> = [];

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
          });

          for await (const chunk of stream) {
            if (chunk.type === "text" && chunk.content) {
              accumulatedText += chunk.content;
            } else if (chunk.type === "tool_call" && chunk.toolCall) {
              toolCalls.push(chunk.toolCall);
            } else if (chunk.type === "error") {
              throw new Error(chunk.error || "Unknown error");
            }
          }

          if (toolCalls.length > 0) {
            for (const toolCall of toolCalls) {
              const { id: _id, name: toolName, arguments: params } = toolCall;

              if (this.totalToolCalls >= maxTotalToolCalls) {
                console.warn(
                  `[AgentOrchestrator] Max total tool calls (${maxTotalToolCalls}) reached`,
                );
                break;
              }

              this.totalToolCalls++;
              const argsKey = stableStringify(params);
              this.toolCallHistory.push({
                toolName,
                argsKey,
                timestamp: Date.now(),
              });

              const duplicateCount = this.getConsecutiveDuplicateCount(
                toolName,
                argsKey,
              );

              if (duplicateCount >= CONSECUTIVE_DUPLICATE_STOP) {
                console.warn(
                  `[AgentOrchestrator] Stopping: ${toolName} called ${duplicateCount}x with same args`,
                );
                conversationHistory.push({
                  role: "user",
                  content: `You called ${toolName} ${duplicateCount} times with the same arguments. Stop repeating and provide a final answer with what you've accomplished so far.`,
                });
                break;
              }

              if (duplicateCount >= CONSECUTIVE_DUPLICATE_NUDGE) {
                console.warn(
                  `[AgentOrchestrator] Nudge: ${toolName} called ${duplicateCount}x with same args`,
                );
                conversationHistory.push({
                  role: "user",
                  content: `You already called ${toolName} with these same arguments. Use the previous result and move to the next step.`,
                });
                continue;
              }

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
              yield toolCallStep;

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
              yield observationStep;

              this.updateTaskProgress(toolName, result);

              conversationHistory.push({
                role: "assistant",
                content: `I called ${toolName} with params ${JSON.stringify(params)}`,
              });
              conversationHistory.push({
                role: "user",
                content: `Tool result: ${JSON.stringify(result)}`,
              });
            }

            this.emptyResponseCount = 0;

            if (this.totalToolCalls >= maxTotalToolCalls) {
              console.warn(
                "[AgentOrchestrator] Tool call budget exhausted, completing",
              );
              const finalStep = this.createFinalStep(
                "Tool call budget exhausted. Task progress: " +
                  this.getProgressSummary(),
              );
              this.state.steps.push(finalStep);
              this.state.status = "completed";
              yield finalStep;
              break;
            }

            if (this.state.taskProgress.phase === "complete") {
              console.log(
                "[AgentOrchestrator] Task phase is complete, auto-terminating",
              );
              const finalStep = this.createFinalStep(
                "Task completed successfully.",
              );
              this.state.steps.push(finalStep);
              this.state.status = "completed";
              yield finalStep;
              break;
            }

            continue;
          }

          if (accumulatedText.trim()) {
            this.emptyResponseCount = 0;

            if (
              this.totalToolCalls === 0 &&
              !this.isConversationalResponse(accumulatedText) &&
              this.state.iterations < 5
            ) {
              console.log(
                `[AgentOrchestrator] No tools called in iteration ${this.state.iterations}, providing escalating feedback`,
              );
              conversationHistory.push({
                role: "assistant",
                content: accumulatedText,
              });
              conversationHistory.push({
                role: "user",
                content: this.getEscalatingFeedback(this.state.iterations),
              });
              continue;
            }

            if (
              this.totalToolCalls === 0 &&
              !this.isConversationalResponse(accumulatedText)
            ) {
              console.warn(
                "[AgentOrchestrator] Task may be incomplete - no tools were called for an action request",
              );
            }

            const finalStep = this.createFinalStep(accumulatedText);
            this.state.steps.push(finalStep);
            this.state.status = "completed";

            console.log(
              "[AgentOrchestrator] Final answer received, completing execution",
            );

            yield finalStep;
            break;
          }

          this.emptyResponseCount++;
          console.log(
            `[AgentOrchestrator] Empty response (${this.emptyResponseCount})`,
          );

          if (this.emptyResponseCount >= 2) {
            this.state.status = "failed";
            this.state.error = "AI produced no response after retry";
            break;
          }

          conversationHistory.push({
            role: "assistant",
            content: "(no response)",
          });
          conversationHistory.push({
            role: "user",
            content:
              "Respond with a final answer or call a tool to make progress. Do not stall.",
          });
        } catch (error) {
          const errorInfo = classifyError(error as Error | string);

          console.error(
            `[AgentOrchestrator] Error classified: ${errorInfo.category} (${errorInfo.severity})`,
            errorInfo.message,
          );

          if (isRecoverable(errorInfo)) {
            const recoveryPrompt = getRecoveryGuidance(errorInfo);
            conversationHistory.push({
              role: "user",
              content: recoveryPrompt,
            });

            console.log(
              "[AgentOrchestrator] Recovery strategy:",
              errorInfo.suggestedStrategy,
            );
          } else {
            this.state.error = errorInfo.message;
            this.state.status = "failed";
            throw error;
          }
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

  private isConversationalResponse(text: string): boolean {
    const normalized = text.toLowerCase().trim();
    const conversationalPatterns = [
      /^(thanks?|thank you|고마워|감사)/,
      /^(hi|hello|hey|안녕)/,
      /^(ok(ay)?|alright|좋아|응|네)/,
      /^(sure|of course|물론)/,
      /^(got it|understood|알겠)/,
      /^(cool|great|awesome|좋네|대박)/,
    ];
    return (
      conversationalPatterns.some((p) => p.test(normalized)) ||
      normalized.length < 10
    );
  }

  private getEscalatingFeedback(iteration: number): string {
    if (iteration === 1) {
      return "Please use one of the available tools to make progress on the task, or provide a final answer if the task is complete.";
    }
    if (iteration === 2) {
      return "You have not called any tools yet. For tasks that require creating or modifying content, you MUST use tools like `list_pages`, `get_page_blocks`, `create_page`, or `create_blocks_from_markdown`. Do not just describe what you will do - actually call the tool.";
    }
    if (iteration === 3) {
      return "CRITICAL: You are still not using tools. When the user asks you to create, write, or modify content, you MUST immediately call a tool. For example: call `get_page_blocks` to see the current page content, then `create_blocks_from_markdown` to add new content. Stop describing and start executing.";
    }
    return "FINAL WARNING: You have not called any tools after multiple attempts. Either call a tool NOW (e.g., `list_pages`, `get_page_blocks`, `create_blocks_from_markdown`) or provide a final answer explaining why the task cannot be completed.";
  }

  private getConsecutiveDuplicateCount(
    toolName: string,
    argsKey: string,
  ): number {
    let count = 0;
    for (let i = this.toolCallHistory.length - 1; i >= 0; i--) {
      const entry = this.toolCallHistory[i];
      if (entry.toolName === toolName && entry.argsKey === argsKey) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  private createFinalStep(content: string): AgentStep {
    return {
      id: `step_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      type: "final_answer",
      timestamp: Date.now(),
      content,
    };
  }

  private getProgressSummary(): string {
    const createdPages = new Set<string>();
    const createdBlocks = new Set<string>();
    const pagesListed = this.toolCallHistory.some(
      (c) => c.toolName === "list_pages",
    );
    const blocksRetrieved = this.toolCallHistory.some(
      (c) => c.toolName === "get_page_blocks",
    );

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

  private updateTaskProgress(toolName?: string, result?: ToolResult): void {
    if (toolName?.includes("create_page") && result?.success) {
      this.state.taskProgress.phase = "creating_page";
      this.state.taskProgress.completedSteps.push("Page created");
      this.state.taskProgress.pendingSteps = [
        "Generate markdown",
        "Validate markdown",
        "Create blocks",
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
      this.state.taskProgress.phase = "complete";
      this.state.taskProgress.completedSteps.push("Blocks created");
      this.state.taskProgress.pendingSteps = [];
      if (result.data) {
        this.state.taskProgress.createdResources.blocks.push({
          id: `page:${result.data?.pageId || "unknown"}`,
          pageId: result.data?.pageId || "unknown",
        });
      }
    }
  }

  private buildSystemPrompt(_config: AgentConfig): string {
    let prompt = systemPromptContent;

    const blockStore = useBlockStore.getState();
    const pageStore = usePageStore.getState();
    const uiStore = useBlockUIStore.getState();

    prompt += "\n\n---\n\n## Dynamic Context\n\n";

    const focusedId = uiStore.focusedBlockId;
    if (focusedId) {
      const block = blockStore.blocksById[focusedId];
      if (block) {
        prompt += `- **Current focused block**: "${block.content}" (ID: ${focusedId})\n`;
      }
    }

    const pageId = blockStore.currentPageId;
    if (pageId) {
      const page = pageStore.pagesById[pageId];
      if (page) {
        prompt += `- **Current page**: "${page.title}" (ID: ${pageId})\n`;
        if (page.isDirectory) {
          prompt += "  - This is a **directory** (contains other pages)\n";
        } else {
          prompt += "  - This is a **regular page** (contains blocks)\n";
        }
      }
    }

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

    const progress = this.state.taskProgress;
    if (progress.phase !== "idle") {
      prompt += "\n\n## Task Progress\n\n";
      prompt += `- **Current Phase**: ${progress.phase}\n`;
      if (progress.completedSteps.length > 0) {
        prompt += `- **Completed**: ${progress.completedSteps.join(", ")}\n`;
      }
      if (progress.pendingSteps.length > 0) {
        prompt += `- **Pending**: ${progress.pendingSteps.join(", ")}\n`;
      }
    }

    return prompt;
  }
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return String(value);
  try {
    const sorted = JSON.stringify(value, Object.keys(value as object).sort());
    return sorted;
  } catch {
    return String(value);
  }
}
