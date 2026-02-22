import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import { dispatchBlockUpdate } from "../../../../events";
import type { BlockData } from "../../../../stores/blockStore";
import type { Priority, TodoStatus } from "../../../../types/todo";
import { STATUS_TO_PREFIX } from "../../../../types/todo";
import type { Tool, ToolResult } from "../types";

export const createTodoTool: Tool = {
  name: "create_todo",
  description:
    "Create a new TODO block with optional status, dates, and priority. The status prefix (TODO, DOING, etc.) is automatically prepended to content. Use this for task creation via Copilot.",
  category: "metadata",
  requiresApproval: false,

  parameters: z.object({
    content: z
      .string()
      .describe(
        "Task description WITHOUT status prefix. The prefix will be added automatically based on 'status' parameter. Example: 'Review PR #42' (not 'TODO Review PR #42')",
      ),
    status: z
      .enum(["todo", "doing", "later"])
      .default("todo")
      .describe("Initial status. Default: 'todo'"),
    scheduled: z
      .string()
      .optional()
      .describe(
        "ISO 8601 date when task should be started. Example: '2026-02-22' or '2026-02-22T14:00:00'",
      ),
    deadline: z
      .string()
      .optional()
      .describe(
        "ISO 8601 date when task must be completed. Example: '2026-02-25'",
      ),
    priority: z
      .enum(["A", "B", "C"])
      .optional()
      .describe("Priority level: A=High, B=Medium, C=Low"),
    pageId: z
      .string()
      .uuid()
      .optional()
      .describe(
        "Target page UUID. If omitted, uses current page from context.",
      ),
    parentBlockId: z
      .string()
      .uuid()
      .nullable()
      .optional()
      .describe(
        "Parent block UUID for nesting. Pass null for root block (level 0).",
      ),
    insertAfterBlockId: z
      .string()
      .uuid()
      .optional()
      .describe("Sibling block UUID to insert after."),
  }),

  async execute(params, context): Promise<ToolResult> {
    try {
      let targetPageId = params.pageId;

      // If pageId is missing, try to get from context
      if (!targetPageId) {
        if (context.currentPageId) {
          targetPageId = context.currentPageId;
        } else if (params.parentBlockId) {
          // Infer pageId from parent block
          const parentBlock = await invoke<BlockData>("get_block", {
            workspacePath: context.workspacePath,
            request: { block_id: params.parentBlockId },
          });
          if (parentBlock) {
            targetPageId = parentBlock.pageId;
          }
        }
      }

      if (!targetPageId) {
        return {
          success: false,
          error:
            "No pageId provided and could not infer from context. Please specify a pageId or ensure there's a current page.",
        };
      }

      // Build content with status prefix
      const prefix = STATUS_TO_PREFIX[params.status as TodoStatus];
      const fullContent = prefix + params.content;

      // Create the block
      const newBlock = await invoke<BlockData>("create_block", {
        workspacePath: context.workspacePath,
        request: {
          pageId: targetPageId,
          parentId: params.parentBlockId ?? null,
          afterBlockId: params.insertAfterBlockId ?? null,
          content: fullContent,
        },
      });

      // Prepare metadata for dates and priority
      const metadata: Record<string, string> = {};
      if (params.scheduled) {
        metadata.scheduled = params.scheduled;
      }
      if (params.deadline) {
        metadata.deadline = params.deadline;
      }
      if (params.priority) {
        metadata.priority = params.priority;
      }

      // Set metadata if any
      if (Object.keys(metadata).length > 0) {
        await invoke("set_block_metadata", {
          workspacePath: context.workspacePath,
          request: {
            block_id: newBlock.id,
            metadata,
          },
        });
      }

      // Dispatch update to refresh UI
      dispatchBlockUpdate([newBlock]);

      return {
        success: true,
        data: {
          uuid: newBlock.id,
          content: fullContent,
          pageId: targetPageId,
          parentId: params.parentBlockId ?? null,
          status: params.status,
          scheduled: params.scheduled,
          deadline: params.deadline,
          priority: params.priority as Priority | undefined,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create TODO",
      };
    }
  },
};
