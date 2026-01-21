import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { usePageStore } from "../../../../stores/pageStore";

export const listPagesTool: Tool = {
  name: "list_pages",
  description:
    "Get a list of all pages in the workspace. Returns page titles, IDs, and hierarchy information. Useful for discovering what pages exist.",
  category: "page",
  requiresApproval: false,

  parameters: z.object({
    includeDirectories: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether to include directory pages in the list"),
    limit: z
      .number()
      .min(1)
      .max(500)
      .optional()
      .default(100)
      .describe("Maximum number of pages to return"),
  }),

  async execute(params, context): Promise<ToolResult> {
    try {
      const pageStore = usePageStore.getState();
      const allPages = Object.values(pageStore.pagesById);

      // Filter out directories if requested
      let filteredPages = params.includeDirectories
        ? allPages
        : allPages.filter((page) => !page.isDirectory);

      // Limit results
      filteredPages = filteredPages.slice(0, params.limit);

      // Map to simplified format
      const pageList = filteredPages.map((page) => ({
        id: page.id,
        title: page.title,
        parentId: page.parentId,
        isDirectory: page.isDirectory,
        hasChildren: page.childIds && page.childIds.length > 0,
      }));

      return {
        success: true,
        data: pageList,
        metadata: {
          count: pageList.length,
          total: allPages.length,
          filtered: !params.includeDirectories,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to list pages",
      };
    }
  },
};
