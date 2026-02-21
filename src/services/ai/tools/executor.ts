import { z } from "zod";
import { useAISettingsStore } from "../../../stores/aiSettingsStore";
import { useToolApprovalStore } from "../../../stores/toolApprovalStore";
import { toolRegistry } from "./registry";
import type { ToolContext, ToolResult } from "./types";
import { uiEventEmitter } from "./uiEvents";

const TOOL_EXECUTION_TIMEOUT_MS = 30_000;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function executeWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  toolName: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(
          `Tool '${toolName}' execution timed out after ${timeoutMs}ms`,
        ),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

function waitForApprovalDecision(
  callId: string,
  timeoutMs: number = 5 * 60 * 1000,
): Promise<"approved" | "denied"> {
  return new Promise((resolve) => {
    let resolved = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = useToolApprovalStore.subscribe(() => {
      if (resolved) return;

      const currentState = useToolApprovalStore.getState();

      if (currentState.isApproved(callId)) {
        resolved = true;
        clearTimeout(timeoutId!);
        unsubscribe();
        resolve("approved");
      } else if (currentState.isDenied(callId)) {
        resolved = true;
        clearTimeout(timeoutId!);
        unsubscribe();
        resolve("denied");
      }
    });

    timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        unsubscribe();
        resolve("denied");
      }
    }, timeoutMs);
  });
}

/**
 * Execute a tool with parameter validation and optional user approval
 */
export async function executeTool(
  toolName: string,
  params: unknown,
  context: ToolContext,
  options?: { skipApproval?: boolean },
): Promise<ToolResult> {
  const startTime = performance.now();

  // Get tool from registry
  const tool = toolRegistry.get(toolName);

  if (!tool) {
    const duration = performance.now() - startTime;
    console.error(
      `[executeTool] ✗ Tool '${toolName}' not found in registry (${duration.toFixed(
        2,
      )}ms)`,
    );
    return {
      success: false,
      error: `Tool '${toolName}' not found`,
    };
  }

  // Check if approval is required based on policy
  if (!options?.skipApproval) {
    const policy = useAISettingsStore.getState().toolApprovalPolicy;
    let needsApproval = false;

    switch (policy) {
      case "always":
        needsApproval = true;
        break;
      case "dangerous_only":
        needsApproval = tool.isDangerous || tool.requiresApproval || false;
        break;
      case "never":
        needsApproval = false;
        break;
    }

    if (needsApproval) {
      const approvalStore = useToolApprovalStore.getState();

      // Add to pending calls
      const callId = approvalStore.addPendingCall({
        toolName: tool.name,
        params: params as Record<string, unknown>,
        description: tool.description,
        requiresApproval: true,
      });

      return waitForApprovalDecision(callId).then(async (decision) => {
        if (decision === "approved") {
          return executeTool(toolName, params, context, {
            skipApproval: true,
          });
        }

        const duration = performance.now() - startTime;
        console.warn(
          `[executeTool] User denied tool execution (${duration.toFixed(2)}ms)`,
        );
        return {
          success: false,
          error: "Tool execution denied by user",
        };
      });
    }
  }

  try {
    // Validate parameters against schema
    const validatedParams = tool.parameters.parse(params);

    // Execute tool
    const result = await executeWithTimeout(
      tool.execute(validatedParams, context),
      TOOL_EXECUTION_TIMEOUT_MS,
      toolName,
    );

    if (!result.success) {
      console.warn("[executeTool] Result error:", result.error);
    }

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    console.error(
      `[executeTool] ✗ Tool execution failed (${duration.toFixed(
        2,
      )}ms): ${errorMessage}`,
    );
    if (error instanceof Error && error.stack) {
      console.error("[executeTool] Stack trace:", error.stack);
    }
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      const validationErrors = error.errors.map((e) => e.message).join(", ");
      console.error("[executeTool] Validation errors:", validationErrors);
      return {
        success: false,
        error: `Invalid parameters: ${validationErrors}`,
      };
    }

    // Emit execution failed event
    uiEventEmitter.emit({
      type: "tool_execution_failed",
      timestamp: new Date(),
      payload: {
        toolName,
        executionId: generateId(),
        error: errorMessage,
      },
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Batch execute multiple tools
 */
export async function executeTools(
  calls: Array<{ toolName: string; params: unknown }>,
  context: ToolContext,
): Promise<ToolResult[]> {
  return Promise.all(
    calls.map(({ toolName, params }) => executeTool(toolName, params, context)),
  );
}
