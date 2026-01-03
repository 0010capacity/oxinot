/**
 * Comment handler for Obsidian-style comments
 *
 * Handles Obsidian-style comments: %%comment text%%
 * - Completely hides comments when cursor is not on line
 * - Shows dimmed comments when cursor is on line (for editing)
 * - Comments are not rendered in the final view
 */

import { SyntaxNode } from "@lezer/common";
import { BaseHandler, RenderContext } from "./types";
import { DecorationSpec } from "../utils/decorationHelpers";
import { Decoration } from "@codemirror/view";

export class CommentHandler extends BaseHandler {
  constructor() {
    super("CommentHandler");
  }

  canHandle(_node: SyntaxNode): boolean {
    // Comments are not in standard markdown, process line-by-line
    return false;
  }

  handle(_node: SyntaxNode, _context: RenderContext): DecorationSpec[] {
    return [];
  }

  /**
   * Process comments in a line of text
   * Called manually from the main rendering loop
   */
  static processLine(
    lineText: string,
    lineFrom: number,
    isOnCursorLine: boolean,
  ): DecorationSpec[] {
    const decorations: DecorationSpec[] = [];

    // Match comments: %%comment%%
    const commentRegex = /%%([^%]+)%%/g;
    let match;

    while ((match = commentRegex.exec(lineText)) !== null) {
      const start = lineFrom + match.index;
      const end = start + match[0].length;

      if (isOnCursorLine) {
        // Show dimmed comment when cursor is on line
        decorations.push({
          from: start,
          to: end,
          decoration: Decoration.mark({
            class: "cm-comment",
            attributes: {
              style: `
                color: #888;
                opacity: 0.6;
                font-style: italic;
                background: rgba(128, 128, 128, 0.1);
                padding: 0.1em 0.3em;
                border-radius: 3px;
              `,
            },
          }),
        });
      } else {
        // Completely hide comment when cursor is not on line
        decorations.push({
          from: start,
          to: end,
          decoration: Decoration.replace({}),
        });
      }
    }

    return decorations;
  }
}
