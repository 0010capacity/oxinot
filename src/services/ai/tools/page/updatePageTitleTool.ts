import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import type { PageData } from "../../../../stores/pageStore";
import type { Tool, ToolResult } from "../types";

export const updatePageTitleTool: Tool = {
  name: "update_page_title",
  description:
    "Update the title of a page. This will also rename the associated file. Use this to rename pages.",
  category: "page",
  requiresApproval: false,
  isDangerous: false,

  parameters: z.object({
    pageId: z
      .string()
      .uuid()
      .describe(
        "UUID of the page to rename. Example: '550e8400-e29b-41d4-a716-446655440000'",
      ),
    title: z
      .string()
      .min(1)
      .describe("New title for the page. Example: 'Meeting Notes - Q1 Review'"),
  }),

  async execute(params, context): Promise<ToolResult> {
    try {
      const updatedPage = await invoke<PageData>("update_page_title", {
        workspacePath: context.workspacePath,
        request: {
          id: params.pageId,
          title: params.title,
        },
      });

      return {
        success: true,
        data: {
          pageId: updatedPage.id,
          title: updatedPage.title,
          filePath: updatedPage.filePath,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update page title",
      };
    }
  },
};
