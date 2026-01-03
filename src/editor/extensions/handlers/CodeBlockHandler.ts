/**
 * Code Block handler for hybrid rendering
 *
 * Handles fenced code blocks (```lang ... ```)
 * - Hides fence markers when cursor is not in block
 * - Shows dimmed markers when editing
 * - Applies monospace font and background styling
 */

import { SyntaxNode } from "@lezer/common";
import { BaseHandler, RenderContext } from "./types";
import { DecorationSpec } from "../utils/decorationHelpers";
import {
  createHiddenMarker,
  createStyledText,
} from "../utils/decorationHelpers";

export class CodeBlockHandler extends BaseHandler {
  constructor() {
    super("CodeBlockHandler");
  }

  canHandle(node: SyntaxNode): boolean {
    return node.type.name === "FencedCode";
  }

  handle(node: SyntaxNode, context: RenderContext): DecorationSpec[] {
    const decorations: DecorationSpec[] = [];
    const content = this.getNodeText(node, context);
    const lines = content.split("\n");

    if (lines.length < 2) {
      return decorations;
    }

    const firstLine = lines[0] || "";
    const lastLine = lines[lines.length - 1] || "";
    const firstLineEnd = node.from + firstLine.length;
    const lastLineStart = node.to - lastLine.length;

    // Check if cursor is in this code block
    const cursorPos = context.cursor.pos;
    const isInCodeBlock = cursorPos >= node.from && cursorPos <= node.to;

    // Hide the opening fence (```lang)
    decorations.push(
      createHiddenMarker(node.from, firstLineEnd, isInCodeBlock)
    );

    // Style the code content between fences
    if (lastLineStart > firstLineEnd + 1) {
      decorations.push(
        createStyledText(firstLineEnd + 1, lastLineStart - 1, {
          className: "cm-code-content",
          style: `
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
            background: rgba(128, 128, 128, 0.1);
            display: block;
            padding: 0.5em;
            border-radius: 4px;
            line-height: 1.5;
          `,
        })
      );
    }

    // Hide the closing fence (```)
    if (lastLine.includes("```")) {
      decorations.push(
        createHiddenMarker(lastLineStart, node.to, isInCodeBlock)
      );
    }

    return decorations;
  }
}
