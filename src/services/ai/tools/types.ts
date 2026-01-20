import type { z } from "zod";

/**
 * Tool parameter schema using Zod for validation
 */
export type ToolParameterSchema = z.ZodTypeAny;

/**
 * Tool definition that AI can invoke
 */
export interface Tool {
  /** Unique tool identifier (e.g., 'get_block', 'update_block') */
  name: string;

  /** Human-readable description for AI to understand when to use this tool */
  description: string;

  /** Zod schema for parameter validation */
  parameters: ToolParameterSchema;

  /** Execute the tool with validated parameters */
  execute: <T = any>(
    params: any,
    context: ToolContext
  ) => Promise<ToolResult<T>>;

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
export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
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
}

/**
 * Tool execution context passed to all tools
 */
export interface ToolContext {
  /** Current workspace path */
  workspacePath: string;

  /** Current page ID if available */
  currentPageId?: string;

  /** Currently focused block ID if available */
  focusedBlockId?: string;

  /** Currently selected block IDs */
  selectedBlockIds?: string[];

  /** User ID for permission checks */
  userId?: string;
}
