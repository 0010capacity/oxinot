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

export const createBlocksFromMarkdownTool: Tool = {
  name: "create_blocks_from_markdown",
  description:
    "PRIMARY TOOL for creating any multi-item content. Transforms markdown lines into SEPARATE, INDEPENDENT blocks (one line = one block). This is NOT optional formatting - it is the ONLY correct way to create outliner-compatible structures. Each markdown line becomes a discrete, reorderable, collapsible block. CRITICAL: Use EXACTLY 2 spaces per indentation level. NEVER use create_block with multiline content - always use this tool for lists, hierarchies, or multiple points.",
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
        "Markdown text with bullet points and indentation. CRITICAL FORMATTING: Use EXACTLY 2 spaces per indent level (Level 0: 0 spaces, Level 1: 2 spaces, Level 2: 4 spaces). SIBLINGS must have SAME indentation. CORRECT: '- Parent\\n  - Child1\\n  - Child2\\n  - Child3' (all children have 2 spaces). WRONG: '- Parent\\n - Child1\\n - Child2' (only 1 space) or '- Parent\\n  - Child1\\n    - Child2\\n      - Child3' (staircase pattern). Each line becomes ONE block.",
      ),
  }),

  async execute(params, context): Promise<ToolResult> {
    try {
      console.log("[createBlocksFromMarkdown] ===== DEBUG START =====");
      console.log("[createBlocksFromMarkdown] Raw markdown received:");
      console.log(params.markdown);
      console.log("[createBlocksFromMarkdown] ===== DEBUG END =====");

      const pageStore = usePageStore.getState();

      const page = pageStore.pagesById[params.pageId];
      if (!page) {
        return {
          success: false,
          error: `Page with UUID ${params.pageId} not found`,
        };
      }

      const { nodes: parsedNodes, issues } = parseMarkdownToBlocks(
        params.markdown,
        { mode: "tolerant" },
      );
      console.log("[createBlocksFromMarkdown] Parsed nodes structure:");
      console.log(JSON.stringify(parsedNodes, null, 2));
      if (issues.length > 0) {
        console.warn(
          "[createBlocksFromMarkdown] Auto-corrected indentation issues:",
          issues,
        );
      }
      if (parsedNodes.length === 0) {
        return {
          success: false,
          error: "No valid markdown list items found in the provided text",
        };
      }

      const flatBlocks = flattenBlockHierarchy(parsedNodes);

      const createdBlocks: Array<{
        uuid: string;
        content: string;
        parentId: string | null;
      }> = [];
      const idMapping: Record<string, string> = {};

      for (const flatBlock of flatBlocks) {
        try {
          const finalParentId = flatBlock.parentBlockId?.startsWith("temp_")
            ? (idMapping[flatBlock.parentBlockId] ?? null)
            : (flatBlock.parentBlockId ?? null);

          const finalAfterBlockId = flatBlock.insertAfterBlockId?.startsWith(
            "temp_",
          )
            ? (idMapping[flatBlock.insertAfterBlockId] ?? null)
            : (flatBlock.insertAfterBlockId ?? null);

          const newBlock: BlockData = await invoke<BlockData>("create_block", {
            workspacePath: context.workspacePath,
            request: {
              pageId: params.pageId,
              parentId: finalParentId,
              afterBlockId: finalAfterBlockId,
              content: flatBlock.content,
            },
          });

          if (flatBlock.tempId) {
            idMapping[flatBlock.tempId] = newBlock.id;
          }

          createdBlocks.push({
            uuid: newBlock.id,
            content: flatBlock.content,
            parentId: finalParentId,
          });

          dispatchBlockUpdate([newBlock]);
        } catch (blockError) {
          console.error(
            "[createBlocksFromMarkdownTool] Failed to create block:",
            blockError,
          );
          return {
            success: false,
            error: `Failed to create block "${flatBlock.content}": ${
              blockError instanceof Error
                ? blockError.message
                : String(blockError)
            }`,
          };
        }
      }

      return {
        success: true,
        data: {
          pageId: params.pageId,
          blocksCreated: createdBlocks.length,
          blocks: createdBlocks,
        },
        metadata: {
          message: `Created ${createdBlocks.length} blocks with proper nesting from markdown`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create blocks from markdown",
      };
    }
  },
};
