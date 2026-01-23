import { z } from "zod";
import type { Tool, ToolResult } from "../types";

export const queryPagesTool: Tool = {
  name: "query_pages",
  description:
    "Search for pages by title. Use this to find pages when the user asks about pages or wants to know what pages exist.",
  category: "page",
  requiresApproval: false, // Read-only operation

  parameters: z.object({
    query: z.string().describe("Search query to match against page titles"),
    limit: z
      .number()
      .min(1)
      .max(50)
      .default(10)
      .describe("Maximum number of results to return"),
  }),

  async execute(params): Promise<ToolResult> {
    try {
      const { usePageStore } = await import("../../../../stores/pageStore");
      const pages = Object.values(usePageStore.getState().pagesById);

      // Filter pages by title match (case-insensitive)
      const query = params.query.toLowerCase();
      const matchingPages = pages
        .filter((page) => page.title.toLowerCase().includes(query))
        .slice(0, params.limit)
        .map((page) => ({
          id: page.id,
          title: page.title,
          parentId: page.parentId,
          isDirectory: page.isDirectory,
        }));

      return {
        success: true,
        data: matchingPages,
        metadata: { count: matchingPages.length, total: pages.length },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to query pages",
      };
    }
  },
};
