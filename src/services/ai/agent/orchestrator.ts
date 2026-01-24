import { executeTool } from "../tools/executor";
import { toolRegistry } from "../tools/registry";
import type { ChatMessage, IAIProvider } from "../types";
import type {
  AgentConfig,
  AgentState,
  AgentStep,
  IAgentOrchestrator,
} from "./types";
import { useBlockStore } from "../../../stores/blockStore";
import { usePageStore } from "../../../stores/pageStore";
import { useBlockUIStore } from "../../../stores/blockUIStore";

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
      maxIterations: config.maxIterations || 10,
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

    let systemPrompt = `You are an AI agent integrated into 'Oxinot', a block-based outliner application.

CRITICAL INSTRUCTIONS:
1. You are an AGENT, not just a chatbot. Your job is to COMPLETE TASKS using the provided tools.
2. When the user asks you to create, update, delete, or modify content, you MUST use the appropriate tools.
3. ALWAYS read the current state first (e.g., use get_page_blocks) before making changes.
4. Plan your actions BEFORE executing tools to avoid redundant operations.
5. Use the most efficient tool for the task - don't create blocks then delete them unnecessarily.
6. After using a tool, evaluate the result and decide if you need to use another tool or if the task is complete.
7. Only provide a final text answer when the task is truly complete or if you need clarification from the user.
8. DO NOT just describe what you would do - ACTUALLY DO IT using the tools.

EFFICIENCY GUIDELINES:
- Check what already exists before creating new content
- Avoid creating duplicate blocks that will be deleted
- Use update_block when possible instead of delete + create
- Batch related operations when you can
- Verify your work is complete before reporting success

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
