import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import { dispatchBlockUpdate } from "../../../../events";
import type { BlockData } from "../../../../stores/blockStore";
import type { Tool, ToolResult } from "../types";

export const indentBlockTool: Tool = {
  name: "indent_block",
  description:
    "Indent a block, making it a child of its previous sibling. Use to create nested hierarchy. The block must have a previous sibling to indent under.",
  category: "block",
  requiresApproval: false,
  isDangerous: false,

  parameters: z.object({
    blockId: z
      .string()
      .uuid()
      .describe(
        "UUID of the block to indent. Must have a previous sibling. Example: '550e8400-e29b-41d4-a716-446655440000'",
      ),
  }),

  async execute(params, context): Promise<ToolResult> {
    try {
      const updatedBlock = await invoke<BlockData>("indent_block", {
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
          error instanceof Error ? error.message : "Failed to indent block",
      };
    }
  },
};
