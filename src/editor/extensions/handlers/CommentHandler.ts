/**
 * Comment handler for Obsidian-style comments
 *
 * Handles Obsidian-style comments: %%comment text%%
 * - Completely hides comments when cursor is not on line
 * - Shows dimmed comments when cursor is on line (for editing)
 * - Comments are not rendered in the final view
 */

import { Decoration } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import type { DecorationSpec } from "../utils/decorationHelpers";
import { BaseHandler, type RenderContext } from "./types";

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
    isEditMode: boolean,
  ): DecorationSpec[] {
    const decorations: DecorationSpec[] = [];

    const commentRegex = /%%([^%]+)%%/g;
    let match: RegExpExecArray | null = commentRegex.exec(lineText);

    while (match !== null) {
      const start = lineFrom + match.index;
      const end = start + match[0].length;

      if (isEditMode) {
        // Show dimmed comment in edit mode
        decorations.push({
          from: start,
          to: end,
          decoration: Decoration.mark({
            class: "cm-comment",
            attributes: {
              style: `
                color: var(--color-text-tertiary);
                opacity: 0.6;
                font-style: italic;
                background: var(--color-bg-secondary);
                padding: 0.1em 0.3em;
                border-radius: 3px;
              `,
            },
          }),
        });
      } else {
        // Completely hide comment in preview mode
        decorations.push({
          from: start,
          to: end,
          decoration: Decoration.mark({
            class: "cm-hidden",
            attributes: {
              style: "font-size: 0; opacity: 0;",
            },
          }),
        });
      }
      match = commentRegex.exec(lineText);
    }

    return decorations;
  }
}
