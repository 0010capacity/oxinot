import { getPageTools } from "./pageTools";

/**
 * Tool definition interface matching Claude API format
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
}

/**
 * Registry of all available tools for AI copilot
 * Centralizes tool definitions and makes them available to AI API calls
 */
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  constructor() {
    this.registerTools();
  }

  /**
   * Register all available tools
   */
  private registerTools(): void {
    // Page tools (search and open)
    const pageTools = getPageTools();
    for (const tool of pageTools) {
      this.registerTool(tool);
    }
  }

  /**
   * Register a single tool
   */
  private registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Get a tool definition by name
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools as array
   * Used for Claude API tool definitions
   */
  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Check if a tool is registered
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }
}

/**
 * Singleton instance of tool registry
 */
export const toolRegistry = new ToolRegistry();
