import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import { dispatchBlockUpdate } from "../../../../events";
import type { BlockData } from "../../../../stores/blockStore";
import type { Tool, ToolResult } from "../types";

export const outdentBlockTool: Tool = {
  name: "outdent_block",
  description:
    "Outdent a block, making it a sibling of its parent. Use to reduce nesting level. The block must not already be at root level.",
  category: "block",
  requiresApproval: false,
  isDangerous: false,

  parameters: z.object({
    blockId: z
      .string()
      .uuid()
      .describe(
        "UUID of the block to outdent. Must not be at root level. Example: '550e8400-e29b-41d4-a716-446655440000'",
      ),
  }),

  async execute(params, context): Promise<ToolResult> {
    try {
      const updatedBlock = await invoke<BlockData>("outdent_block", {
        workspacePath: context.workspacePath,
        blockId: params.blockId,
      });

      dispatchBlockUpdate([updatedBlock]);

      return {
        success: true,
        data: {
          blockId: updatedBlock.id,
          parentId: updatedBlock.parentId,
          content: updatedBlock.content,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to outdent block",
      };
    }
  },
};
