import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import { dispatchBlockUpdate } from "../../../../events";
import type { BlockData } from "../../../../stores/blockStore";
import { usePageStore } from "../../../../stores/pageStore";
import type { Tool, ToolResult } from "../types";

export const createPageWithBlocksTool: Tool = {
  name: "create_page_with_blocks",
  description:
    "Create a new page with initial block content in a single operation. This is more efficient than calling create_page followed by multiple create_block calls.",
  category: "page",
  requiresApproval: false,

  parameters: z.object({
    title: z
      .string()
      .describe("Title of the new page. Example: 'Meeting Notes'"),
    parentId: z
      .string()
      .uuid()
      .nullable()
      .optional()
      .describe(
        "UUID of the parent directory page. Omit or pass null to create at root level. Example: '550e8400-e29b-41d4-a716-446655440000'",
      ),
    blocks: z
      .array(
        z.object({
          content: z
            .string()
            .describe(
              "Markdown content of the block. Example: '# Title' or '- Task item'",
            ),
          indent: z
            .number()
            .min(0)
            .optional()
            .describe(
              "Indent level (0=root, 1=nested under first child, etc). Default: 0. Example: 0, 1, 2",
            ),
          parentBlockId: z
            .string()
            .uuid()
            .nullable()
            .optional()
            .describe(
              "UUID of parent block for nesting. Null for root-level blocks. Example: '550e8400-e29b-41d4-a716-446655440001'",
            ),
          insertAfterBlockId: z
            .string()
            .uuid()
            .optional()
            .describe(
              "UUID of sibling block to insert after (controls order). Example: '550e8400-e29b-41d4-a716-446655440002'",
            ),
        }),
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
        params.parentId || undefined,
      );

      // Create blocks using Tauri's create_block command directly
      const createdBlocks: Array<{
        uuid: string;
        content: string;
        indent: number;
        parentId: string | null;
      }> = [];

      let lastBlockId: string | null = null;

      for (const block of params.blocks) {
        const blockIndent = block.indent ?? 0;
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
              indent: blockIndent,
            },
          });

          createdBlocks.push({
            uuid: newBlock.id,
            content: block.content,
            indent: blockIndent,
            parentId: block.parentBlockId ?? null,
          });

          // Dispatch update for each newly created block
          dispatchBlockUpdate([newBlock]);

          lastBlockId = newBlock.id;
        } catch (blockError) {
          console.error(
            "[createPageWithBlocksTool] Failed to create block:",
            blockError,
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
          blocks: createdBlocks.map((b) => ({
            uuid: b.uuid,
            content: b.content,
            indent: b.indent,
          })),
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
