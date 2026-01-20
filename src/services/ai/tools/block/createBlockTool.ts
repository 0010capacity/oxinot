import { z } from "zod";
import { invoke } from "@tauri-apps/api/core";
import { dispatchBlockUpdate } from "../../../../events";
import type { Tool, ToolResult } from "../types";

export const createBlockTool: Tool = {
  name: "create_block",
  description:
    "Create a new block in the document. Supports creating root blocks (0-level), nested blocks, and inserting at specific positions.",
  category: "block",
  requiresApproval: false,

  parameters: z.object({
    pageId: z
      .string()
      .uuid()
      .optional()
      .describe(
        "The UUID of the page where the block will be created. Required if parentBlockId is null (creating a root block). If omitted, it will be inferred from parentBlockId."
      ),
    parentBlockId: z
      .string()
      .uuid()
      .nullable()
      .optional()
      .describe(
        "The UUID of the parent block. Pass null to create a root block (0-level). If omitted, defaults to null (root block) IF pageId is provided."
      ),
    insertAfterBlockId: z
      .string()
      .uuid()
      .optional()
      .describe(
        "The UUID of the sibling block to insert after. Use this to control the order. If omitted, the block is appended to the end of the parent's children."
      ),
    content: z.string().describe("The Markdown content of the new block."),
  }),

  async execute(params, context): Promise<ToolResult> {
    try {
      let targetPageId = params.pageId;
      const targetParentId = params.parentBlockId ?? null; // Normalize undefined to null
      const targetAfterBlockId = params.insertAfterBlockId ?? null;

      // Validation: Must have either pageId OR parentBlockId
      if (!targetPageId && !targetParentId) {
        return {
          success: false,
          error: "Either pageId or parentBlockId must be provided.",
        };
      }

      // If pageId is missing, infer it from parentBlockId
      if (!targetPageId && targetParentId) {
        try {
          const parentBlock = await invoke<any>("get_block", {
            workspacePath: context.workspacePath,
            request: {
              block_id: targetParentId,
            },
          });

          if (!parentBlock) {
            return {
              success: false,
              error: `Parent block with UUID ${targetParentId} not found. Cannot infer pageId.`,
            };
          }

          // Backend Block struct uses camelCase for pageId
          targetPageId = parentBlock.pageId;
          console.log(
            `[createBlockTool] Inferred pageId ${targetPageId} from parentBlockId ${targetParentId}`
          );
        } catch (error) {
          return {
            success: false,
            error: `Failed to fetch parent block to infer pageId: ${
              error instanceof Error ? error.message : String(error)
            }`,
          };
        }
      }

      if (!targetPageId) {
        return {
          success: false,
          error: "Could not determine pageId.",
        };
      }

      // Execute create_block
      // Matches CreateBlockRequest in src-tauri/src/models/block.rs (camelCase)
      const newBlock = await invoke<any>("create_block", {
        workspacePath: context.workspacePath,
        request: {
          pageId: targetPageId,
          parentId: targetParentId,
          afterBlockId: targetAfterBlockId,
          content: params.content,
        },
      });

      // Update UI via event
      dispatchBlockUpdate([newBlock]);

      return {
        success: true,
        data: {
          uuid: newBlock.id,
          content: params.content,
          pageId: targetPageId,
          parentId: targetParentId,
        },
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
