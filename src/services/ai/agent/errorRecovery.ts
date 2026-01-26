/**
 * Error Recovery System for Agent Orchestrator
 *
 * Provides intelligent error classification, recovery strategy selection,
 * and automatic retry logic with alternative approaches.
 */

import type { ToolResult } from "../tools/types";

/**
 * Severity levels for errors
 */
export enum ErrorSeverity {
  /** Recoverable with alternative approach */
  RECOVERABLE = "recoverable",
  /** Temporary issue, safe to retry */
  TRANSIENT = "transient",
  /** Fatal error, cannot recover */
  FATAL = "fatal",
}

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  /** Tool not found or invalid parameters */
  INVALID_TOOL = "invalid_tool",
  /** Tool execution failed (network, validation, etc.) */
  TOOL_EXECUTION = "tool_execution",
  /** Markdown/content validation failed */
  VALIDATION = "validation",
  /** Resource not found (page, block, etc.) */
  NOT_FOUND = "not_found",
  /** Permission or access denied */
  PERMISSION = "permission",
  /** Invalid input or state */
  INVALID_INPUT = "invalid_input",
  /** AI provider error */
  AI_PROVIDER = "ai_provider",
  /** Unknown error */
  UNKNOWN = "unknown",
}

/**
 * Recovery strategies
 */
export enum RecoveryStrategy {
  /** Retry the same action */
  RETRY = "retry",
  /** Try alternative tool or approach */
  ALTERNATIVE = "alternative",
  /** Request user clarification */
  CLARIFY = "clarify",
  /** Skip this step and try next approach */
  SKIP = "skip",
  /** Rollback changes and restart */
  ROLLBACK = "rollback",
  /** Give up, cannot recover */
  ABORT = "abort",
}

/**
 * Error information
 */
export interface ErrorInfo {
  /** Original error message */
  message: string;
  /** Error category */
  category: ErrorCategory;
  /** Severity level */
  severity: ErrorSeverity;
  /** Context about what was happening */
  context: {
    /** Tool that was called */
    toolName?: string;
    /** Tool parameters that caused the error */
    toolParams?: unknown;
    /** Previous failures (for retry logic) */
    attemptCount?: number;
    /** User's goal/intent */
    goal?: string;
  };
  /** Suggested recovery strategy */
  suggestedStrategy: RecoveryStrategy;
  /** Optional guidance for recovery */
  guidance?: string;
}

/**
 * Classify error and determine recovery strategy
 */
export function classifyError(
  error: Error | string | ToolResult,
  context?: {
    toolName?: string;
    toolParams?: unknown;
    goal?: string;
    attemptCount?: number;
  }
): ErrorInfo {
  let message: string;
  let category: ErrorCategory = ErrorCategory.UNKNOWN;
  let severity: ErrorSeverity = ErrorSeverity.FATAL;
  let suggestedStrategy: RecoveryStrategy = RecoveryStrategy.ABORT;
  let guidance: string | undefined;

  // Extract error message
  if (typeof error === "string") {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "object" && error !== null && "error" in error) {
    message = String((error as { error: unknown }).error);
  } else {
    message = JSON.stringify(error);
  }

  const lowerMessage = message.toLowerCase();
  const toolName = context?.toolName;
  const attemptCount = context?.attemptCount ?? 1;

  // Classify error by message pattern
  if (
    lowerMessage.includes("not found") ||
    lowerMessage.includes("not exist")
  ) {
    category = ErrorCategory.NOT_FOUND;
    severity = ErrorSeverity.RECOVERABLE;
    suggestedStrategy = RecoveryStrategy.CLARIFY;
    guidance =
      "The resource was not found. Ask user for clarification or try alternative resource.";
  } else if (
    lowerMessage.includes("invalid") ||
    lowerMessage.includes("malformed")
  ) {
    category = ErrorCategory.INVALID_INPUT;
    severity = ErrorSeverity.RECOVERABLE;
    suggestedStrategy = RecoveryStrategy.ALTERNATIVE;
    guidance =
      "Invalid input provided. Try correcting the input or use alternative tool.";
  } else if (
    lowerMessage.includes("permission") ||
    lowerMessage.includes("denied") ||
    lowerMessage.includes("unauthorized")
  ) {
    category = ErrorCategory.PERMISSION;
    severity = ErrorSeverity.FATAL;
    suggestedStrategy = RecoveryStrategy.ABORT;
    guidance =
      "Permission denied. Cannot recover without proper access rights.";
  } else if (
    lowerMessage.includes("validation") ||
    lowerMessage.includes("indent") ||
    lowerMessage.includes("structure")
  ) {
    category = ErrorCategory.VALIDATION;
    severity = ErrorSeverity.RECOVERABLE;
    suggestedStrategy = RecoveryStrategy.ALTERNATIVE;
    guidance =
      "Validation failed. Regenerate with corrected structure or try alternative tool.";
  } else if (
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("network") ||
    lowerMessage.includes("connection")
  ) {
    category = ErrorCategory.TOOL_EXECUTION;
    severity = ErrorSeverity.TRANSIENT;
    suggestedStrategy =
      attemptCount < 3 ? RecoveryStrategy.RETRY : RecoveryStrategy.ABORT;
    guidance = "Temporary network error. Safe to retry.";
  } else if (
    lowerMessage.includes("invalid tool") ||
    lowerMessage.includes("unknown tool")
  ) {
    category = ErrorCategory.INVALID_TOOL;
    severity = ErrorSeverity.RECOVERABLE;
    suggestedStrategy = RecoveryStrategy.ALTERNATIVE;
    guidance = `Tool '${toolName}' not available. Use alternative tool or check tool name.`;
  } else if (
    lowerMessage.includes("ai provider") ||
    lowerMessage.includes("api") ||
    lowerMessage.includes("openai") ||
    lowerMessage.includes("anthropic")
  ) {
    category = ErrorCategory.AI_PROVIDER;
    severity = ErrorSeverity.TRANSIENT;
    suggestedStrategy =
      attemptCount < 2 ? RecoveryStrategy.RETRY : RecoveryStrategy.ABORT;
    guidance = "AI provider issue. May be temporary. Safe to retry once.";
  } else if (lowerMessage.includes("tool execution failed")) {
    category = ErrorCategory.TOOL_EXECUTION;
    severity = ErrorSeverity.RECOVERABLE;
    suggestedStrategy = RecoveryStrategy.ALTERNATIVE;
    guidance = "Tool execution failed. Try alternative approach or tool.";
  }

  return {
    message,
    category,
    severity,
    context: {
      toolName,
      toolParams: context?.toolParams,
      goal: context?.goal,
      attemptCount,
    },
    suggestedStrategy,
    guidance,
  };
}

/**
 * Determine if an error is recoverable
 */
export function isRecoverable(errorInfo: ErrorInfo): boolean {
  return errorInfo.severity !== ErrorSeverity.FATAL;
}

/**
 * Get recovery guidance message for user/AI
 */
export function getRecoveryGuidance(errorInfo: ErrorInfo): string {
  const { message, category, suggestedStrategy, guidance, context } = errorInfo;

  let recoveryMsg = `**Error occurred** (${category}):\n${message}\n\n`;

  if (guidance) {
    recoveryMsg += `**What happened**: ${guidance}\n\n`;
  }

  switch (suggestedStrategy) {
    case RecoveryStrategy.RETRY:
      recoveryMsg += `**Recovery**: Retrying the same action (attempt ${
        context.attemptCount || 1
      })...`;
      break;
    case RecoveryStrategy.ALTERNATIVE:
      recoveryMsg += "**Recovery**: Trying alternative approach or tool...";
      break;
    case RecoveryStrategy.CLARIFY:
      recoveryMsg += `**Recovery**: Need clarification from user about: ${message}`;
      break;
    case RecoveryStrategy.SKIP:
      recoveryMsg +=
        "**Recovery**: Skipping this step, trying next approach...";
      break;
    case RecoveryStrategy.ROLLBACK:
      recoveryMsg += "**Recovery**: Rolling back changes and restarting...";
      break;
    case RecoveryStrategy.ABORT:
      recoveryMsg +=
        "**Recovery**: Cannot recover from this error. Task aborted.";
      break;
  }

  return recoveryMsg;
}

/**
 * Generate alternative approach prompt for AI
 *
 * Tells the AI to try a different strategy based on the error
 */
export function getAlternativeApproachPrompt(
  errorInfo: ErrorInfo,
  originalGoal: string
): string {
  const { category, context } = errorInfo;
  let prompt =
    "The previous attempt encountered an error:\n" +
    `- Error type: ${category}\n` +
    `- Tool: ${context.toolName || "N/A"}\n` +
    `- Message: ${errorInfo.message}\n\n`;

  prompt += `Original goal: ${originalGoal}\n\n`;

  switch (category) {
    case ErrorCategory.NOT_FOUND:
      prompt +=
        "Try these alternatives:\n" +
        "1. Ask clarification about which resource to use\n" +
        "2. List available resources first to see what exists\n" +
        "3. Use a more specific or corrected resource name";
      break;

    case ErrorCategory.VALIDATION:
      prompt +=
        "Try these alternatives:\n" +
        "1. Regenerate the markdown with correct indentation (2 spaces per level)\n" +
        '2. Ensure each line starts with "- " (dash + space)\n' +
        "3. Validate again before attempting to create";
      break;

    case ErrorCategory.INVALID_INPUT:
      prompt +=
        "Try these alternatives:\n" +
        "1. Correct the input format or structure\n" +
        "2. Use a different, simpler format\n" +
        "3. Request clarification about the expected input format";
      break;

    case ErrorCategory.INVALID_TOOL:
      prompt +=
        "Try these alternatives:\n" +
        "1. Use a different tool that achieves the same result\n" +
        "2. Break down the task to use basic tools instead\n" +
        "3. List available tools to verify the correct name";
      break;

    case ErrorCategory.TOOL_EXECUTION:
      prompt +=
        "The tool failed to execute. Try these alternatives:\n" +
        "1. Simplify the parameters\n" +
        "2. Break the operation into smaller steps\n" +
        "3. Try a different tool that achieves similar results";
      break;

    default:
      prompt += `Try a different approach or break down the task into smaller steps.`;
  }

  prompt +=
    `\n\nRemember: Your goal is to complete: "${originalGoal}". ` +
    `Use the available tools and try alternative approaches if one fails.`;

  return prompt;
}

/**
 * Categorize error from tool result
 *
 * Useful when a tool returns success=false
 */
export function categorizeToolError(
  result: ToolResult,
  toolName?: string
): ErrorInfo {
  const message = result.error || "Tool execution failed";

  return classifyError(message, {
    toolName,
    attemptCount: 1,
  });
}
