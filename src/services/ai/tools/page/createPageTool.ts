import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { usePageStore } from "../../../../stores/pageStore";

export const createPageTool: Tool = {
  name: "create_page",
  description:
    "Create a new page in the workspace. You can specify the title and parent directory.",
  category: "page",
  requiresApproval: false,

  parameters: z.object({
    title: z.string().describe("Title of the new page"),
    parentId: z
      .string()
      .uuid()
      .optional()
      .describe(
        "UUID of the parent directory page. If omitted, page will be created at root level."
      ),
  }),

  async execute(params): Promise<ToolResult> {
    try {
      const pageStore = usePageStore.getState();

      // Validate parent exists if provided
      if (params.parentId) {
        const parent = pageStore.pagesById[params.parentId];
        if (!parent) {
          return {
            success: false,
            error: `Parent page with UUID ${params.parentId} not found`,
          };
        }
        if (!parent.isDirectory) {
          return {
            success: false,
            error: `Parent page "${parent.title}" is not a directory`,
          };
        }
      }

      // Create the page
      const newPageId = await pageStore.createPage(
        params.title,
        params.parentId || undefined
      );

      return {
        success: true,
        data: {
          id: newPageId,
          title: params.title,
          parentId: params.parentId || null,
        },
        metadata: {
          message: `Created page "${params.title}"`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create page",
      };
    }
  },
};
