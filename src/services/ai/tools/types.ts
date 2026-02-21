import type { z } from "zod";

/**
 * Tool parameter schema using Zod for validation
 */
export type ToolParameterSchema = z.ZodTypeAny;

/**
 * Tool definition that AI can invoke
 */
// biome-ignore lint/suspicious/noExplicitAny: Tool params are validated by Zod schema
export interface Tool<Params = any> {
  /** Unique tool identifier (e.g., 'get_block', 'update_block') */
  name: string;

  /** Human-readable description for AI to understand when to use this tool */
  description: string;

  /** Zod schema for parameter validation */
  parameters: ToolParameterSchema;

  /** Execute the tool with validated parameters */
  execute: (params: Params, context: ToolContext) => Promise<ToolResult>;

  /** Optional: Whether this tool requires user approval before execution */
  requiresApproval?: boolean;

  /** Optional: Whether this is a dangerous/destructive operation (delete, etc.) */
  isDangerous?: boolean;

  /** Optional: Category for organizing tools */
  category?: ToolCategory | string;
}

/**
 * Result returned by tool execution
 */
// biome-ignore lint/suspicious/noExplicitAny: Default type flexibility for tool results
export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Tool categories for organization
 */
export enum ToolCategory {
  BLOCK = "block",
  PAGE = "page",
  SEARCH = "search",
  SELECTION = "selection",
  METADATA = "metadata",
  CONTEXT = "context",
  NAVIGATION = "navigation",
  FILESYSTEM = "filesystem",
}

/**
 * Tool execution context passed to all tools
 */
export interface ToolContext {
  workspacePath: string;
  currentPageId?: string;
  focusedBlockId?: string;
  selectedBlockIds?: string[];
  userId?: string;
  sessionId?: string;
  recordChange?: (change: {
    type: "create" | "update" | "delete";
    toolName: string;
    description: string;
    blockId?: string;
    pageId?: string;
    before?: unknown;
    after?: unknown;
  }) => void;
}
