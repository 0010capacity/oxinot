import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import { dispatchBlockUpdate } from "../../../../events";
import type { BlockData } from "../../../../stores/blockStore";
import type { Tool, ToolResult } from "../types";

export const insertBlockBelowCurrentTool: Tool = {
  name: "insert_block_below_current",
  description:
    "Insert a SINGLE new block below the currently focused block. This is a context-dependent operation that uses the active page and focused block. " +
    "If no block is focused, the block is added to the end of the current page. " +
    "WARNING: Content must be atomic single-block content. NEVER use newlines in content to simulate lists - that breaks the outliner architecture. For multiple items, use create_blocks_from_markdown instead. " +
    "IMPORTANT: This tool requires an open page and will fail with 'No page is currently open' if not satisfied.",
  category: "block",
  requiresApproval: false,

  parameters: z.object({
    content: z
      .string()
      .describe(
        "Markdown content of the new block. If no block is focused, appends to page end. Example: '- New item' or '## Section'",
      ),
  }),

  async execute(params, context): Promise<ToolResult> {
    try {
      const currentPageId = context.currentPageId;
      const focusedBlockId = context.focusedBlockId;

      if (!currentPageId) {
        return {
          success: false,
          error: "No page is currently open",
        };
      }

      // If no block is focused, create at root level
      if (!focusedBlockId) {
        const newBlock = await invoke<BlockData>("create_block", {
          workspacePath: context.workspacePath,
          request: {
            pageId: currentPageId,
            parentId: null,
            afterBlockId: null,
            content: params.content,
          },
        });

        dispatchBlockUpdate([newBlock]);

        return {
          success: true,
          data: {
            uuid: newBlock.id,
            content: params.content,
            pageId: currentPageId,
            insertedAt: "end_of_page",
          },
        };
      }

      // Get the focused block to determine insertion position
      const { useBlockStore } = await import("../../../../stores/blockStore");
      const blockStore = useBlockStore.getState();
      const focusedBlock = blockStore.getBlock(focusedBlockId);

      if (!focusedBlock) {
        return {
          success: false,
          error: `Focused block ${focusedBlockId} not found`,
        };
      }

      // Check if focused block has children and is expanded
      const children = blockStore.getChildren(focusedBlockId);
      const hasChildren = children.length > 0;
      const isCollapsed = focusedBlock.isCollapsed;

      let parentId: string | null;
      let afterBlockId: string | null;

      if (hasChildren && !isCollapsed) {
        // Insert as first child
        parentId = focusedBlockId;
        afterBlockId = null;
      } else {
        // Insert as sibling below
        parentId = focusedBlock.parentId;
        afterBlockId = focusedBlockId;
      }

      const newBlock = await invoke<BlockData>("create_block", {
        workspacePath: context.workspacePath,
        request: {
          pageId: currentPageId,
          parentId,
          afterBlockId,
          content: params.content,
        },
      });

      dispatchBlockUpdate([newBlock]);

      return {
        success: true,
        data: {
          uuid: newBlock.id,
          content: params.content,
          pageId: currentPageId,
          insertedBelow: focusedBlockId,
          insertedAs: hasChildren && !isCollapsed ? "first_child" : "sibling",
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to insert block below current",
      };
    }
  },
};
