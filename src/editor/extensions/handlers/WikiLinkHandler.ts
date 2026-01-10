/**
 * WikiLink handler for Obsidian-style internal links
 *
 * Handles wiki-style internal links:
 * - [[note name]] - basic link
 * - [[note name|display text]] - link with alias
 * - [[note#heading]] - link to heading
 * - [[note#^block-id]] - link to block
 * - [[folder/note]] - folder-style path (render shows only the basename by default)
 * - ![[note name]] - embed page
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
import { Decoration, WidgetType } from "@codemirror/view";
import React from "react";
import { createRoot, Root } from "react-dom/client";
import { EmbeddedPageCard } from "../../../components/EmbeddedPageCard";
import { MantineProvider } from "@mantine/core";
import { ThemeProvider } from "../../../theme/ThemeProvider";

function getWikiBasename(path: string): string {
  const trimmed = (path ?? "").trim();
  if (!trimmed) return "";
  const parts = trimmed
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : trimmed;
}

class EmbedPageWidget extends WidgetType {
  private readonly pageName: string;
  private root: Root | null = null;

  constructor(pageName: string) {
    super();
    this.pageName = pageName;
  }

  eq(other: EmbedPageWidget) {
    return other.pageName === this.pageName;
  }

  toDOM() {
    const container = document.createElement("div");
    container.className = "cm-page-embed";

    // Create React root and render EmbeddedPageCard with providers
    this.root = createRoot(container);
    this.root.render(
      React.createElement(
        MantineProvider,
        { defaultColorScheme: "dark" },
        React.createElement(
          ThemeProvider,
          null,
          React.createElement(EmbeddedPageCard, {
            pageName: this.pageName,
            onNavigate: (blockId: string) => {
              // Dispatch navigation event
              container.dispatchEvent(
                new CustomEvent("cm-embed-navigate", {
                  bubbles: true,
                  detail: { blockId },
                }),
              );
            },
          }),
        ),
      ),
    );

    return container;
  }

  destroy() {
    // Clean up React root when widget is destroyed
    // Use setTimeout to avoid "synchronously unmount while rendering" error
    if (this.root) {
      const rootToUnmount = this.root;
      this.root = null;
      setTimeout(() => {
        rootToUnmount.unmount();
      }, 0);
    }
  }

  ignoreEvent() {
    // Make embed read-only: do not let the editor treat it as editable content.
    return true;
  }
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

    // First, check for embed pages: ![[page]]
    const embedPageRegex = /!\[\[([^\]|]+)\]\]/g;
    let embedMatch;

    while ((embedMatch = embedPageRegex.exec(lineText)) !== null) {
      const fullMatch = embedMatch[0]; // ![[page]]
      const pageName = embedMatch[1]; // page

      const start = lineFrom + embedMatch.index;
      const end = start + fullMatch.length;

      // Hide the entire ![[page]] syntax
      decorations.push(createHiddenMarker(start, end, false));

      // Insert embed widget
      decorations.push({
        from: start,
        to: end,
        decoration: Decoration.widget({
          widget: new EmbedPageWidget(pageName),
          side: 0,
        }),
      });
    }

    // Match wiki links: [[link]] or [[link|alias]] (but not ![[link]])
    const wikiLinkRegex = /(?<!!)(\[\[([^\]|]+)(\|([^\]]+))?\]\])/g;
    let match;

    while ((match = wikiLinkRegex.exec(lineText)) !== null) {
      const fullMatch = match[1]; // [[note|alias]]
      const noteName = match[2]; // note (or folder/note)
      const hasAlias = match[3] !== undefined;
      const aliasText = match[4]; // alias (if exists)

      const start = lineFrom + match.index;
      const end = start + fullMatch.length;

      // Opening [[ - always hide (even when cursor is on line)
      decorations.push(createHiddenMarker(start, start + 2, false));

      if (hasAlias) {
        // Format: [[note|alias]]
        // We want to show only the alias, hide the note name and |

        const noteStart = start + 2;
        const noteEnd = noteStart + noteName.length;
        const pipePos = noteEnd;
        const aliasStart = pipePos + 1;
        const aliasEnd = aliasStart + aliasText.length;

        // Hide the note name - always hide
        decorations.push(createHiddenMarker(noteStart, noteEnd, false));

        // Hide the pipe | - always hide
        decorations.push(createHiddenMarker(pipePos, pipePos + 1, false));

        // Style the alias text as a wiki link
        decorations.push(
          createStyledText(aliasStart, aliasEnd, {
            className: "cm-wiki-link",
            style: `
              color: #8b5cf6;
              cursor: pointer;
              font-weight: 500;
              text-decoration: none !important;
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

        // Hide any leading path part (A/B/) - always hide
        if (linkStart > noteStart) {
          decorations.push(createHiddenMarker(noteStart, linkStart, false));
        }

        decorations.push(
          createStyledText(linkStart, linkEnd, {
            className: "cm-wiki-link",
            style: `
              color: #8b5cf6;
              cursor: pointer;
              font-weight: 500;
              text-decoration: none !important;
            `,
          }),
        );

        // Hide any trailing part (unlikely, but keep safe) - always hide
        if (linkEnd < noteEnd) {
          decorations.push(createHiddenMarker(linkEnd, noteEnd, false));
        }
      }

      // Closing ]] - always hide (even when cursor is on line)
      decorations.push(createHiddenMarker(end - 2, end, false));
    }

    return decorations;
  }
}
