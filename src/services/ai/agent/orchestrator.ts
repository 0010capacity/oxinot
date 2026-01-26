import { useBlockStore } from "../../../stores/blockStore";
import { useBlockUIStore } from "../../../stores/blockUIStore";
import { usePageStore } from "../../../stores/pageStore";
import { useCopilotUiStore } from "../../../stores/copilotUiStore";
import { executeTool } from "../tools/executor";
import { toolRegistry } from "../tools/registry";
import type { ChatMessage, IAIProvider } from "../types";
import {
  RecoveryStrategy,
  categorizeToolError,
  getAlternativeApproachPrompt,
  getRecoveryGuidance,
  isRecoverable,
} from "./errorRecovery";
import systemPromptTemplate from "./system-prompt.md?raw";
import type {
  AgentConfig,
  AgentState,
  AgentStep,
  IAgentOrchestrator,
} from "./types";

interface ErrorContext {
  toolName?: string;
  toolParams?: unknown;
  attemptCount: number;
}

export class AgentOrchestrator implements IAgentOrchestrator {
  private state: AgentState;
  private aiProvider: IAIProvider;
  private shouldStop = false;
  private errorContexts: Map<string, ErrorContext> = new Map();

  // System prompt caching
  private cachedSystemPrompt: string | null = null;
  private lastContextHash: string | null = null;

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
    config: AgentConfig
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

    this.errorContexts.clear();

    console.log(
      `[AgentOrchestrator] Starting execution ${executionId} with goal: "${goal}"`
    );

    // Initialize UI store for progress tracking
    const copilotUiStore = useCopilotUiStore.getState();

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
          `\n[AgentOrchestrator] ═══════════════════════════════════════`
        );
        console.log(
          `[AgentOrchestrator] Iteration ${this.state.iterations}/${this.state.maxIterations}`
        );
        console.log(
          `[AgentOrchestrator] ═══════════════════════════════════════`
        );

        this.state.status = "thinking";

        // Update UI: thinking phase
        copilotUiStore.setCurrentStep("thinking");

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

              const toolStartTime = Date.now();
              const paramsJson = JSON.stringify(params, null, 2);
              console.log(
                `[AgentOrchestrator] Tool Called (Iter ${this.state.iterations}): ${toolName}`
              );
              console.log(`[AgentOrchestrator] Parameters:`, paramsJson);

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

              // Update UI: tool execution phase
              copilotUiStore.setCurrentStep("tool_call", toolName);

              const result = await executeTool(
                toolName,
                params,
                config.context
              );

              // Update UI: observation phase
              copilotUiStore.setCurrentStep("observation");

              const toolDuration = Date.now() - toolStartTime;
              const resultStatus = result.success ? "✓ Success" : "✗ Failed";
              console.log(
                `[AgentOrchestrator] Tool Result: ${toolName} ${resultStatus} (${toolDuration}ms)`
              );
              if (result.success && result.data) {
                const dataPreview = JSON.stringify(result.data).substring(
                  0,
                  200
                );
                console.log(`[AgentOrchestrator] Result Data:`, dataPreview);
              } else if (!result.success) {
                console.log(`[AgentOrchestrator] Error: ${result.error}`);
              }

              // Handle tool execution errors with recovery logic
              if (!result.success) {
                return this.handleToolError(
                  result,
                  toolName,
                  params,
                  conversationHistory,
                  goal
                );
              }

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

              // Add tool result to conversation history so AI knows what happened
              if (!result.success) {
                // For failures, provide clear error message
                conversationHistory.push({
                  role: "user",
                  content: `Tool '${toolName}' execution failed: ${
                    result.error || "Unknown error"
                  }. Please try an alternative approach.`,
                });
              } else {
                // For successes, provide result summary with important data
                let resultSummary = `Tool '${toolName}' executed successfully.`;
                if (
                  result.metadata?.message &&
                  typeof result.metadata.message === "string"
                ) {
                  resultSummary = result.metadata.message;
                }

                // Include important tool result data so AI can proceed correctly
                if (result.data) {
                  if (
                    toolName === "create_page" &&
                    typeof result.data === "object" &&
                    result.data !== null &&
                    "id" in result.data
                  ) {
                    const pageData = result.data as {
                      id: string;
                      title?: string;
                      parentId?: string | null;
                    };
                    resultSummary += `\n\nPage created with ID: ${pageData.id}`;
                    if (pageData.title) {
                      resultSummary += `\nPage title: ${pageData.title}`;
                    }
                    if (pageData.parentId) {
                      resultSummary += `\nParent page ID: ${pageData.parentId}`;
                    }
                  } else {
                    // For other tools, include data as JSON for full visibility
                    try {
                      const dataPreview = JSON.stringify(result.data);
                      resultSummary += `\n\nResult data: ${dataPreview}`;
                    } catch {
                      // Fallback if data is not serializable
                    }
                  }
                }

                conversationHistory.push({
                  role: "user",
                  content: resultSummary,
                });
              }

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

          if (accumulatedText.trim()) {
            console.log(
              `[AgentOrchestrator] AI Response (Iter ${
                this.state.iterations
              }): ${accumulatedText.substring(0, 150)}...`
            );
          }

          const toolCalls = pendingSteps
            .filter((step) => step.type === "tool_call")
            .map((step) => step.toolName)
            .filter(Boolean);

          if (toolCalls.length > 0) {
            console.log(
              `[AgentOrchestrator] Tools Called This Iteration: ${toolCalls.join(
                " → "
              )}`
            );
          }

          for (const step of pendingSteps) {
            yield step;
          }
          pendingSteps.length = 0;

          if (accumulatedText.trim() && !toolWasCalled) {
            finalAnswerReceived = true;

            // Update UI: final answer generation phase
            copilotUiStore.setCurrentStep("final");

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
              "[AgentOrchestrator] Execution complete: Final answer received"
            );

            yield finalStep;
            break;
          }

          if (!toolWasCalled && !finalAnswerReceived) {
            const responsePreview = accumulatedText
              .substring(0, 100)
              .replace(/\n/g, " ");
            console.log(
              `[AgentOrchestrator] Iter ${this.state.iterations}: No tool call detected. Response: "${responsePreview}"`
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
        console.log(`[AgentOrchestrator] Tool Usage Summary:`);
        const toolUsage: Record<string, number> = {};
        for (const step of this.state.steps) {
          if (step.type === "tool_call" && step.toolName) {
            toolUsage[step.toolName] = (toolUsage[step.toolName] || 0) + 1;
          }
        }
        Object.entries(toolUsage).forEach(([tool, count]) => {
          console.log(`  - ${tool}: ${count} times`);
        });
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
        `[AgentOrchestrator] ═══════════════════════════════════════`
      );
      console.log(
        `[AgentOrchestrator] Execution ${executionId} finished with status: ${this.state.status}`
      );

      const toolUsageMap: Record<string, number> = {};
      const toolSequence: string[] = [];
      for (const step of this.state.steps) {
        if (step.type === "tool_call" && step.toolName) {
          toolUsageMap[step.toolName] = (toolUsageMap[step.toolName] || 0) + 1;
          toolSequence.push(step.toolName);
        }
      }

      if (toolSequence.length > 0) {
        console.log(`[AgentOrchestrator] Tool Sequence:`);
        console.log(`  ${toolSequence.join(" → ")}`);
        console.log(`[AgentOrchestrator] Tool Call Summary:`);
        for (const [tool, count] of Object.entries(toolUsageMap)) {
          console.log(`  - ${tool}: ${count} call(s)`);
        }
      }

      console.log(
        `[AgentOrchestrator] Total iterations: ${this.state.iterations}/${this.state.maxIterations}`
      );
      console.log(
        `[AgentOrchestrator] ═══════════════════════════════════════\n`
      );
    }
  }

  /**
   * Handle tool execution errors with intelligent recovery
   */
  private async handleToolError(
    result: any,
    toolName: string,
    params: unknown,
    conversationHistory: ChatMessage[],
    goal: string
  ): Promise<any> {
    console.log(
      `[AgentOrchestrator] Handling tool error from ${toolName}:`,
      result.error
    );

    // Categorize the error
    const errorInfo = categorizeToolError(result, toolName);
    const isRecoverableError = isRecoverable(errorInfo);

    // Track error attempts for this tool
    const errorKey = toolName;
    const context = this.errorContexts.get(errorKey) || {
      toolName,
      toolParams: params,
      attemptCount: 0,
    };
    context.attemptCount += 1;
    this.errorContexts.set(errorKey, context);

    console.log(
      `[AgentOrchestrator] Error classified as: ${errorInfo.category} (severity: ${errorInfo.severity})`
    );

    if (!isRecoverableError) {
      console.error(
        `[AgentOrchestrator] Fatal error, cannot recover: ${errorInfo.message}`
      );
      // Return the failed result to stop execution
      return result;
    }

    // Determine recovery strategy
    const strategy = errorInfo.suggestedStrategy;
    console.log(`[AgentOrchestrator] Suggested recovery strategy: ${strategy}`);

    // Generate recovery guidance
    const recoveryGuidance = getRecoveryGuidance(errorInfo);

    // Add recovery context to conversation
    conversationHistory.push({
      role: "assistant",
      content: `Tool call failed: ${toolName}`,
    });

    switch (strategy) {
      case RecoveryStrategy.RETRY:
        // Retry the same tool call
        console.log(`[AgentOrchestrator] Retrying tool ${toolName}`);
        conversationHistory.push({
          role: "user",
          content: `${recoveryGuidance}\n\nRetrying: ${toolName}`,
        });
        // Let orchestrator retry on next iteration
        return result;

      case RecoveryStrategy.ALTERNATIVE:
        // Ask AI to try alternative approach
        console.log(
          `[AgentOrchestrator] Requesting alternative approach instead of ${toolName}`
        );
        const altPrompt = getAlternativeApproachPrompt(errorInfo, goal);
        conversationHistory.push({
          role: "user",
          content: altPrompt,
        });
        return result;

      case RecoveryStrategy.CLARIFY:
        // Ask for user clarification
        console.log(
          `[AgentOrchestrator] Need clarification for tool ${toolName}`
        );
        conversationHistory.push({
          role: "user",
          content:
            `${recoveryGuidance}\n\n` +
            `Please ask the user for clarification or try a different approach.`,
        });
        return result;

      case RecoveryStrategy.SKIP:
        // Skip this step and continue
        console.log(`[AgentOrchestrator] Skipping tool ${toolName}`);
        conversationHistory.push({
          role: "user",
          content: `${recoveryGuidance}\n\nSkipping this step, let's try a different approach.`,
        });
        return { success: true, message: "Skipped", data: null };

      case RecoveryStrategy.ABORT:
      default:
        // Give up
        console.log(`[AgentOrchestrator] Aborting due to error in ${toolName}`);
        return result;
    }
  }

  getState(): AgentState {
    return { ...this.state };
  }

  stop(): void {
    console.log("[AgentOrchestrator] Stop requested");
    this.shouldStop = true;
    this.aiProvider.abort?.();
  }

  private getContextHash(): string {
    const blockStore = useBlockStore.getState();
    const uiStore = useBlockUIStore.getState();
    return `${blockStore.currentPageId}-${uiStore.focusedBlockId || "none"}`;
  }

  private buildSystemPrompt(_config: AgentConfig): string {
    const contextHash = this.getContextHash();

    // Return cached prompt if context hasn't changed
    if (this.cachedSystemPrompt && this.lastContextHash === contextHash) {
      return this.cachedSystemPrompt;
    }

    const blockStore = useBlockStore.getState();
    const pageStore = usePageStore.getState();
    const uiStore = useBlockUIStore.getState();

    // Load system prompt from external markdown file
    let systemPrompt = systemPromptTemplate;

    // Add dynamic context
    systemPrompt += "\n\n## Dynamic Context\n\n";

    const focusedId = uiStore.focusedBlockId;
    if (focusedId != null) {
      const block = blockStore.blocksById[focusedId];
      if (block) {
        systemPrompt += `- **Current focused block**: "${block.content}" (ID: ${focusedId})\n`;
      }
    }

    const pageId = blockStore.currentPageId;
    if (pageId != null) {
      const page = pageStore.pagesById[pageId];
      const pageTitle = page?.title || "Untitled";
      systemPrompt += `- **Current page**: "${pageTitle}" (ID: ${pageId})\n`;
    }

    // Cache the prompt
    this.cachedSystemPrompt = systemPrompt;
    this.lastContextHash = contextHash;

    return systemPrompt;
  }
}
