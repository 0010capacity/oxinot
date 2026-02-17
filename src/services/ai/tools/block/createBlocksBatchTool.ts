import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import { dispatchBlockUpdate } from "../../../../events";
import type { BlockData } from "../../../../stores/blockStore";
import { usePageStore } from "../../../../stores/pageStore";
import {
  flattenBlockHierarchy,
  parseMarkdownToBlocks,
} from "../../../../utils/markdownBlockParser";
import type { Tool, ToolResult } from "../types";

export const createBlocksBatchTool: Tool = {
  name: "create_blocks_batch",
  description:
    "Efficiently create 100+ blocks at once from indented markdown. Uses a single batch operation for better performance than creating blocks one at a time. This is the PREFERRED tool for creating multiple blocks, lists, or hierarchical structures. Each line in the markdown becomes a separate block, and indentation determines parent-child nesting. Never use single-block tools (create_block, insert_block_below) in a loop when this tool can do it in one call.",
  category: "block",
  requiresApproval: false,

  parameters: z.object({
    pageId: z
      .string()
      .uuid()
      .describe(
        "UUID of the page where blocks will be created. Example: '550e8400-e29b-41d4-a716-446655440000'",
      ),
    markdown: z
      .string()
      .describe(
        "Markdown text with bullet points and indentation. Each line becomes a block, indentation determines nesting. Example: '- Item 1\\n  - Item 1.1\\n  - Item 1.2\\n- Item 2'",
      ),
  }),

  async execute(params, context): Promise<ToolResult> {
    try {
      const pageStore = usePageStore.getState();

      const page = pageStore.pagesById[params.pageId];
      if (!page) {
        return {
          success: false,
          error: `Page with UUID ${params.pageId} not found`,
        };
      }

      const parsedNodes = parseMarkdownToBlocks(params.markdown);
      console.log("[create_blocks_batch] Parsed nodes:", parsedNodes.length);

      if (parsedNodes.length === 0) {
        return {
          success: false,
          error: "No valid markdown list items found in the provided text",
        };
      }

      const flatBlocks = flattenBlockHierarchy(parsedNodes);
      console.log("[create_blocks_batch] Flattened blocks:", flatBlocks.length);

      const blockRequests = flatBlocks.map((flatBlock) => ({
        pageId: params.pageId,
        parentId: flatBlock.parentBlockId?.startsWith("temp_")
          ? null
          : (flatBlock.parentBlockId ?? null),
        afterBlockId: flatBlock.insertAfterBlockId?.startsWith("temp_")
          ? null
          : (flatBlock.insertAfterBlockId ?? null),
        content: flatBlock.content,
        blockType: "bullet" as const,
      }));

      console.log("[create_blocks_batch] Block requests prepared:", {
        count: blockRequests.length,
        pageId: params.pageId,
        firstRequest: blockRequests[0],
        lastRequest: blockRequests[blockRequests.length - 1],
      });

      const batchResponse = await invoke<{
        blocks: BlockData[];
        created_count: number;
      }>("create_blocks_batch", {
        workspacePath: context.workspacePath,
        request: {
          pageId: params.pageId,
          blocks: blockRequests,
        },
      });

      for (const block of batchResponse.blocks) {
        dispatchBlockUpdate([block]);
      }

      return {
        success: true,
        data: {
          pageId: params.pageId,
          blocksCreated: batchResponse.created_count,
          blocks: batchResponse.blocks.map((b) => ({
            uuid: b.id,
            content: b.content,
            parentId: b.parentId,
          })),
        },
        metadata: {
          message: `Batch created ${batchResponse.created_count} blocks with proper nesting from markdown`,
          count: batchResponse.created_count,
        },
      };
    } catch (error) {
      // Log the actual error for debugging
      console.error("[create_blocks_batch] Error:", error);
      if (error instanceof Error) {
        console.error("[create_blocks_batch] Error message:", error.message);
        console.error("[create_blocks_batch] Error stack:", error.stack);
      }

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to batch create blocks from markdown",
      };
    }
  },
};
