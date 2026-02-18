import { z } from "zod";
import { tauriAPI } from "../../../../tauri-api";
import type { Tool, ToolResult } from "../types";

export const getPageBacklinksTool: Tool = {
  name: "get_page_backlinks",
  description:
    "Get all pages and blocks that link to a specific page. Useful for finding related content and understanding page relationships.",
  category: "search",
  requiresApproval: false,
  isDangerous: false,

  parameters: z.object({
    pageId: z
      .string()
      .uuid()
      .describe(
        "UUID of the page to find backlinks for. Example: '550e8400-e29b-41d4-a716-446655440000'",
      ),
  }),

  async execute(params, context): Promise<ToolResult> {
    try {
      const backlinks = await tauriAPI.getPageBacklinks(
        context.workspacePath,
        params.pageId,
      );

      return {
        success: true,
        data: {
          pageId: params.pageId,
          count: backlinks.length,
          backlinks: backlinks.map((group) => ({
            pageId: group.page_id,
            pageTitle: group.page_title,
            blocks: group.blocks.map((b) => ({
              blockId: b.block_id,
              content: b.content,
              createdAt: b.created_at,
            })),
          })),
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get page backlinks",
      };
    }
  },
};
