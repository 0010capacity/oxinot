import type { Tool, ToolCategory } from "./types";

/**
 * Central registry for all available tools
 */
class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  /**
   * Register a new tool
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' is already registered`);
    }

    // Validate tool definition
    this.validateTool(tool);

    this.tools.set(tool.name, tool);
  }

  /**
   * Register multiple tools at once
   */
  registerMany(tools: Tool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Get a tool by name
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   */
  getByCategory(category: ToolCategory | string): Tool[] {
    return this.getAll().filter((tool) => tool.category === category);
  }

  /**
   * Check if a tool is registered
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Unregister a tool (useful for testing)
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Clear all tools (useful for testing)
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * Validate tool definition
   */
  private validateTool(tool: Tool): void {
    if (!tool.name || typeof tool.name !== "string") {
      throw new Error("Tool name is required and must be a string");
    }

    if (!tool.description || typeof tool.description !== "string") {
      throw new Error("Tool description is required and must be a string");
    }

    if (!tool.parameters) {
      throw new Error("Tool parameters schema is required");
    }

    if (typeof tool.execute !== "function") {
      throw new Error("Tool execute function is required");
    }

    // Tool names should follow naming convention
    if (!/^[a-z][a-z0-9_]*$/.test(tool.name)) {
      throw new Error(
        `Tool name '${tool.name}' must be lowercase with underscores (snake_case)`,
      );
    }
  }
}

// Export singleton instance
export const toolRegistry = new ToolRegistry();
