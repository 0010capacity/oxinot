import { z } from "zod";
import { useAISettingsStore } from "../../../stores/aiSettingsStore";
import { useToolApprovalStore } from "../../../stores/toolApprovalStore";
import { toolRegistry } from "./registry";
import type { ToolContext, ToolResult } from "./types";
import { uiEventEmitter } from "./uiEvents";

/**
 * Generate a unique execution ID for tracking
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Wait for approval/denial decision using Zustand store subscription
 */
function waitForApprovalDecision(
  callId: string,
  approvalStore: ReturnType<typeof useToolApprovalStore.getState>,
  timeoutMs: number = 5 * 60 * 1000,
): Promise<"approved" | "denied"> {
  return new Promise((resolve) => {
    let resolved = false;
    let timeoutId: NodeJS.Timeout | null = null;

    const unsubscribe = useToolApprovalStore.subscribe(() => {
      if (resolved) return;

      if (approvalStore.isApproved(callId)) {
        resolved = true;
        clearTimeout(timeoutId!);
        unsubscribe();
        resolve("approved");
      } else if (approvalStore.isDenied(callId)) {
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
  console.log(`[executeTool] Starting execution of tool: '${toolName}'`, {
    params,
    skipApproval: options?.skipApproval || false,
  });

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

  console.log(
    `[executeTool] ✓ Tool '${toolName}' found in registry`,
    `Category: ${tool.category}, Dangerous: ${tool.isDangerous || false}`,
  );

  // Check if approval is required based on policy
  if (!options?.skipApproval) {
    const policy = useAISettingsStore.getState().toolApprovalPolicy;
    let needsApproval = false;

    console.log(`[executeTool] Checking approval policy: '${policy}'`);

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
      console.log(
        `[executeTool] Tool requires approval (dangerous: ${
          tool.isDangerous || false
        }, requiresApproval: ${tool.requiresApproval || false})`,
      );
      const approvalStore = useToolApprovalStore.getState();

      // Add to pending calls
      const callId = approvalStore.addPendingCall({
        toolName: tool.name,
        params: params as Record<string, unknown>,
        description: tool.description,
        requiresApproval: true,
      });

      console.log(
        `[executeTool] Waiting for user approval (callId: ${callId})`,
      );

      return waitForApprovalDecision(callId, approvalStore).then(
        async (decision) => {
          if (decision === "approved") {
            console.log(
              "[executeTool] User approved tool execution, proceeding...",
            );
            return executeTool(toolName, params, context, {
              skipApproval: true,
            });
          }

          const duration = performance.now() - startTime;
          console.warn(
            `[executeTool] User denied tool execution (${duration.toFixed(
              2,
            )}ms)`,
          );
          return {
            success: false,
            error: "Tool execution denied by user",
          };
        },
      );
    }

    console.log(
      "[executeTool] No approval required, proceeding with execution",
    );
  }

  try {
    // Validate parameters against schema
    console.log("[executeTool] Validating parameters against schema...");
    const validatedParams = tool.parameters.parse(params);
    console.log("[executeTool] ✓ Parameters validated");

    // Execute tool
    console.log("[executeTool] Executing tool function...");
    const result = await tool.execute(validatedParams, context);

    const duration = performance.now() - startTime;
    console.log(
      `[executeTool] ✓ Tool execution completed (${duration.toFixed(2)}ms)`,
      {
        success: result.success,
        hasData: !!result.data,
        hasError: !!result.error,
      },
    );

    if (result.success) {
      console.log("[executeTool] Result data:", result.data);
    } else {
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
