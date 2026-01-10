/**
 * WikiLink handler for Obsidian-style internal links
 *
 * Handles wiki-style internal links:
 * - [[note name]] - basic link
 * - [[note name|display text]] - link with alias
 * - [[note#heading]] - link to heading
 * - [[note#^block-id]] - link to block
 * - [[folder/note]] - folder-style path (render shows only the basename by default)
 *
 * - Styles the link text as clickable
 * - Hides or dims the [[ ]] markers based on cursor position
 * - Differentiates between note name and display text
 */

import { SyntaxNode } from "@lezer/common";
import { BaseHandler, RenderContext } from "./types";
import { DecorationSpec } from "../utils/decorationHelpers";
import {
  createHiddenMarker,
  createStyledText,
} from "../utils/decorationHelpers";

function getWikiBasename(path: string): string {
  const trimmed = (path ?? "").trim();
  if (!trimmed) return "";
  const parts = trimmed
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : trimmed;
}

export class WikiLinkHandler extends BaseHandler {
  constructor() {
    super("WikiLinkHandler");
  }

  canHandle(_node: SyntaxNode): boolean {
    // Wiki links are not in standard markdown, so we need to detect them via regex
    // This handler will be called from line-by-line processing, not tree traversal
    return false;
  }

  handle(_node: SyntaxNode, _context: RenderContext): DecorationSpec[] {
    // This handler is called from line-by-line processing
    return [];
  }

  /**
   * Process wiki links in a line of text
   * Called manually from the main rendering loop
   */
  static processLine(
    lineText: string,
    lineFrom: number,
    isOnCursorLine: boolean,
  ): DecorationSpec[] {
    const decorations: DecorationSpec[] = [];

    // Match wiki links: [[link]] or [[link|alias]]
    const wikiLinkRegex = /\[\[([^\]|]+)(\|([^\]]+))?\]\]/g;
    let match;

    while ((match = wikiLinkRegex.exec(lineText)) !== null) {
      const fullMatch = match[0]; // [[note|alias]]
      const noteName = match[1]; // note (or folder/note)
      const hasAlias = match[2] !== undefined;
      const aliasText = match[3]; // alias (if exists)

      const start = lineFrom + match.index;
      const end = start + fullMatch.length;

      // Opening [[
      decorations.push(createHiddenMarker(start, start + 2, isOnCursorLine));

      if (hasAlias) {
        // Format: [[note|alias]]
        // We want to show only the alias, hide the note name and |

        const noteStart = start + 2;
        const noteEnd = noteStart + noteName.length;
        const pipePos = noteEnd;
        const aliasStart = pipePos + 1;
        const aliasEnd = aliasStart + aliasText.length;

        // Hide the note name
        decorations.push(
          createHiddenMarker(noteStart, noteEnd, isOnCursorLine),
        );

        // Hide the pipe |
        decorations.push(
          createHiddenMarker(pipePos, pipePos + 1, isOnCursorLine),
        );

        // Style the alias text as a wiki link
        decorations.push(
          createStyledText(aliasStart, aliasEnd, {
            className: "cm-wiki-link",
            style: `
              color: #8b5cf6;
              text-decoration: none;
              cursor: pointer;
              font-weight: 500;
            `,
          }),
        );
      } else {
        // Format: [[note]]
        // Render only the basename by default (e.g., [[A/B/C]] shows "C")

        const noteStart = start + 2;
        const noteEnd = noteStart + noteName.length;

        const basename = getWikiBasename(noteName);
        const basenameIndex = noteName.lastIndexOf(basename);

        // If we can't reliably locate basename, fall back to full note range.
        const linkStart =
          basename && basenameIndex >= 0
            ? noteStart + basenameIndex
            : noteStart;
        const linkEnd =
          linkStart + (basename ? basename.length : noteName.length);

        // Hide any leading path part (A/B/)
        if (linkStart > noteStart) {
          decorations.push(
            createHiddenMarker(noteStart, linkStart, isOnCursorLine),
          );
        }

        decorations.push(
          createStyledText(linkStart, linkEnd, {
            className: "cm-wiki-link",
            style: `
              color: #8b5cf6;
              text-decoration: none;
              cursor: pointer;
              font-weight: 500;
            `,
          }),
        );

        // Hide any trailing part (unlikely, but keep safe)
        if (linkEnd < noteEnd) {
          decorations.push(
            createHiddenMarker(linkEnd, noteEnd, isOnCursorLine),
          );
        }
      }

      // Closing ]]
      decorations.push(createHiddenMarker(end - 2, end, isOnCursorLine));
    }

    return decorations;
  }
}
