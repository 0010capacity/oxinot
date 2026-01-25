import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import type { BlockData } from "../../../../stores/blockStore";
import type { Tool, ToolResult } from "../types";

export const getPageBlocksTool: Tool = {
  name: "get_page_blocks",
  description:
    "Get all blocks in a page. Use this to inspect the page structure, find the root block, or see existing content before adding new blocks.",
  category: "block",
  requiresApproval: false,
  parameters: z.object({
    pageId: z
      .string()
      .uuid()
      .describe(
        "UUID of the page. Returns all blocks in the page with hierarchy information. Example: '550e8400-e29b-41d4-a716-446655440000'",
      ),
  }),
  async execute(params, context): Promise<ToolResult> {
    try {
      const blocks = await invoke<BlockData[]>("get_page_blocks", {
        workspacePath: context.workspacePath,
        pageId: params.pageId,
      });

      if (!blocks) {
        return {
          success: false,
          error: `Page with UUID ${params.pageId} not found or has no blocks`,
        };
      }

      return {
        success: true,
        data: blocks,
        metadata: { count: Array.isArray(blocks) ? blocks.length : 0 },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get page blocks",
      };
    }
  },
};
