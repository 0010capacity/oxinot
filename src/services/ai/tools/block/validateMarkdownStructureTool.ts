import { z } from "zod";
import {
  flattenBlockHierarchy,
  parseMarkdownToBlocks,
} from "../../../../utils/markdownBlockParser";
import type { Tool, ToolResult } from "../types";

export const validateMarkdownStructureTool: Tool = {
  name: "validate_markdown_structure",
  description:
    "Validate markdown bullet structure BEFORE creating blocks. Returns structure details and catches syntax errors early. Call this before create_blocks_from_markdown to ensure your markdown will parse correctly.",
  category: "block",
  requiresApproval: false,

  parameters: z.object({
    markdown: z
      .string()
      .describe(
        "Markdown text with bullet points to validate. Example: '- Item 1\\n  - Item 1.1\\n- Item 2'",
      ),
    expectedBlockCount: z
      .number()
      .optional()
      .describe(
        "Expected number of blocks (for validation). If provided, returns whether actual count matches.",
      ),
    maxDepth: z
      .number()
      .optional()
      .describe("Maximum allowed nesting depth. Returns error if exceeded."),
  }),

  async execute(params): Promise<ToolResult> {
    try {
      const parsedNodes = parseMarkdownToBlocks(params.markdown);

      if (parsedNodes.length === 0) {
        return {
          success: false,
          error:
            "No valid bullet items found. Ensure each line starts with '- ' (dash + space).",
          data: {
            isValid: false,
            blockCount: 0,
            maxDepth: 0,
            structure: [],
          },
          metadata: {
            message: "Markdown validation failed - no bullet items detected",
            hint: "Check that every content line starts with '- ' and uses proper 2-space indentation",
          },
        };
      }

      const flatBlocks = flattenBlockHierarchy(parsedNodes);

      function calculateMaxDepth(nodes: typeof parsedNodes): number {
        let max = 0;
        function traverse(node: (typeof nodes)[0], depth: number) {
          max = Math.max(max, depth);
          for (const child of node.children) {
            traverse(child, depth + 1);
          }
        }
        for (const node of nodes) {
          traverse(node, 1);
        }
        return max;
      }

      const maxDepth = calculateMaxDepth(parsedNodes);
      const blockCount = flatBlocks.length;

      const countMatches =
        params.expectedBlockCount === undefined ||
        blockCount === params.expectedBlockCount;

      const depthOK =
        params.maxDepth === undefined || maxDepth <= params.maxDepth;

      const isValid = countMatches && depthOK;

      const warnings: string[] = [];
      if (!countMatches) {
        warnings.push(
          `Block count mismatch: got ${blockCount}, expected ${params.expectedBlockCount}`,
        );
      }
      if (!depthOK) {
        warnings.push(
          `Nesting depth ${maxDepth} exceeds limit ${params.maxDepth}`,
        );
      }

      return {
        success: isValid,
        data: {
          isValid,
          blockCount,
          maxDepth,
          structure: parsedNodes.map((node) => ({
            content: node.content.slice(0, 60),
            depth: 1,
            childCount: node.children.length,
          })),
        },
        metadata: {
          message: `Parsed ${blockCount} blocks, max depth ${maxDepth}${
            !countMatches ? ` (expected ${params.expectedBlockCount})` : ""
          }${!depthOK ? ` (exceeds max depth ${params.maxDepth})` : ""}`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Markdown validation failed",
        data: {
          isValid: false,
          blockCount: 0,
          maxDepth: 0,
          structure: [],
        },
        metadata: {
          message: "Unexpected error during validation",
        },
      };
    }
  },
};
