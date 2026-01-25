import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import { dispatchBlockUpdate } from "../../../../events";
import type { Tool, ToolResult } from "../types";

export const deleteBlockTool: Tool = {
  name: "delete_block",
  description:
    "Delete a block and all its children. Use with caution as this cannot be undone.",
  category: "block",
  requiresApproval: true, // Highly destructive
  isDangerous: true,

  parameters: z.object({
    blockId: z.string().uuid().describe("UUID of the block to delete"),
  }),

  async execute(params, context): Promise<ToolResult> {
    try {
      const deletedIds = await invoke<string[]>("delete_block", {
        workspacePath: context.workspacePath,
        blockId: params.blockId, // Note: argument name matches Rust command signature
      });

      // Update UI via event
      dispatchBlockUpdate([], deletedIds);

      return {
        success: true,
        data: { blockId: params.blockId, deleted: true },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete block",
      };
    }
  },
};
