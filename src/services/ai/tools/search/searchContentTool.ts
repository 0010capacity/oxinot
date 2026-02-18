import { z } from "zod";
import { tauriAPI } from "../../../../tauri-api";
import type { Tool, ToolResult } from "../types";

export const searchContentTool: Tool = {
  name: "search_content",
  description:
    "Full-text search across all pages and blocks in the workspace. Uses FTS5 with phrase search and boolean operators. Returns ranked results with highlighted snippets.",
  category: "search",
  requiresApproval: false,
  isDangerous: false,

  parameters: z.object({
    query: z
      .string()
      .min(1)
      .describe(
        "Search query. Supports: phrase search ('exact phrase'), boolean operators (AND, OR, NOT), prefix search (word*). Example: 'meeting AND notes'",
      ),
  }),

  async execute(params, context): Promise<ToolResult> {
    try {
      const results = await tauriAPI.searchContent(
        context.workspacePath,
        params.query,
      );

      return {
        success: true,
        data: {
          query: params.query,
          count: results.length,
          results: results.map((r) => ({
            id: r.id,
            pageId: r.pageId,
            pageTitle: r.pageTitle,
            type: r.resultType,
            snippet: r.snippet,
            rank: r.rank,
          })),
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to search content",
      };
    }
  },
};
