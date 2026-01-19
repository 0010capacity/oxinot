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

      // First, always try to get blocks for the UUID as if it's a page ID
      // This handles the common case where AI sends page ID
      try {
        console.log(
          "[createBlockTool] Checking if UUID is page ID:",
          params.parentUuid
        );
        const blocks = await invoke<any>("get_page_blocks", {
          workspacePath: context.workspacePath,
          pageId: params.parentUuid,
        });

        // If we got blocks, it's a page ID
        if (blocks && Array.isArray(blocks)) {
          pageId = params.parentUuid;
          console.log(
            "[createBlockTool] UUID is a page ID, found",
            blocks.length,
            "blocks"
          );

          if (blocks.length === 0) {
            // No blocks yet - create root block first
            console.log("[createBlockTool] Creating root block for empty page");
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
              console.log("[createBlockTool] Using root block:", parentBlockId);
            } else {
              // Use first block as fallback
              parentBlockId = blocks[0].id;
              console.log(
                "[createBlockTool] No root block found, using first block:",
                parentBlockId
              );
            }
          }

          // Create the block with the found parent
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
        }
      } catch (pageError) {
        // Not a page ID, try as block ID
        console.log(
          "[createBlockTool] Not a page ID, trying as block ID:",
          pageError
        );
      }

      // If page ID approach failed, try as block ID
      try {
        const parentBlock = await invoke<any>("get_block", {
          workspacePath: context.workspacePath,
          request: {
            block_id: params.parentUuid,
          },
        });

        if (parentBlock && parentBlock.block) {
          console.log("[createBlockTool] UUID is a block ID");
          pageId = parentBlock.block.page_id;
          parentBlockId = params.parentUuid;

          // Create the block
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
        }
      } catch (blockError) {
        console.log("[createBlockTool] Failed to get as block:", blockError);
      }

      // Both approaches failed
      return {
        success: false,
        error: `UUID ${params.parentUuid} is neither a valid page ID nor a block ID`,
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
