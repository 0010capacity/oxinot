/**
 * WikiLink handler for Obsidian-style internal links
 *
 * Handles wiki-style internal links:
 * - [[note name]] - basic link (inline)
 * - [[note name|display text]] - link with alias (inline)
 * - [[note#heading]] - link to heading (inline)
 * - [[note#^block-id]] - link to block (inline)
 * - [[folder/note]] - folder-style path (inline, shows only the basename)
 * - ![[note name]] - embed page (block-level) - must be alone on its line
 *
 * Rendering rules (live preview):
 * - Hide the [[ ]] markers when cursor is NOT on the line
 * - Show dimmed markers when editing
 * - Normal wiki links [[...]] are INLINE elements:
 *   - can appear inline with other text on the same line
 *   - render as clickable link text
 * - Embed pages ![[...]] are BLOCK-LEVEL elements:
 *   - Must be on their own line (or at the beginning of a line with nothing before)
 *   - Render as a full-width page preview widget
 *   - Cannot coexist with other content on the same line
 *
 * Notes:
 * - This handler is regex/line-based, not syntax-tree-based.
 * - Embed pages enforce block-level rendering: if not alone on a line, they're shown as raw syntax.
 */

import { Decoration, type EditorView, WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { MantineProvider } from "@mantine/core";
import React from "react";
import { type Root, createRoot } from "react-dom/client";
import { EmbeddedPageCard } from "../../../components/EmbeddedPageCard";
import { ThemeProvider } from "../../../theme/ThemeProvider";
import type { DecorationSpec } from "../utils/decorationHelpers";
import {
  createHiddenMarker,
  createStyledText,
} from "../utils/decorationHelpers";
import { BaseHandler, type RenderContext } from "./types";

function getWikiBasename(path: string): string {
  const trimmed = (path ?? "").trim();
  if (!trimmed) return "";
  const parts = trimmed
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : trimmed;
}

/**
 * Check if an embed page is alone on its line (block-level rendering requirement).
 *
 * Returns true only if:
 * - The embed is the only thing on the line, OR
 * - The line has only whitespace around the embed
 *
 * This ensures embed pages are truly block-level, not inline.
 */
function isEmbedPageAlone(
  lineText: string,
  startIndex: number,
  endIndex: number
): boolean {
  const beforeText = lineText.slice(0, startIndex).trim();
  const afterText = lineText.slice(endIndex).trim();

  return beforeText.length === 0 && afterText.length === 0;
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

  toDOM(view: EditorView) {
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
                })
              );
            },
            onEdit: () => {
              // Find the widget position in the document and focus the editor there
              const pos = view.posAtDOM(container);
              if (pos !== null) {
                view.focus();
                view.dispatch({
                  selection: { anchor: pos },
                });
              }
            },
          })
        )
      )
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

  ignoreEvent(event: Event) {
    // Allow button clicks and other interactions within the widget
    const target = event.target as HTMLElement;
    if (target.tagName === "BUTTON" || target.closest("button")) {
      return false;
    }
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
   *
   * @param lineText - The text content of the line
   * @param lineFrom - The absolute position of the line start in the document
   * @param isEditMode - true if block is in edit mode (focused), false if in preview mode (unfocused)
   */
  static processLine(
    lineText: string,
    lineFrom: number,
    isEditMode: boolean
  ): DecorationSpec[] {
    const decorations: DecorationSpec[] = [];

    // First, check for embed pages: ![[page]]
    // BLOCK-LEVEL rendering enforced
    const embedPageRegex = /!\[\[([^\]|]+)\]\]/g;
    let embedMatch = embedPageRegex.exec(lineText);

    while (embedMatch !== null) {
      const fullMatch = embedMatch[0]; // ![[page]]
      const pageName = embedMatch[1]; // page

      const start = embedMatch.index;
      const end = start + fullMatch.length;

      // BLOCK-LEVEL RENDERING ENFORCEMENT:
      // Embed pages ![[page]] must be alone on their line.
      // If there's other content before or after, show raw syntax instead.
      if (!isEditMode && isEmbedPageAlone(lineText, start, end)) {
        const absoluteStart = lineFrom + start;
        const absoluteEnd = lineFrom + end;

        // Hide the entire ![[page]] syntax
        decorations.push(createHiddenMarker(absoluteStart, absoluteEnd, false));

        // Insert embed widget (block-level)
        decorations.push({
          from: absoluteStart,
          to: absoluteEnd,
          decoration: Decoration.widget({
            widget: new EmbedPageWidget(pageName),
            side: 0,
          }),
        });
      }
      // If not alone or in edit mode, don't render widget - show raw syntax

      embedMatch = embedPageRegex.exec(lineText);
    }

    // Match wiki links: [[link]] or [[link|alias]] (but not ![[link]])
    // INLINE rendering only
    const wikiLinkRegex = /(?<!!)(\[\[([^\]|]+)(\|([^\]]+))?\]\])/g;
    let match = wikiLinkRegex.exec(lineText);

    while (match !== null) {
      const fullMatch = match[1]; // [[note|alias]]
      const noteName = match[2]; // note (or folder/note)
      const hasAlias = match[3] !== undefined;
      const aliasText = match[4]; // alias (if exists)

      const start = lineFrom + match.index;
      const end = start + fullMatch.length;

      // In edit mode, show raw markdown for editing
      // This allows the user to edit the source code and see autocomplete
      if (!isEditMode) {
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
                color: var(--color-accent);
                cursor: pointer;
                font-weight: 500;
                text-decoration: none !important;
              `,
            })
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
                color: var(--color-accent);
                cursor: pointer;
                font-weight: 500;
                text-decoration: none !important;
              `,
            })
          );

          // Hide any trailing part (unlikely, but keep safe) - always hide
          if (linkEnd < noteEnd) {
            decorations.push(createHiddenMarker(linkEnd, noteEnd, false));
          }
        }

        // Closing ]] - always hide (even when cursor is on line)
        decorations.push(createHiddenMarker(end - 2, end, false));
      }
      match = wikiLinkRegex.exec(lineText);
    }

    // Sort decorations to ensure proper ordering when multiple items on same line
    decorations.sort((a, b) => {
      if (a.from !== b.from) return a.from - b.from;
      // If same position, prefer wider ranges first (ensures proper nesting)
      return b.to - b.from - (a.to - a.from);
    });

    return decorations;
  }
}
