import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import { dispatchBlockUpdate } from "../../../../events";
import type { BlockData } from "../../../../stores/blockStore";
import type { Tool, ToolResult } from "../types";

export const mergeBlocksTool: Tool = {
  name: "merge_blocks",
  description:
    "Merge a block into its previous sibling (or specified target). Content is appended, children are moved, and the source block is deleted. Use to consolidate related content.",
  category: "block",
  requiresApproval: false,
  isDangerous: true,

  parameters: z.object({
    blockId: z
      .string()
      .uuid()
      .describe(
        "UUID of the block to merge (source). Will be deleted after merge. Example: '550e8400-e29b-41d4-a716-446655440000'",
      ),
    targetId: z
      .string()
      .uuid()
      .optional()
      .describe(
        "UUID of target block to merge into. If omitted, merges into previous sibling. Example: '550e8400-e29b-41d4-a716-446655440001'",
      ),
  }),

  async execute(params, context): Promise<ToolResult> {
    try {
      const affectedBlocks = await invoke<BlockData[]>("merge_blocks", {
        workspacePath: context.workspacePath,
        blockId: params.blockId,
        targetId: params.targetId ?? null,
      });

      const deletedIds = [params.blockId];
      dispatchBlockUpdate(affectedBlocks, deletedIds);

      return {
        success: true,
        data: {
          mergedBlockId: params.blockId,
          targetId: params.targetId,
          affectedCount: affectedBlocks.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to merge blocks",
      };
    }
  },
};
