import { z } from "zod";
import { invoke } from "@tauri-apps/api/core";
import type { Tool, ToolResult } from "../types";
import { usePageStore } from "../../../../stores/pageStore";
import { dispatchBlockUpdate } from "../../../../events";
import type { BlockData } from "../../../../stores/blockStore";

export const createPageWithBlocksTool: Tool = {
  name: "create_page_with_blocks",
  description:
    "Create a new page with initial block content in a single operation. This is more efficient than calling create_page followed by multiple create_block calls.",
  category: "page",
  requiresApproval: false,

  parameters: z.object({
    title: z.string().describe("Title of the new page"),
    parentId: z
      .string()
      .uuid()
      .optional()
      .describe(
        "UUID of the parent directory page. If omitted, page will be created at root level."
      ),
    blocks: z
      .array(
        z.object({
          content: z.string().describe("Markdown content of the block"),
          parentBlockId: z
            .string()
            .uuid()
            .nullable()
            .optional()
            .describe(
              "UUID of parent block for nesting. Null for root-level blocks."
            ),
          insertAfterBlockId: z
            .string()
            .uuid()
            .optional()
            .describe(
              "UUID of sibling block to insert after. Controls block order."
            ),
        })
      )
      .describe("Array of blocks to create in the page"),
  }),

  async execute(params, context): Promise<ToolResult> {
    try {
      const pageStore = usePageStore.getState();

      // Validate parent exists if provided
      if (params.parentId) {
        const parent = pageStore.pagesById[params.parentId];
        if (!parent) {
          return {
            success: false,
            error: `Parent page with UUID ${params.parentId} not found`,
          };
        }
        if (!parent.isDirectory) {
          return {
            success: false,
            error: `Parent page "${parent.title}" is not a directory`,
          };
        }
      }

      // Create the page
      const newPageId = await pageStore.createPage(
        params.title,
        params.parentId || undefined
      );

      // Create blocks using Tauri's create_block command directly
      const createdBlocks: Array<{
        uuid: string;
        content: string;
        parentId: string | null;
      }> = [];

      let lastBlockId: string | null = null;

      for (const block of params.blocks) {
        try {
          // If no explicit insertAfterBlockId provided, use the previous block
          const insertAfterBlockId: string | null =
            block.insertAfterBlockId || lastBlockId || null;

          // Use Tauri's create_block command directly
          const newBlock: BlockData = await invoke<BlockData>("create_block", {
            workspacePath: context.workspacePath,
            request: {
              pageId: newPageId,
              parentId: block.parentBlockId ?? null,
              afterBlockId: insertAfterBlockId || null,
              content: block.content,
            },
          });

          createdBlocks.push({
            uuid: newBlock.id,
            content: block.content,
            parentId: block.parentBlockId ?? null,
          });

          // Dispatch update for each newly created block
          dispatchBlockUpdate([newBlock]);

          lastBlockId = newBlock.id;
        } catch (blockError) {
          console.error(
            "[createPageWithBlocksTool] Failed to create block:",
            blockError
          );
        }
      }

      return {
        success: true,
        data: {
          id: newPageId,
          title: params.title,
          parentId: params.parentId || null,
          blocksCreated: createdBlocks.length,
          blocks: createdBlocks,
        },
        metadata: {
          message: `Created page "${params.title}" with ${createdBlocks.length} blocks`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create page with blocks",
      };
    }
  },
};
