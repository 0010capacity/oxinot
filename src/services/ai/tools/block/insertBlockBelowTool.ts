import { z } from "zod";
import { invoke } from "@tauri-apps/api/core";
import { dispatchBlockUpdate } from "../../../../events";
import type { Tool, ToolResult } from "../types";

export const insertBlockBelowTool: Tool = {
  name: "insert_block_below",
  description:
    "Insert a new block below a specific block. The new block will be inserted as a sibling (same level) or as the first child if the target block has children and is expanded.",
  category: "block",
  requiresApproval: false,

  parameters: z.object({
    blockId: z
      .string()
      .uuid()
      .describe("UUID of the block to insert below"),
    content: z.string().describe("The Markdown content of the new block"),
  }),

  async execute(params, context): Promise<ToolResult> {
    try {
      // Get the target block to determine insertion position
      const { useBlockStore } = await import("../../../../stores/blockStore");
      const blockStore = useBlockStore.getState();
      const targetBlock = blockStore.getBlock(params.blockId);

      if (!targetBlock) {
        return {
          success: false,
          error: `Block with UUID ${params.blockId} not found`,
        };
      }

      // Check if target block has children and is expanded
      const children = blockStore.getChildren(params.blockId);
      const hasChildren = children.length > 0;
      const isCollapsed = targetBlock.isCollapsed;

      let parentId: string | null;
      let afterBlockId: string | null;

      if (hasChildren && !isCollapsed) {
        // Insert as first child
        parentId = params.blockId;
        afterBlockId = null;
      } else {
        // Insert as sibling below
        parentId = targetBlock.parentId;
        afterBlockId = params.blockId;
      }

      const newBlock = await invoke<any>("create_block", {
        workspacePath: context.workspacePath,
        request: {
          pageId: targetBlock.pageId,
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
          pageId: targetBlock.pageId,
          insertedBelow: params.blockId,
          insertedAs: hasChildren && !isCollapsed ? "first_child" : "sibling",
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to insert block below",
      };
    }
  },
};
