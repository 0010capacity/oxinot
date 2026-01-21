import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { useBlockStore } from "../../../../stores/blockStore";
import { useBlockUIStore } from "../../../../stores/blockUIStore";
import { usePageStore } from "../../../../stores/pageStore";

export const getCurrentContextTool: Tool = {
  name: "get_current_context",
  description:
    "Get information about the current context: which page is open, which block is focused, and which blocks are selected. Use this to understand the user's current working context.",
  category: "context",
  requiresApproval: false,

  parameters: z.object({}),

  async execute(params, context): Promise<ToolResult> {
    try {
      const currentPageId = context.currentPageId;
      const focusedBlockId = context.focusedBlockId;
      const selectedBlockIds = context.selectedBlockIds || [];

      // Get page info
      let pageInfo = null;
      if (currentPageId) {
        const pageStore = usePageStore.getState();
        const page = pageStore.pagesById[currentPageId];
        if (page) {
          pageInfo = {
            id: page.id,
            title: page.title,
            parentId: page.parentId,
            isDirectory: page.isDirectory,
          };
        }
      }

      // Get focused block info
      let focusedBlockInfo = null;
      if (focusedBlockId) {
        const blockStore = useBlockStore.getState();
        const block = blockStore.getBlock(focusedBlockId);
        if (block) {
          focusedBlockInfo = {
            id: block.id,
            content: block.content,
            parentId: block.parentId,
            blockType: block.blockType,
          };
        }
      }

      // Get selected blocks info
      const selectedBlocksInfo = [];
      if (selectedBlockIds.length > 0) {
        const blockStore = useBlockStore.getState();
        for (const blockId of selectedBlockIds) {
          const block = blockStore.getBlock(blockId);
          if (block) {
            selectedBlocksInfo.push({
              id: block.id,
              content: block.content,
              parentId: block.parentId,
              blockType: block.blockType,
            });
          }
        }
      }

      return {
        success: true,
        data: {
          page: pageInfo,
          focusedBlock: focusedBlockInfo,
          selectedBlocks: selectedBlocksInfo,
          hasSelection: selectedBlockIds.length > 0,
          hasFocus: !!focusedBlockId,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get current context",
      };
    }
  },
};
