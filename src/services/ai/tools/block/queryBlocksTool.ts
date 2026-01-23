import { z } from "zod";
import { invoke } from "@tauri-apps/api/core";
import type { Tool, ToolResult } from "../types";

export const queryBlocksTool: Tool = {
  name: "query_blocks",
  description:
    "Search for blocks matching a query string. Optionally filter by page.",
  category: "block",
  requiresApproval: false, // Read-only

  parameters: z.object({
    query: z.string().describe("Search query string"),
    limit: z
      .number()
      .min(1)
      .max(100)
      .default(20)
      .describe("Maximum results to return"),
  }),

  async execute(params, context): Promise<ToolResult> {
    try {
      const blocks = await invoke("search_blocks", {
        workspacePath: context.workspacePath,
        request: {
          query: params.query,
          limit: params.limit,
        },
      });

      return {
        success: true,
        data: blocks,
        metadata: { count: Array.isArray(blocks) ? blocks.length : 0 },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to query blocks",
      };
    }
  },
};
