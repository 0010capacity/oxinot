import { z } from "zod";
import { invoke } from "@tauri-apps/api/core";
import { dispatchBlockUpdate } from "../../../../events";
import type { Tool, ToolResult } from "../types";

export const updateBlockTool: Tool = {
  name: "update_block",
  description:
    "Update the content of an existing block. Use this to modify block text.",
  category: "block",
  requiresApproval: false,

  parameters: z.object({
    uuid: z.string().uuid().describe("UUID of the block to update"),
    content: z.string().describe("New content for the block"),
  }),

  async execute(params, context): Promise<ToolResult> {
    try {
      const updatedBlock = await invoke<any>("update_block", {
        workspacePath: context.workspacePath,
        request: {
          id: params.uuid,
          content: params.content,
        },
      });

      // Update UI via event
      dispatchBlockUpdate([updatedBlock]);

      return {
        success: true,
        data: { uuid: params.uuid, content: params.content },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update block",
      };
    }
  },
};
