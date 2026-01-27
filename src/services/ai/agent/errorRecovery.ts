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
  /** Retry same action */
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
  /** Suggested recovery strategy */
  suggestedStrategy: RecoveryStrategy;
  /** Optional guidance for recovery */
  guidance?: string;
}

/**
 * Classify error and determine recovery strategy
 */
export function classifyError(error: Error | string | ToolResult): ErrorInfo {
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
    const toolResult = error as ToolResult;
    message = toolResult.error || "Tool execution failed";
  } else {
    message = String(error);
  }

  const lowerMessage = message.toLowerCase();

  // Classify error by message pattern
  if (
    lowerMessage.includes("not found") ||
    lowerMessage.includes("not exist") ||
    lowerMessage.includes("doesn't exist")
  ) {
    category = ErrorCategory.NOT_FOUND;
    severity = ErrorSeverity.RECOVERABLE;
    suggestedStrategy = RecoveryStrategy.ALTERNATIVE;
    guidance =
      "The resource was not found. Check if it exists, or try a different name or identifier.";
  } else if (
    lowerMessage.includes("invalid") ||
    lowerMessage.includes("malformed") ||
    lowerMessage.includes("parse error")
  ) {
    category = ErrorCategory.INVALID_INPUT;
    severity = ErrorSeverity.RECOVERABLE;
    suggestedStrategy = RecoveryStrategy.ALTERNATIVE;
    guidance =
      "The input format or structure is incorrect. Fix format or provide correct input.";
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
      "Validation failed. Fix indentation (2 spaces per level), ensure all lines start with '- ', or regenerate structure.";
  } else if (
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("network") ||
    lowerMessage.includes("connection")
  ) {
    category = ErrorCategory.TOOL_EXECUTION;
    severity = ErrorSeverity.TRANSIENT;
    suggestedStrategy = RecoveryStrategy.RETRY;
    guidance = "Temporary network error. Safe to retry a few times.";
  } else if (
    lowerMessage.includes("invalid tool") ||
    lowerMessage.includes("unknown tool")
  ) {
    category = ErrorCategory.INVALID_TOOL;
    severity = ErrorSeverity.RECOVERABLE;
    suggestedStrategy = RecoveryStrategy.ALTERNATIVE;
    guidance = `Tool '${extractToolName(
      error
    )}' is not available. Use a different tool.`;
  } else if (
    lowerMessage.includes("api") ||
    lowerMessage.includes("openai") ||
    lowerMessage.includes("anthropic") ||
    lowerMessage.includes("ai provider")
  ) {
    category = ErrorCategory.AI_PROVIDER;
    severity = ErrorSeverity.TRANSIENT;
    suggestedStrategy = RecoveryStrategy.RETRY;
    guidance = "AI provider issue. May be temporary. Safe to retry once.";
  } else if (lowerMessage.includes("tool execution failed")) {
    category = ErrorCategory.TOOL_EXECUTION;
    severity = ErrorSeverity.RECOVERABLE;
    suggestedStrategy = RecoveryStrategy.ALTERNATIVE;
    guidance =
      "Tool execution failed. Try a different approach or alternative tool.";
  }

  return {
    message,
    category,
    severity,
    suggestedStrategy,
    guidance,
  };
}

/**
 * Extract tool name from error message for better error messages
 */
function extractToolName(
  error: Error | string | ToolResult
): string | undefined {
  if (typeof error === "string") {
    const match = error.match(/tool ['"]([^'"]+)['"]/);
    return match ? match[1] : undefined;
  }
  return undefined;
}

/**
 * Determine if an error is recoverable
 */
export function isRecoverable(errorInfo: ErrorInfo): boolean {
  return errorInfo.severity !== ErrorSeverity.FATAL;
}

/**
 * Get recovery guidance message for AI (simple format)
 */
export function getRecoveryGuidance(errorInfo: ErrorInfo): string {
  const { message, category, suggestedStrategy, guidance } = errorInfo;

  let recoveryMsg = `**Error occurred** (${category}):\n${message}\n\n`;

  if (guidance) {
    recoveryMsg += `**Guidance**: ${guidance}\n\n`;
  }

  switch (suggestedStrategy) {
    case RecoveryStrategy.RETRY:
      recoveryMsg += `**Recovery**: Retrying the same action...\n`;
      break;
    case RecoveryStrategy.ALTERNATIVE:
      recoveryMsg += `**Recovery**: Trying an alternative approach or tool...\n`;
      break;
    case RecoveryStrategy.CLARIFY:
      recoveryMsg += `**Recovery**: Requesting clarification from user about: ${message}\n`;
      break;
    case RecoveryStrategy.SKIP:
      recoveryMsg +=
        "**Recovery**: Skipping this step, trying next approach...\n";
      break;
    case RecoveryStrategy.ROLLBACK:
      recoveryMsg += "**Recovery**: Rolling back changes and restarting...\n";
      break;
    case RecoveryStrategy.ABORT:
      recoveryMsg +=
        "**Recovery**: Cannot recover from this error. Task aborted.\n";
      break;
    default:
      recoveryMsg +=
        "**Recovery**: Unknown strategy - please try an alternative approach.\n";
  }

  return recoveryMsg;
}
