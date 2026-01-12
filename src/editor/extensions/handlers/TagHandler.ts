/**
 * Tag handler for Obsidian-style hashtags
 *
 * Handles Obsidian-style tags:
 * - #tag - simple tag
 * - #nested/tag - nested tag
 * - #tag-with-dash - tags with dashes
 *
 * - Styles tags with distinct color
 * - Makes tags clickable
 * - Supports nested tags with forward slashes
 */

import { SyntaxNode } from "@lezer/common";
import { BaseHandler, RenderContext } from "./types";
import { DecorationSpec } from "../utils/decorationHelpers";
import { createStyledText } from "../utils/decorationHelpers";

export class TagHandler extends BaseHandler {
  constructor() {
    super("TagHandler");
  }

  canHandle(_node: SyntaxNode): boolean {
    // Tags are not in standard markdown, process line-by-line
    return false;
  }

  handle(_node: SyntaxNode, _context: RenderContext): DecorationSpec[] {
    return [];
  }

  /**
   * Process tags in a line of text
   * Called manually from the main rendering loop
   */
  static processLine(
    lineText: string,
    lineFrom: number,
    _isEditMode: boolean,
  ): DecorationSpec[] {
    const decorations: DecorationSpec[] = [];

    // Match tags: #tag, #nested/tag, #tag-with-dash
    // Must start with # followed by alphanumeric, can contain /, -, _
    // Must not be inside a code block or inline code
    const tagRegex = /#([a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*)/g;
    let match;

    while ((match = tagRegex.exec(lineText)) !== null) {
      const start = lineFrom + match.index;
      const end = start + match[0].length;

      // Check if this tag is at the start of line, after whitespace, or after certain punctuation
      const charBefore = match.index > 0 ? lineText[match.index - 1] : " ";
      const isValidTag = /[\s({\[,.]/.test(charBefore);

      if (!isValidTag) {
        continue; // Skip if not a valid tag position (e.g., inside a word)
      }

      // Style the entire tag including the #
      decorations.push(
        createStyledText(start, end, {
          className: "cm-tag",
          style: `
            color: #10b981;
            background: rgba(16, 185, 129, 0.1);
            padding: 0.1em 0.3em;
            border-radius: 3px;
            cursor: pointer;
            font-weight: 500;
            font-size: 0.95em;
          `,
        }),
      );
    }

    return decorations;
  }
}
