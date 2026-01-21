import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { useBlockStore } from "../../../../stores/blockStore";

export const openPageTool: Tool = {
  name: "open_page",
  description:
    'Open a page by its UUID or title. Use this when the user asks to "open", "go to", "navigate to", or "show" a specific page.',
  category: "page",
  requiresApproval: false, // Navigation is non-destructive

  parameters: z.union([
    z.object({
      pageId: z.string().uuid().describe("UUID of the page to open"),
    }),
    z.object({
      pageTitle: z.string().describe("Title of the page to open"),
    }),
  ]),

  async execute(params): Promise<ToolResult> {
    try {
      let targetPageId: string | undefined =
        "pageId" in params ? params.pageId : undefined;

      // If title provided instead of ID, search for page by title
      if (!targetPageId && "pageTitle" in params) {
        const { usePageStore } = await import("../../../../stores/pageStore");
        const pages = usePageStore.getState().pagesById;

        // Find page by exact title match (case-insensitive)
        const matchingPage = Object.values(pages).find(
          (page) => page.title.toLowerCase() === params.pageTitle.toLowerCase()
        );

        if (!matchingPage) {
          return {
            success: false,
            error: `Page with title "${params.pageTitle}" not found`,
          };
        }

        targetPageId = matchingPage.id;
      }

      if (!targetPageId) {
        return {
          success: false,
          error: "No page ID or title provided",
        };
      }

      // Open the page using blockStore
      await useBlockStore.getState().openPage(targetPageId);

      return {
        success: true,
        data: {
          pageId: targetPageId,
          message: "Opened page successfully",
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to open page",
      };
    }
  },
};
