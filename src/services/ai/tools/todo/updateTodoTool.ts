import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import { dispatchBlockUpdate } from "../../../../events";
import type { BlockData } from "../../../../stores/blockStore";
import type { TodoStatus } from "../../../../types/todo";
import { extractStatusPrefix, setStatusPrefix } from "../../../../types/todo";
import type { Tool, ToolResult } from "../types";

export const updateTodoTool: Tool = {
  name: "update_todo",
  description:
    "Update a TODO block's status, dates, or priority. Provide blockId and the fields to change. Status changes update the content prefix (TODO → DOING → DONE). Date and priority changes update metadata.",
  category: "metadata",
  requiresApproval: false,

  parameters: z.object({
    blockId: z.string().uuid().describe("UUID of the TODO block to update."),
    status: z
      .enum(["todo", "doing", "done", "later", "canceled"])
      .optional()
      .describe("New status. Changes the content prefix."),
    scheduled: z
      .string()
      .nullable()
      .optional()
      .describe("ISO 8601 date for scheduled/start date. Pass null to remove."),
    deadline: z
      .string()
      .nullable()
      .optional()
      .describe("ISO 8601 date for deadline. Pass null to remove."),
    priority: z
      .enum(["A", "B", "C"])
      .nullable()
      .optional()
      .describe("Priority: A=High, B=Medium, C=Low. Pass null to remove."),
  }),

  async execute(params, context): Promise<ToolResult> {
    try {
      // Get current block
      const block = await invoke<BlockData>("get_block", {
        workspacePath: context.workspacePath,
        request: { block_id: params.blockId },
      });

      if (!block) {
        return {
          success: false,
          error: `Block not found: ${params.blockId}`,
        };
      }

      const currentContent = block.content || "";
      const extracted = extractStatusPrefix(currentContent);

      // Track what changed
      const changes: Record<string, unknown> = {};
      let newContent = currentContent;

      // Handle status change (updates content prefix)
      if (params.status !== undefined) {
        const newStatus = params.status as TodoStatus;
        const rest = extracted ? extracted.rest : currentContent;
        newContent = setStatusPrefix(rest, newStatus);
        changes.status = newStatus;

        // Update content in backend
        await invoke("update_block_content", {
          workspacePath: context.workspacePath,
          request: {
            block_id: params.blockId,
            content: newContent,
          },
        });
      }

      // Build metadata updates
      const metadataUpdates: Record<string, string | null> = {};

      if (params.scheduled !== undefined) {
        metadataUpdates.scheduled = params.scheduled;
        changes.scheduled = params.scheduled;
      }

      if (params.deadline !== undefined) {
        metadataUpdates.deadline = params.deadline;
        changes.deadline = params.deadline;
      }

      if (params.priority !== undefined) {
        metadataUpdates.priority = params.priority;
        changes.priority = params.priority;
      }

      // Apply metadata updates if any
      if (Object.keys(metadataUpdates).length > 0) {
        await invoke("set_block_metadata", {
          workspacePath: context.workspacePath,
          request: {
            block_id: params.blockId,
            metadata: metadataUpdates,
          },
        });
      }

      // Fetch updated block for dispatch
      const updatedBlock = await invoke<BlockData>("get_block", {
        workspacePath: context.workspacePath,
        request: { block_id: params.blockId },
      });

      if (updatedBlock) {
        dispatchBlockUpdate([updatedBlock]);
      }

      return {
        success: true,
        data: {
          blockId: params.blockId,
          changes,
          newContent,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update TODO",
      };
    }
  },
};
