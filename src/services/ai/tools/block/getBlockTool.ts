import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import type { Tool, ToolResult } from "../types";

export const getBlockTool: Tool = {
  name: "get_block",
  description:
    "Get a block by its UUID. Returns the block content, metadata, and hierarchy information.",
  category: "block",
  requiresApproval: false, // Read-only operation

  parameters: z.object({
    blockId: z.string().uuid().describe("UUID of the block to retrieve"),
  }),

  async execute(params, context): Promise<ToolResult> {
    try {
      // Use Tauri command structure: workspace_path + request object
      const block = await invoke("get_block", {
        workspacePath: context.workspacePath,
        request: {
          block_id: params.blockId,
        },
      });

      if (!block) {
        return {
          success: false,
          error: `Block with UUID ${params.blockId} not found`,
        };
      }

      return {
        success: true,
        data: block,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get block",
      };
    }
  },
};
