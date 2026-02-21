import { z } from "zod";
import {
  flattenBlockHierarchy,
  normalizeMarkdownIndentation,
  parseMarkdownToBlocks,
} from "../../../../utils/markdownBlockParser";
import type { Tool, ToolResult } from "../types";

export const validateMarkdownStructureTool: Tool = {
  name: "validate_markdown_structure",
  description:
    "Validate markdown bullet structure BEFORE creating blocks. Returns structure details and catches syntax errors early. Call this before create_blocks_from_markdown to ensure your markdown will parse correctly. CRITICAL: Markdown MUST use EXACTLY 2 spaces per indent level. Siblings MUST have SAME indentation (not staircase pattern).",
  category: "block",
  requiresApproval: false,

  parameters: z.object({
    markdown: z
      .string()
      .describe(
        "Markdown text with bullet points to validate. MUST use EXACTLY 2 spaces per indent level (not 1 space, not tabs). Siblings at same level MUST have same indentation. CORRECT: '- Parent\\n  - Child1\\n  - Child2\\n  - Child3' (all children 2 spaces). WRONG: '- Parent\\n - Child1' (1 space) or '- Parent\\n  - Child1\\n    - Child2\\n      - Child3' (staircase).",
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
      const { issues: indentationIssues } = normalizeMarkdownIndentation(
        params.markdown,
      );

      const { nodes: parsedNodes } = parseMarkdownToBlocks(params.markdown, {
        mode: "strict",
      });

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

      const isValid = countMatches && depthOK && indentationIssues.length === 0;

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
      if (indentationIssues.length > 0) {
        warnings.push(
          `${indentationIssues.length} line(s) have odd indentation (should use 2 spaces per level)`,
        );
      }

      return {
        success: true,
        data: {
          isValid,
          blockCount,
          maxDepth,
          indentationIssues,
          structure: parsedNodes.map((node) => ({
            content: node.content.slice(0, 60),
            depth: 1,
            childCount: node.children.length,
          })),
          warnings,
        },
        metadata: {
          message: `Parsed ${blockCount} blocks, max depth ${maxDepth}${
            !countMatches ? ` (expected ${params.expectedBlockCount})` : ""
          }${!depthOK ? ` (exceeds max depth ${params.maxDepth})` : ""}${
            indentationIssues.length > 0
              ? ` (${indentationIssues.length} indentation issues)`
              : ""
          }`,
        },
      };
    } catch (error) {
      // Only return false on actual errors, not validation failures
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Markdown validation failed",
        data: {
          isValid: false,
          blockCount: 0,
          maxDepth: 0,
          structure: [],
          warnings: [],
        },
        metadata: {
          message: "Unexpected error during validation",
        },
      };
    }
  },
};
