import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import { dispatchBlockUpdate } from "../../../../events";
import type { BlockData } from "../../../../stores/blockStore";
import type { Tool, ToolResult } from "../types";

export const appendToBlockTool: Tool = {
  name: "append_to_block",
  description:
    "Append text to the end of an existing block's content. This adds to the block without replacing its existing content. Useful for adding notes or extending existing text.",
  category: "block",
  requiresApproval: false,

  parameters: z.object({
    blockId: z
      .string()
      .uuid()
      .describe(
        "UUID of the block to append to. Example: '550e8400-e29b-41d4-a716-446655440000'",
      ),
    text: z
      .string()
      .describe(
        "Text to append to the block end. Will be combined with existing content using the separator. Example: '+ Added at 3 PM'",
      ),
    separator: z
      .string()
      .optional()
      .default(" ")
      .describe(
        "Separator between existing and new text. Default: space ' '. Use '\\n' for new line, ' | ' for pipe separator, etc.",
      ),
  }),

  async execute(params, context): Promise<ToolResult> {
    try {
      // Get the current block content
      const { useBlockStore } = await import("../../../../stores/blockStore");
      const blockStore = useBlockStore.getState();
      const block = blockStore.getBlock(params.blockId);

      if (!block) {
        return {
          success: false,
          error: `Block with UUID ${params.blockId} not found`,
        };
      }

      // Append text to existing content
      const newContent = block.content + params.separator + params.text;

      // Update the block
      const updatedBlock = await invoke<BlockData>("update_block", {
        workspacePath: context.workspacePath,
        request: {
          id: params.blockId,
          content: newContent,
        },
      });

      // Update UI via event
      dispatchBlockUpdate([updatedBlock]);

      return {
        success: true,
        data: {
          uuid: params.blockId,
          originalContent: block.content,
          appendedText: params.text,
          newContent: newContent,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to append to block",
      };
    }
  },
};
