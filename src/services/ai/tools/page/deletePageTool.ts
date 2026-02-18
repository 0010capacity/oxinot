import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import type { Tool, ToolResult } from "../types";

export const deletePageTool: Tool = {
  name: "delete_page",
  description:
    "Delete a page from the workspace. The page must not have any child pages. This operation cannot be undone.",
  category: "page",
  requiresApproval: true,
  isDangerous: true,

  parameters: z.object({
    pageId: z
      .string()
      .uuid()
      .describe(
        "UUID of the page to delete. The page must not have children. Example: '550e8400-e29b-41d4-a716-446655440000'",
      ),
  }),

  async execute(params, context): Promise<ToolResult> {
    try {
      const deletedId = await invoke<string>("delete_page", {
        workspacePath: context.workspacePath,
        pageId: params.pageId,
      });

      return {
        success: true,
        data: { pageId: deletedId, deleted: true },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete page",
      };
    }
  },
};
