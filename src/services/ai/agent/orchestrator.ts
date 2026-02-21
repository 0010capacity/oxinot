import { useBlockStore } from "../../../stores/blockStore";
import { useBlockUIStore } from "../../../stores/blockUIStore";
import { usePageStore } from "../../../stores/pageStore";
import { executeTool } from "../tools/executor";
import { toolRegistry } from "../tools/registry";
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

const DEFAULT_MAX_ITERATIONS = 10;
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
      executionPhase: "execution" as const,
      toolCallsMade: 0,
    };
  }

  async *execute(
    goal: string,
    config: AgentConfig,
  ): AsyncGenerator<AgentStep, void, unknown> {
    this.shouldStop = false;
    this.toolCallHistory = [];
    this.emptyResponseCount = 0;

    const maxIterations = config.maxIterations || DEFAULT_MAX_ITERATIONS;

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
      executionPhase: "execution" as const,
      toolCallsMade: 0,
    };

    const allTools = toolRegistry.getAll();
    const systemPrompt = this.buildSystemPrompt(config);
    const conversationHistory: ChatMessage[] = config.history
      ? [...config.history]
      : [];

    try {
      while (
        this.state.iterations < this.state.maxIterations &&
        !this.shouldStop
      ) {
        this.state.iterations++;

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
            tools: allTools.length > 0 ? allTools : undefined,
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

              this.state.toolCallsMade++;

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

            continue;
          }

          if (accumulatedText.trim()) {
            this.emptyResponseCount = 0;
            const finalStep = this.createFinalStep(accumulatedText);
            this.state.steps.push(finalStep);
            this.state.status = "completed";

            yield finalStep;
            break;
          }

          this.emptyResponseCount++;

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
        this.state.status = "failed";
        this.state.error = "Execution stopped by user";
      }
    } finally {
    }
  }

  getState(): AgentState {
    return { ...this.state };
  }

  stop(): void {
    this.shouldStop = true;
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
