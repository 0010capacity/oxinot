import { z } from "zod";
import { toolRegistry } from "./registry";
import type { ToolResult, ToolContext } from "./types";
import { useToolApprovalStore } from "../../../stores/toolApprovalStore";
import { useAISettingsStore } from "../../../stores/aiSettingsStore";

/**
 * Execute a tool with parameter validation and optional user approval
 */
export async function executeTool<
  T extends Record<string, unknown> = Record<string, unknown>
>(
  toolName: string,
  params: unknown,
  context: ToolContext,
  options?: { skipApproval?: boolean }
): Promise<ToolResult<T>> {
  // Get tool from registry
  const tool = toolRegistry.get(toolName);

  if (!tool) {
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

      // Wait for approval or denial via polling
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (approvalStore.isApproved(callId)) {
            clearInterval(checkInterval);

            // Execute tool after approval (skip approval this time)
            executeTool<T>(toolName, params, context, {
              skipApproval: true,
            }).then(resolve);
          } else if (approvalStore.isDenied(callId)) {
            clearInterval(checkInterval);
            resolve({
              success: false,
              error: "Tool execution denied by user",
            });
          }
        }, 100);
      });
    }
  }

  try {
    // Validate parameters against schema
    const validatedParams = tool.parameters.parse(params);

    // Execute tool
    const result = await tool.execute(validatedParams, context);

    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `Invalid parameters: ${error.errors
          .map((e) => e.message)
          .join(", ")}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Batch execute multiple tools
 */
export async function executeTools(
  calls: Array<{ toolName: string; params: unknown }>,
  context: ToolContext
): Promise<ToolResult[]> {
  return Promise.all(
    calls.map(({ toolName, params }) => executeTool(toolName, params, context))
  );
}
