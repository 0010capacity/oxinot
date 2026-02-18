import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import type { PageData } from "../../../../stores/pageStore";
import type { Tool, ToolResult } from "../types";

export const movePageTool: Tool = {
  name: "move_page",
  description:
    "Move a page to a new parent. If the target parent is not a directory, it will be automatically converted to one. Use null parent to move to workspace root.",
  category: "page",
  requiresApproval: false,
  isDangerous: false,

  parameters: z.object({
    pageId: z
      .string()
      .uuid()
      .describe(
        "UUID of the page to move. Example: '550e8400-e29b-41d4-a716-446655440000'",
      ),
    parentId: z
      .string()
      .uuid()
      .nullable()
      .optional()
      .describe(
        "UUID of the new parent page. Pass null to move to workspace root. The parent will be auto-converted to a directory if needed. Example: '550e8400-e29b-41d4-a716-446655440001'",
      ),
  }),

  async execute(params, context): Promise<ToolResult> {
    try {
      const updatedPage = await invoke<PageData>("move_page", {
        workspacePath: context.workspacePath,
        request: {
          id: params.pageId,
          parentId: params.parentId ?? null,
        },
      });

      return {
        success: true,
        data: {
          pageId: updatedPage.id,
          title: updatedPage.title,
          parentId: updatedPage.parentId,
          filePath: updatedPage.filePath,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to move page",
      };
    }
  },
};
