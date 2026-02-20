import type { ToolContext, ToolResult } from "../tools/types";
import type { ChatMessage } from "../types";

/**
 * Agent execution step representing a single action
 */
export interface AgentStep {
  /** Step ID */
  id: string;

  /** Step type */
  type: "thought" | "tool_call" | "observation" | "final_answer";

  /** Timestamp */
  timestamp: number;

  /** Thought or reasoning (for thought type) */
  thought?: string;

  /** Tool name (for tool_call type) */
  toolName?: string;

  /** Tool parameters (for tool_call type) */
  toolParams?: unknown;

  /** Tool result (for observation type) */
  toolResult?: ToolResult;

  /** Final answer content (for final_answer type) */
  content?: string;
}

/**
 * Agent execution state
 */
export interface AgentState {
  /** Current execution ID */
  executionId: string;

  /** User's original goal/task */
  goal: string;

  /** Current status */
  status: "idle" | "thinking" | "acting" | "completed" | "failed";

  /** Steps taken so far */
  steps: AgentStep[];

  /** Number of iterations */
  iterations: number;

  /** Maximum iterations allowed */
  maxIterations: number;

  /** Error message if failed */
  error?: string;

  /** Current execution phase */
  executionPhase: "execution" | "response";

  /** Number of tool calls made in this execution */
  toolCallsMade: number;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  maxIterations?: number;

  verbose?: boolean;

  context: ToolContext;

  apiKey?: string;

  baseUrl?: string;

  model?: string;

  temperature?: number;

  maxTotalToolCalls?: number;

  history?: ChatMessage[];
}

/**
 * Agent orchestrator interface
 */
export interface IAgentOrchestrator {
  /**
   * Execute a task using agentic loop
   */
  execute(
    goal: string,
    config: AgentConfig,
  ): AsyncGenerator<AgentStep, void, unknown>;

  /**
   * Get current agent state
   */
  getState(): AgentState;

  /**
   * Stop current execution
   */
  stop(): void;
}

/**
 * Agent event types for UI updates
 */
export type AgentEvent =
  | { type: "step_start"; step: AgentStep }
  | { type: "step_complete"; step: AgentStep }
  | { type: "status_change"; status: AgentState["status"] }
  | { type: "error"; error: string };
