import { z } from "zod";
import { invoke } from "@tauri-apps/api/core";
import type { Tool, ToolResult } from "../types";

export const createBlockTool: Tool = {
  name: "create_block",
  description:
    'Create a new block in the document. Use this whenever the user asks to "write", "add", "insert", or "create" content. Do not just output text in chat; use this tool to actually write to the document.',
  category: "block",
  requiresApproval: true,

  parameters: z.object({
    parentUuid: z
      .string()
      .uuid()
      .describe(
        "UUID of the parent block OR page ID. If you only know the page ID, you can use it directly and the tool will find the appropriate parent block."
      ),
    content: z.string().describe("Content for the new block"),
  }),

  async execute(params, context): Promise<ToolResult> {
    try {
      let pageId: string;
      let parentBlockId: string;

      // 1. Try to get parent as a block first
      try {
        const parentBlock = await invoke<any>("get_block", {
          workspacePath: context.workspacePath,
          request: {
            block_id: params.parentUuid,
          },
        });

        if (parentBlock) {
          // It's a block - use it directly
          pageId = parentBlock.block.page_id;
          parentBlockId = params.parentUuid;
        } else {
          throw new Error("Not a block");
        }
      } catch {
        // 2. Not a block - try as page ID and find root block
        pageId = params.parentUuid;

        // Get all blocks for this page to find root
        const blocks = await invoke<any>("get_page_blocks", {
          workspacePath: context.workspacePath,
          pageId: pageId,
        });

        if (!blocks || blocks.length === 0) {
          // No blocks yet - create root block first
          const rootBlock = await invoke<any>("create_block", {
            workspacePath: context.workspacePath,
            request: {
              page_id: pageId,
              parent_id: null,
              content: "",
            },
          });
          parentBlockId = rootBlock.id;
        } else {
          // Find root block (block with no parent)
          const rootBlock = blocks.find((b: any) => !b.parent_id);
          if (rootBlock) {
            parentBlockId = rootBlock.id;
          } else {
            // Use first block as fallback
            parentBlockId = blocks[0].id;
          }
        }
      }

      // 3. Create the block
      const newBlock = await invoke<any>("create_block", {
        workspacePath: context.workspacePath,
        request: {
          page_id: pageId,
          parent_id: parentBlockId,
          content: params.content,
        },
      });

      return {
        success: true,
        data: { uuid: newBlock.id, content: params.content },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create block",
      };
    }
  },
};
