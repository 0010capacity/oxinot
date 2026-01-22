import { z } from "zod";
import { toolRegistry } from "./registry";
import type { ToolResult, ToolContext } from "./types";
import { useToolApprovalStore } from "../../../stores/toolApprovalStore";
import { useAISettingsStore } from "../../../stores/aiSettingsStore";

/**
 * Execute a tool with parameter validation and optional user approval
 */
export async function executeTool(
  toolName: string,
  params: unknown,
  context: ToolContext,
  options?: { skipApproval?: boolean }
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
        2
      )}ms)`
    );
    return {
      success: false,
      error: `Tool '${toolName}' not found`,
    };
  }

  console.log(
    `[executeTool] ✓ Tool '${toolName}' found in registry`,
    `Category: ${tool.category}, Dangerous: ${tool.isDangerous || false}`
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
        }, requiresApproval: ${tool.requiresApproval || false})`
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
        `[executeTool] Waiting for user approval (callId: ${callId})`
      );

      // Wait for approval or denial via polling
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (approvalStore.isApproved(callId)) {
            clearInterval(checkInterval);
            console.log(
              `[executeTool] User approved tool execution, proceeding...`
            );

            // Execute tool after approval (skip approval this time)
            executeTool(toolName, params, context, { skipApproval: true }).then(
              resolve
            );
          } else if (approvalStore.isDenied(callId)) {
            clearInterval(checkInterval);
            const duration = performance.now() - startTime;
            console.warn(
              `[executeTool] User denied tool execution (${duration.toFixed(
                2
              )}ms)`
            );
            resolve({
              success: false,
              error: "Tool execution denied by user",
            });
          }
        }, 100);
      });
    }

    console.log(
      `[executeTool] No approval required, proceeding with execution`
    );
  }

  try {
    // Validate parameters against schema
    console.log(`[executeTool] Validating parameters against schema...`);
    const validatedParams = tool.parameters.parse(params);
    console.log(`[executeTool] ✓ Parameters validated`);

    // Execute tool
    console.log(`[executeTool] Executing tool function...`);
    const result = await tool.execute(validatedParams, context);

    const duration = performance.now() - startTime;
    console.log(
      `[executeTool] ✓ Tool execution completed (${duration.toFixed(2)}ms)`,
      {
        success: result.success,
        hasData: !!result.data,
        hasError: !!result.error,
      }
    );

    if (result.success) {
      console.log(`[executeTool] Result data:`, result.data);
    } else {
      console.warn(`[executeTool] Result error:`, result.error);
    }

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    console.error(
      `[executeTool] ✗ Tool execution failed (${duration.toFixed(
        2
      )}ms): ${errorMessage}`
    );
    if (error instanceof Error && error.stack) {
      console.error(`[executeTool] Stack trace:`, error.stack);
    }

    if (error instanceof z.ZodError) {
      const validationErrors = error.errors.map((e) => e.message).join(", ");
      console.error(`[executeTool] Validation errors:`, validationErrors);
      return {
        success: false,
        error: `Invalid parameters: ${validationErrors}`,
      };
    }

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
  context: ToolContext
): Promise<ToolResult[]> {
  return Promise.all(
    calls.map(({ toolName, params }) => executeTool(toolName, params, context))
  );
}
