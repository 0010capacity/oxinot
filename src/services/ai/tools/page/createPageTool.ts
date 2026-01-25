import { z } from "zod";
import { usePageStore } from "../../../../stores/pageStore";
import type { Tool, ToolResult } from "../types";

export const createPageTool: Tool = {
  name: "create_page",
  description:
    "Create a new page in the workspace. You can specify the title and parent directory.",
  category: "page",
  requiresApproval: false,

  parameters: z.object({
    title: z
      .string()
      .describe(
        "Title of the new page. Example: 'Project Notes' or 'Meeting 2025-01'",
      ),
    parentId: z
      .string()
      .uuid()
      .nullable()
      .optional()
      .describe(
        "UUID of the parent directory page. Omit or pass null to create at root level. Example: '550e8400-e29b-41d4-a716-446655440000'",
      ),
  }),

  async execute(params, _context): Promise<ToolResult> {
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
        params.parentId || undefined,
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
