import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import { dispatchBlockUpdate } from "../../../../events";
import type { BlockData } from "../../../../stores/blockStore";
import type { Tool, ToolResult } from "../types";

export const updateBlockTool: Tool = {
  name: "update_block",
  category: "block",
  description: `Update the content of an existing block. This tool modifies a specific block's text content.

Example user commands that should trigger this tool:
- "Change the first block to say 'TODO: Complete this task'"
- "Update block content to 'The meeting is scheduled for Friday'"
- "Modify this block to include 'Completed: Review design docs'"
- "Replace text in block 3 with 'Important: Read this carefully'"
- "Edit current block to add a note"

Notes:
- Only updates content, does not move or delete blocks
- Use block UUID (id) to identify which block to update
- Content can be plain text or markdown formatting
- Automatically triggers block update events in the UI
- Works with any block type (text, heading, code, list, etc.)`,
  requiresApproval: false,

  parameters: z.object({
    blockId: z.string().uuid().describe("UUID of the block to update"),
    content: z
      .string()
      .describe(
        "New content for the block. Can be plain text or include markdown formatting (e.g., **bold**, # heading, `code`)",
      ),
  }),

  async execute(params, context): Promise<ToolResult> {
    try {
      const updatedBlock = await invoke<BlockData>("update_block", {
        workspacePath: context.workspacePath,
        request: {
          id: params.blockId,
          content: params.content,
        },
      });

      // Update UI via event
      dispatchBlockUpdate([updatedBlock]);

      return {
        success: true,
        data: { blockId: params.blockId, content: params.content },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update block: ${
          error instanceof Error ? error.message : "Failed to update block"
        }`,
      };
    }
  },
};
