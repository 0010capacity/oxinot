import { processPageToolCall } from "./pageTools";
import { toolRegistry } from "./toolRegistry";

// Logger utility
const createLogger = (moduleName: string) => {
  const prefix = `[${moduleName}]`;
  const isDev = import.meta.env.DEV;

  return {
    log: (...args: unknown[]) => {
      if (isDev) console.log(prefix, ...args);
    },
    info: (...args: unknown[]) => {
      console.info(prefix, ...args);
    },
    warn: (...args: unknown[]) => {
      console.warn(prefix, ...args);
    },
    error: (...args: unknown[]) => {
      console.error(prefix, ...args);
    },
    debug: (...args: unknown[]) => {
      if (isDev) console.debug(prefix, ...args);
    },
    group: (label: string) => {
      if (isDev) console.group(prefix, label);
    },
    groupEnd: () => {
      if (isDev) console.groupEnd();
    },
    table: (data: unknown) => {
      if (isDev) console.table(data);
    },
  };
};

const logger = createLogger("ToolExecutor");

/**
 * Unified executor for all copilot tools
 * Routes tool calls to appropriate handlers based on tool name
 */
export const ToolExecutor = {
  /**
   * Execute a tool call from AI response
   * @param toolName - Name of the tool to execute
   * @param toolInput - Input parameters for the tool
   * @param workspacePath - Current workspace path (required for some tools)
   * @returns Result of tool execution
   */
  async execute(
    toolName: string,
    toolInput: Record<string, unknown>,
    workspacePath: string
  ): Promise<unknown> {
    logger.group("execute");
    logger.info(`Executing tool: ${toolName}`);
    logger.log("Input:", toolInput);
    logger.log("Workspace:", workspacePath);

    // Validate tool exists
    if (!toolRegistry.hasTool(toolName)) {
      logger.error(`Tool not found: ${toolName}`);
      logger.warn(`Available tools: ${toolRegistry.getToolNames().join(", ")}`);
      logger.groupEnd();
      throw new Error(
        `Unknown tool: ${toolName}. Available tools: ${toolRegistry
          .getToolNames()
          .join(", ")}`
      );
    }

    logger.log("Tool found in registry ✓");

    // Route to appropriate tool handler
    try {
      logger.info(`Routing to handler for ${toolName}`);
      const startTime = performance.now();

      let result: unknown;

      switch (toolName) {
        // Page tools (search_notes, open_page)
        case "search_notes":
        case "open_page":
          logger.log(`Calling processPageToolCall for ${toolName}`);
          result = await processPageToolCall(
            toolName,
            toolInput,
            workspacePath
          );
          break;

        default:
          logger.error(`Tool ${toolName} is not implemented`);
          logger.groupEnd();
          throw new Error(`Tool ${toolName} is not implemented`);
      }

      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2);

      logger.info(`✓ Tool execution completed in ${duration}ms`);
      logger.log("Result:", result);
      logger.groupEnd();

      return result;
    } catch (error) {
      logger.error("Tool execution error:");
      logger.error("Error details:", error);
      logger.groupEnd();
      throw error;
    }
  },

  /**
   * Validate tool input against tool definition
   * @param toolName - Name of the tool
   * @param toolInput - Input to validate
   * @returns true if valid, false otherwise
   */
  validateToolInput(
    toolName: string,
    toolInput: Record<string, unknown>
  ): boolean {
    logger.log(`Validating input for tool: ${toolName}`);

    const tool = toolRegistry.getTool(toolName);
    if (!tool) {
      logger.warn(`Tool not found during validation: ${toolName}`);
      return false;
    }

    logger.log("Tool definition found");
    logger.log("Required fields:", tool.inputSchema.required);
    logger.log("Input fields:", Object.keys(toolInput));

    // Check required fields
    const required = tool.inputSchema.required || [];
    for (const field of required) {
      if (!(field in toolInput)) {
        logger.warn(`Missing required field: ${field}`);
        return false;
      }
      logger.log(`✓ Required field present: ${field}`);
    }

    logger.log("✓ Input validation passed");
    return true;
  },

  /**
   * Get all available tools for AI API
   * Returns tool definitions in Claude API format
   */
  getToolsForAPI() {
    logger.log("getToolsForAPI() called");

    const tools = toolRegistry.getAllTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));

    logger.info(`Returning ${tools.length} tools for API`);
    logger.table(
      tools.map((t) => ({ name: t.name, description: t.description }))
    );

    return tools;
  },

  /**
   * Get tool definition by name
   */
  getTool(toolName: string) {
    logger.log(`Getting tool definition for: ${toolName}`);
    const tool = toolRegistry.getTool(toolName);

    if (tool) {
      logger.log(`✓ Tool found: ${toolName}`);
    } else {
      logger.warn(`✗ Tool not found: ${toolName}`);
    }

    return tool;
  },
} as const;

/**
 * Helper function to process AI response with potential tool calls
 * Handles tool use blocks and returns results
 */
export async function processAIResponse(
  response: {
    content: Array<{
      type: string;
      text?: string;
      name?: string;
      input?: Record<string, unknown>;
    }>;
  },
  workspacePath: string
): Promise<Array<{ type: string; content: string; toolName?: string }>> {
  const processLogger = createLogger("processAIResponse");

  processLogger.group("processAIResponse");
  processLogger.info("Processing AI response");
  processLogger.log("Response blocks:", response.content.length);
  processLogger.log("Workspace:", workspacePath);

  const results: Array<{ type: string; content: string; toolName?: string }> =
    [];

  for (let i = 0; i < response.content.length; i++) {
    const block = response.content[i];

    processLogger.group(`Block ${i + 1}/${response.content.length}`);
    processLogger.log("Block type:", block.type);

    if (block.type === "text" && block.text) {
      processLogger.info("Processing text block");
      processLogger.log("Text:", block.text.substring(0, 100) + "...");

      results.push({
        type: "text",
        content: block.text,
      });

      processLogger.log("✓ Text block added");
    } else if (block.type === "tool_use" && block.name && block.input) {
      processLogger.info("Processing tool_use block");
      processLogger.log("Tool name:", block.name);
      processLogger.log("Tool input:", block.input);

      try {
        const toolName = block.name;
        const toolInput = block.input;

        processLogger.info(`Validating tool input for: ${toolName}`);

        // Validate input
        if (!ToolExecutor.validateToolInput(toolName, toolInput)) {
          processLogger.error(`Invalid input for tool ${toolName}`);

          results.push({
            type: "tool_error",
            content: `Invalid input for tool ${toolName}`,
            toolName,
          });

          processLogger.log("✗ Tool error result added");
          processLogger.groupEnd();
          continue;
        }

        processLogger.log("✓ Input validation passed");
        processLogger.info(`Executing tool: ${toolName}`);

        const startTime = performance.now();

        // Execute tool
        const toolResult = await ToolExecutor.execute(
          toolName,
          toolInput,
          workspacePath
        );

        const endTime = performance.now();
        const duration = (endTime - startTime).toFixed(2);

        processLogger.info(`✓ Tool execution completed in ${duration}ms`);
        processLogger.log("Tool result:", toolResult);

        results.push({
          type: "tool_result",
          content: JSON.stringify(toolResult),
          toolName,
        });

        processLogger.log("✓ Tool result added to response");
      } catch (error) {
        processLogger.error("Tool execution failed:");
        processLogger.error("Error details:", error);

        const errorMessage =
          error instanceof Error ? error.message : String(error);

        results.push({
          type: "tool_error",
          content: `Tool execution failed: ${errorMessage}`,
          toolName: block.name,
        });

        processLogger.log("✗ Tool error result added");
      }
    } else {
      processLogger.log("Skipping unknown or empty block");
    }

    processLogger.groupEnd();
  }

  processLogger.info(`Processing complete. Total results: ${results.length}`);
  processLogger.table(
    results.map((r) => ({
      type: r.type,
      toolName: r.toolName || "N/A",
      contentLength: r.content.length,
    }))
  );
  processLogger.groupEnd();

  return results;
}
