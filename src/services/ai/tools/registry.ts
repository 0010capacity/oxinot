import type { Tool, ToolCategory } from "./types";

/**
 * Central registry for all available tools
 */
class ToolRegistry {
  // biome-ignore lint/suspicious/noExplicitAny: Tool params are validated by Zod schema
  private tools: Map<string, Tool<any>> = new Map();

  /**
   * Register a new tool
   */
  // biome-ignore lint/suspicious/noExplicitAny: Tool params are validated by Zod schema
  register(tool: Tool<any>): void {
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
  // biome-ignore lint/suspicious/noExplicitAny: Tool params are validated by Zod schema
  registerMany(tools: Tool<any>[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Get a tool by name
   */
  // biome-ignore lint/suspicious/noExplicitAny: Tool params are validated by Zod schema
  get(name: string): Tool<any> | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  // biome-ignore lint/suspicious/noExplicitAny: Tool params are validated by Zod schema
  getAll(): Tool<any>[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   */
  // biome-ignore lint/suspicious/noExplicitAny: Tool params are validated by Zod schema
  getByCategory(category: ToolCategory | string): Tool<any>[] {
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
  // biome-ignore lint/suspicious/noExplicitAny: Tool params are validated by Zod schema
  private validateTool(tool: Tool<any>): void {
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
