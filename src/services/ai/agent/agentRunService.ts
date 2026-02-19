import type { AIProvider } from "@/stores/aiSettingsStore";
import { createAIProvider } from "../factory";
import type { ToolContext, ToolResult } from "../tools/types";
import { AgentOrchestrator } from "./orchestrator";
import type { AgentConfig } from "./types";

export type AgentRunEvent =
  | { type: "thought"; content: string }
  | { type: "tool_call"; toolName: string; params: unknown }
  | { type: "tool_result"; toolName: string; result: ToolResult }
  | { type: "streaming"; delta: string }
  | { type: "done"; content: string }
  | { type: "error"; error: string };

export interface AgentRunConfig {
  goal: string;
  context: ToolContext;
  provider: AIProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  abortSignal?: AbortSignal;
  maxIterations?: number;
  maxTotalToolCalls?: number;
}

export interface AgentRunResult {
  content: string | null;
  error: string | null;
  aborted: boolean;
}

export class AgentRunService {
  private orchestrator: AgentOrchestrator | null = null;
  private aborted = false;

  async run(
    config: AgentRunConfig,
    onEvent: (event: AgentRunEvent) => void,
  ): Promise<AgentRunResult> {
    this.aborted = false;

    if (config.abortSignal?.aborted) {
      return { content: null, error: null, aborted: true };
    }

    const abortHandler = () => {
      this.aborted = true;
      this.orchestrator?.stop();
    };
    config.abortSignal?.addEventListener("abort", abortHandler);

    try {
      const aiProvider = createAIProvider(
        config.provider,
        config.baseUrl || "",
      );
      aiProvider.id = config.provider;

      this.orchestrator = new AgentOrchestrator(aiProvider);

      const orchestratorConfig: AgentConfig = {
        context: config.context,
        model: config.model,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        temperature: config.temperature,
        maxIterations: config.maxIterations ?? 50,
        maxTotalToolCalls: config.maxTotalToolCalls ?? 16,
      };

      let finalContent: string | null = null;
      let lastStreamingText = "";
      let lastToolName = "";

      for await (const step of this.orchestrator.execute(
        config.goal,
        orchestratorConfig,
      )) {
        if (this.aborted) {
          return { content: null, error: null, aborted: true };
        }

        if (step.type === "tool_call" && step.toolName) {
          lastToolName = step.toolName;
          onEvent({
            type: "tool_call",
            toolName: step.toolName,
            params: step.toolParams,
          });
        } else if (step.type === "thought" && step.thought) {
          onEvent({ type: "thought", content: step.thought });
        } else if (step.type === "observation" && step.toolResult) {
          onEvent({
            type: "tool_result",
            toolName: lastToolName,
            result: step.toolResult,
          });
        } else if (step.type === "final_answer" && step.content) {
          const delta = step.content.slice(lastStreamingText.length);
          if (delta) {
            onEvent({ type: "streaming", delta });
          }
          lastStreamingText = step.content;
          finalContent = step.content;
        }
      }

      const state = this.orchestrator.getState();

      if (this.aborted) {
        return { content: null, error: null, aborted: true };
      }

      if (state.status === "failed") {
        const errorMsg = state.error || "Execution failed";
        onEvent({ type: "error", error: errorMsg });
        return { content: null, error: errorMsg, aborted: false };
      }

      if (finalContent) {
        onEvent({ type: "done", content: finalContent });
      }

      return { content: finalContent, error: null, aborted: false };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      onEvent({ type: "error", error: errorMsg });
      return { content: null, error: errorMsg, aborted: false };
    } finally {
      config.abortSignal?.removeEventListener("abort", abortHandler);
      this.orchestrator = null;
    }
  }

  abort(): void {
    this.aborted = true;
    this.orchestrator?.stop();
  }
}

let instance: AgentRunService | null = null;

export function getAgentRunService(): AgentRunService {
  if (!instance) {
    instance = new AgentRunService();
  }
  return instance;
}
