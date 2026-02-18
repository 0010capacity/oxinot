import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import { dispatchBlockUpdate } from "../../../../events";
import type { BlockData } from "../../../../stores/blockStore";
import type { Tool, ToolResult } from "../types";

export const moveBlockTool: Tool = {
  name: "move_block",
  description:
    "Move a block to a new parent and/or position. Use to reorganize block hierarchy. Can change both parent and sibling order.",
  category: "block",
  requiresApproval: false,
  isDangerous: false,

  parameters: z.object({
    blockId: z
      .string()
      .uuid()
      .describe(
        "UUID of the block to move. Example: '550e8400-e29b-41d4-a716-446655440000'",
      ),
    newParentId: z
      .string()
      .uuid()
      .nullable()
      .optional()
      .describe(
        "UUID of the new parent block. Pass null to move to page root. Example: '550e8400-e29b-41d4-a716-446655440001'",
      ),
    afterBlockId: z
      .string()
      .uuid()
      .nullable()
      .optional()
      .describe(
        "UUID of sibling block to position after. Pass null to place at beginning. Example: '550e8400-e29b-41d4-a716-446655440002'",
      ),
  }),

  async execute(params, context): Promise<ToolResult> {
    try {
      const updatedBlock = await invoke<BlockData>("move_block", {
        workspacePath: context.workspacePath,
        request: {
          id: params.blockId,
          newParentId: params.newParentId ?? null,
          afterBlockId: params.afterBlockId ?? null,
        },
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
        error: error instanceof Error ? error.message : "Failed to move block",
      };
    }
  },
};
