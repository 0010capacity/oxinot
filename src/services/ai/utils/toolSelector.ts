import { toolRegistry } from "@/services/ai/tools/registry";
import type { Tool } from "@/services/ai/tools/types";
import { ToolCategory } from "@/services/ai/tools/types";
import type { Intent } from "./intentClassifier";

/**
 * Tool selection strategies based on user intent
 * Maps each intent type to the appropriate set of tools
 */

const TOOL_SELECTIONS = {
  /**
   * CONVERSATIONAL: No tools needed
   * User is just chatting - respond directly without any tools
   */
  CONVERSATIONAL: [],

  /**
   * INFORMATION_REQUEST: Limited tools (read-only, information retrieval)
   * Tools for finding and retrieving information about existing content
   */
  INFORMATION_REQUEST: [
    "get_block",
    "get_page_blocks",
    "query_blocks",
    "list_pages",
    "search_blocks",
    "get_block_references",
  ],

  /**
   * CONTENT_CREATION: All tools except delete
   * User wants to create new blocks, pages, or structure
   * Can read, query, create, update, but cannot delete
   */
  CONTENT_CREATION: [
    // Read tools
    "get_block",
    "get_page_blocks",
    "query_blocks",
    "list_pages",
    "search_blocks",
    "get_block_references",
    // Creation tools
    "create_block",
    "create_blocks_batch",
    "create_blocks_from_markdown",
    "create_page",
    "create_subpage",
    "insert_block_below",
    "insert_block_below_current",
    // Update tools
    "update_block",
    "append_to_block",
    // Validation tools
    "validate_markdown_structure",
    "get_markdown_template",
  ],

  /**
   * CONTENT_MODIFICATION: All tools including delete
   * User wants to edit or reorganize existing content
   * Can read, create, update, and delete
   */
  CONTENT_MODIFICATION: [
    // Read tools
    "get_block",
    "get_page_blocks",
    "query_blocks",
    "list_pages",
    "search_blocks",
    "get_block_references",
    // Creation tools
    "create_block",
    "create_blocks_batch",
    "create_blocks_from_markdown",
    "create_page",
    "create_subpage",
    "insert_block_below",
    "insert_block_below_current",
    // Update tools
    "update_block",
    "append_to_block",
    // Delete tools
    "delete_block",
    "delete_page",
    // Validation tools
    "validate_markdown_structure",
    "get_markdown_template",
  ],
};

/**
 * Select tools based on user intent
 *
 * @param intent - The classified user intent
 * @returns Array of Tool objects appropriate for the intent
 */
export function selectToolsByIntent(intent: Intent): Tool[] {
  const toolNames =
    TOOL_SELECTIONS[intent as keyof typeof TOOL_SELECTIONS] || [];

  const selectedTools: Tool[] = [];

  for (const toolName of toolNames) {
    const tool = toolRegistry.get(toolName);
    if (tool) {
      selectedTools.push(tool);
    }
  }

  return selectedTools;
}

/**
 * Get tools by category (for specialized selections)
 * Useful for specific scenarios like "only context tools"
 */
export function getToolsByCategory(category: ToolCategory | string): Tool[] {
  return toolRegistry.getByCategory(category);
}

/**
 * Check if a tool is safe (read-only, non-destructive)
 */
export function isSafeTool(tool: Tool | string): boolean {
  const toolObj = typeof tool === "string" ? toolRegistry.get(tool) : tool;

  if (!toolObj) return false;

  // Read-only categories are always safe
  const safeCategories = [
    ToolCategory.SEARCH,
    ToolCategory.CONTEXT,
    ToolCategory.NAVIGATION,
  ];

  if (safeCategories.includes(toolObj.category as ToolCategory)) {
    return true;
  }

  // Specific read-only tools
  const readOnlyTools = [
    "get_block",
    "get_page_blocks",
    "query_blocks",
    "list_pages",
    "search_blocks",
    "get_block_references",
    "get_markdown_template",
  ];

  return readOnlyTools.includes(toolObj.name);
}

/**
 * Check if a tool is dangerous (destructive operations)
 */
export function isDangerousTool(tool: Tool | string): boolean {
  const toolObj = typeof tool === "string" ? toolRegistry.get(tool) : tool;

  if (!toolObj) return false;

  // Use tool's isDangerous flag if available
  if (toolObj.isDangerous === true) {
    return true;
  }

  // Explicit dangerous tools
  const dangerousTools = ["delete_block", "delete_page", "drop_page"];

  return dangerousTools.includes(toolObj.name);
}
