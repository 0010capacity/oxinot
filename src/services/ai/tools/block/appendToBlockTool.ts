import { z } from "zod";
import { invoke } from "@tauri-apps/api/core";
import { dispatchBlockUpdate } from "../../../../events";
import type { Tool, ToolResult } from "../types";

export const appendToBlockTool: Tool = {
  name: "append_to_block",
  description:
    "Append text to the end of an existing block's content. This adds to the block without replacing its existing content. Useful for adding notes or extending existing text.",
  category: "block",
  requiresApproval: false,

  parameters: z.object({
    blockId: z.string().uuid().describe("UUID of the block to append to"),
    text: z
      .string()
      .describe(
        "Text to append to the block. Will be added to the end of existing content."
      ),
    separator: z
      .string()
      .optional()
      .default(" ")
      .describe(
        "Separator to use between existing content and new text (default: space)"
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
      const updatedBlock = await invoke<any>("update_block", {
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
          error instanceof Error
            ? error.message
            : "Failed to append to block",
      };
    }
  },
};
