import type { Tool, ToolCategory } from "./types";

/**
 * Central registry for all available tools
 */
class ToolRegistry {
  // biome-ignore lint/suspicious/noExplicitAny: Tool params are validated by Zod schema
  private tools: Map<string, Tool<any>> = new Map();

  // Category-based index for O(1) category lookups
  // biome-ignore lint/suspicious/noExplicitAny: Tool params are validated by Zod schema
  private categoryIndex: Map<string, Tool<any>[]> = new Map();

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
    this.indexByCategory(tool);
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
    return this.categoryIndex.get(category as string) ?? [];
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
    const tool = this.tools.get(name);
    if (tool) {
      this.removeFromCategoryIndex(tool);
    }
    return this.tools.delete(name);
  }

  /**
   * Clear all tools (useful for testing)
   */
  clear(): void {
    this.tools.clear();
    this.categoryIndex.clear();
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

  /**
   * Add tool to category index
   */
  // biome-ignore lint/suspicious/noExplicitAny: Tool params are validated by Zod schema
  private indexByCategory(tool: Tool<any>): void {
    const category = tool.category as string;
    if (!this.categoryIndex.has(category)) {
      this.categoryIndex.set(category, []);
    }
    this.categoryIndex.get(category)?.push(tool);
  }

  /**
   * Remove tool from category index
   */
  // biome-ignore lint/suspicious/noExplicitAny: Tool params are validated by Zod schema
  private removeFromCategoryIndex(tool: Tool<any>): void {
    const category = tool.category as string;
    const tools = this.categoryIndex.get(category);
    if (tools) {
      const index = tools.findIndex((t) => t.name === tool.name);
      if (index >= 0) {
        tools.splice(index, 1);
      }
      if (tools.length === 0) {
        this.categoryIndex.delete(category);
      }
    }
  }
}

// Export singleton instance
export const toolRegistry = new ToolRegistry();
