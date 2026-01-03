/**
 * Highlight handler for Obsidian-style text highlighting
 *
 * Handles highlighted text: ==highlighted text==
 * - Applies yellow background to highlighted text
 * - Hides == markers when cursor is not on line
 * - Shows dimmed markers when editing
 */

import { SyntaxNode } from "@lezer/common";
import { BaseHandler, RenderContext } from "./types";
import { DecorationSpec } from "../utils/decorationHelpers";
import {
  createHiddenMarker,
  createStyledText,
} from "../utils/decorationHelpers";

export class HighlightHandler extends BaseHandler {
  constructor() {
    super("HighlightHandler");
  }

  canHandle(_node: SyntaxNode): boolean {
    // Highlights are not in standard markdown, process line-by-line
    return false;
  }

  handle(_node: SyntaxNode, _context: RenderContext): DecorationSpec[] {
    return [];
  }

  /**
   * Process highlights in a line of text
   * Called manually from the main rendering loop
   */
  static processLine(
    lineText: string,
    lineFrom: number,
    isOnCursorLine: boolean,
  ): DecorationSpec[] {
    const decorations: DecorationSpec[] = [];

    // Match highlights: ==text==
    const highlightRegex: RegExp = /==([^=]+)==/g;
    let match: RegExpExecArray | null;

    while ((match = highlightRegex.exec(lineText)) !== null) {
      const start = lineFrom + match.index;
      const end = start + match[0].length;
      const contentStart = start + 2;
      const contentEnd = end - 2;

      // Hide opening ==
      decorations.push(
        createHiddenMarker(start, start + 2, isOnCursorLine),
      );

      // Style the highlighted content
      decorations.push(
        createStyledText(contentStart, contentEnd, {
          className: "cm-highlight",
          style: `
            background: linear-gradient(to bottom, rgba(255, 235, 59, 0.3), rgba(255, 235, 59, 0.4));
            padding: 0.1em 0.2em;
            border-radius: 2px;
            font-weight: 500;
          `,
        }),
      );

      // Hide closing ==
      decorations.push(
        createHiddenMarker(end - 2, end, isOnCursorLine),
      );
    }

    return decorations;
  }
}
