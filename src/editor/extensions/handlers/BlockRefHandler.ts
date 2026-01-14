/**
 * BlockRef handler for Obsidian/Logseq-style block references.
 *
 * Syntax:
 * - ((uuid))        : normal block link (inline) - UUID should not be shown
 * - !((uuid))       : embed block (block-level) - UUID should not be shown
 *
 * Rendering rules (live preview):
 * - Hide the raw markup and show widgets ONLY when cursor is NOT on the line.
 * - When cursor is on the line, show the source code for editing.
 * - Normal refs (()) render as a one-line inline preview widget (read-only) that:
 *   - fetches the referenced block content from the backend
 *   - renders a single line of preview text (truncated)
 *   - remains clickable via `createBlockRefClickHandler`
 *   - can appear inline with other text on the same line
 * - Embed refs !((uuid)) are BLOCK-LEVEL elements:
 *   - Must be on their own line (or at the beginning of a line with nothing before)
 *   - Render as a full-width block preview widget
 *   - Cannot coexist with other content on the same line
 *
 * Notes:
 * - This handler is regex/line-based (like WikiLinkHandler), not syntax-tree-based.
 * - The preview widgets are read-only by design, but become editable when cursor enters the line.
 * - Block embeds enforce block-level rendering: if not alone on a line, they're shown as raw syntax.
 */

import { Decoration, type EditorView, WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { MantineProvider } from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import React from "react";
import { type Root, createRoot } from "react-dom/client";
import { EmbeddedBlockCard } from "../../../components/EmbeddedBlockCard";
import { useWorkspaceStore } from "../../../stores/workspaceStore";
import { ThemeProvider } from "../../../theme/ThemeProvider";
import type { DecorationSpec } from "../utils/decorationHelpers";
import { createHiddenMarker } from "../utils/decorationHelpers";
import { BaseHandler, type RenderContext } from "./types";

type BlockRefMatch = {
  full: string;
  isEmbed: boolean;
  id: string;
  start: number;
  end: number;
};

function isProbablyUuid(text: string): boolean {
  const t = text.trim();
  if (!t) return false;

  // Reject obviously incomplete / in-progress edits (prevents hiding user input while typing)
  if (t.length < 8) return false;

  // Basic sanity: no whitespace or closing parens inside the id capture
  if (/\s|\)/.test(t)) return false;

  // Accept UUID-ish tokens (hyphenated), or any long-enough opaque id token.
  const uuidLike =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t);
  return uuidLike || t.length >= 16;
}

function findBlockRefsInLine(lineText: string): BlockRefMatch[] {
  const re = /(!)?\(\(([^)\s]+)\)\)/g;

  const out: BlockRefMatch[] = [];
  let m = re.exec(lineText);

  while (m !== null) {
    const full = m[0];
    const isEmbed = !!m[1];
    const id = (m[2] ?? "").trim();

    // Only treat as a real block ref when the id looks "complete enough".
    // This avoids applying hide/styling decorations while the user is still typing.
    if (isProbablyUuid(id)) {
      out.push({
        full,
        isEmbed,
        id,
        start: m.index,
        end: m.index + full.length,
      });
    }

    m = re.exec(lineText);
  }

  return out;
}

/**
 * Check if an embed block is alone on its line (block-level rendering requirement).
 *
 * Returns true only if:
 * - The embed is the only thing on the line, OR
 * - The line has only whitespace around the embed
 *
 * This ensures embed blocks are truly block-level, not inline.
 */
function isEmbedBlockAlone(lineText: string, match: BlockRefMatch): boolean {
  const beforeText = lineText.slice(0, match.start).trim();
  const afterText = lineText.slice(match.end).trim();

  return beforeText.length === 0 && afterText.length === 0;
}

class EmbedSubtreeWidget extends WidgetType {
  private readonly blockId: string;
  private root: Root | null = null;

  constructor(blockId: string) {
    super();
    this.blockId = blockId;
  }

  eq(other: EmbedSubtreeWidget) {
    return other.blockId === this.blockId;
  }

  toDOM(view: EditorView) {
    const container = document.createElement("div");
    container.className = "cm-block-embed-subtree";

    // Create React root and render EmbeddedBlockCard with providers
    this.root = createRoot(container);
    this.root.render(
      React.createElement(
        MantineProvider,
        { defaultColorScheme: "dark" },
        React.createElement(
          ThemeProvider,
          null,
          React.createElement(EmbeddedBlockCard, {
            blockId: this.blockId,
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

class BlockRefPreviewWidget extends WidgetType {
  private readonly blockId: string;

  constructor(blockId: string) {
    super();
    this.blockId = blockId;
  }

  eq(other: BlockRefPreviewWidget) {
    return other.blockId === this.blockId;
  }

  toDOM() {
    const el = document.createElement("span");
    el.className = "cm-block-ref cm-block-ref-preview";

    // Attach the referenced id so click navigation can use it without needing to parse the doc.
    el.setAttribute("data-block-id", this.blockId);

    el.style.display = "inline-flex";
    el.style.alignItems = "center";
    el.style.maxWidth = "min(520px, 70vw)";
    el.style.whiteSpace = "nowrap";
    el.style.overflow = "hidden";
    el.style.textOverflow = "ellipsis";
    el.style.verticalAlign = "baseline";

    // Token-like fallback while loading
    el.textContent = "Block…";

    const workspacePath = useWorkspaceStore.getState().workspacePath;
    if (!workspacePath) {
      el.textContent = "No workspace";
      el.style.opacity = "0.7";
      return el;
    }

    void (async () => {
      try {
        const res = (await invoke("get_block", {
          workspacePath,
          request: { block_id: this.blockId },
        })) as {
          block?: { content: string };
          Block?: { content: string };
        } | null;

        // Debug logging to understand response shape and load failures
        console.debug("[BlockRefPreviewWidget] get_block response", {
          blockId: this.blockId,
          hasRes: !!res,
          resKeys:
            res && typeof res === "object" ? Object.keys(res as object) : null,
          sample: res,
        });

        const block = res?.block ?? res?.Block ?? null;
        const content = (block?.content ?? "").toString().trim();

        if (!content) {
          console.debug("[BlockRefPreviewWidget] empty block content", {
            blockId: this.blockId,
            resolvedBlockKeys:
              block && typeof block === "object"
                ? Object.keys(block as object)
                : null,
            block,
          });

          el.textContent = "Untitled block";
          el.style.opacity = "0.75";
          return;
        }

        // Single-line preview (collapse whitespace + truncate)
        const oneLine = content.replace(/\s+/g, " ").trim();
        el.textContent = oneLine;
      } catch (err) {
        console.debug("[BlockRefPreviewWidget] failed to fetch block preview", {
          blockId: this.blockId,
          workspacePath,
          error: err,
        });

        el.textContent = "Missing block";
        el.style.opacity = "0.7";
      }
    })();

    return el;
  }

  ignoreEvent() {
    // IMPORTANT:
    // Returning `true` here causes CodeMirror to ignore DOM events that happen on this widget,
    // which prevents the editor-level click handler (`createBlockRefClickHandler`) from firing.
    // We want clicks to bubble so the app can zoom/navigate to the referenced block.
    return false;
  }
}

export class BlockRefHandler extends BaseHandler {
  constructor() {
    super("BlockRefHandler");
  }

  canHandle(_node: SyntaxNode): boolean {
    return false;
  }

  handle(_node: SyntaxNode, _context: RenderContext): DecorationSpec[] {
    return [];
  }

  static processLine(
    lineText: string,
    lineFrom: number,
    isEditMode: boolean
  ): DecorationSpec[] {
    const decorations: DecorationSpec[] = [];

    const matches = findBlockRefsInLine(lineText);
    for (const match of matches) {
      const from = lineFrom + match.start;
      const to = lineFrom + match.end;

      // In edit mode, show raw markdown for editing
      // Don't hide anything and don't show widgets
      if (isEditMode) {
        continue;
      }

      const hasBang = match.isEmbed;

      // BLOCK-LEVEL RENDERING ENFORCEMENT:
      // Embed blocks !((uuid)) must be alone on their line.
      // If there's other content before or after, show raw syntax instead.
      if (hasBang && !isEmbedBlockAlone(lineText, match)) {
        // Embed block is not alone: skip rendering widget, show raw syntax
        continue;
      }

      const bangStart = from;
      const bangEnd = hasBang ? from + 1 : from;

      const openStart = hasBang ? from + 1 : from;
      const openEnd = openStart + 2;

      if (hasBang) {
        // Hide "!"
        decorations.push(createHiddenMarker(bangStart, bangEnd, false));
      }

      // Hide "(("
      decorations.push(createHiddenMarker(openStart, openEnd, false));

      // Hide the entire block-ref syntax, including UUID
      decorations.push(createHiddenMarker(from, to, false));

      if (match.isEmbed) {
        // BLOCK-LEVEL EMBED: insert a block-level widget (full-width subtree preview)
        // Side=0 places widget at the reference start
        decorations.push({
          from,
          to,
          decoration: Decoration.widget({
            widget: new EmbedSubtreeWidget(match.id),
            side: 0,
          }),
        });
      } else {
        // INLINE LINK: render a one-line inline preview widget (read-only).
        // Place the widget at the reference start so it remains visible/clickable
        // while the raw markup is hidden.
        decorations.push({
          from,
          to,
          decoration: Decoration.widget({
            widget: new BlockRefPreviewWidget(match.id),
            side: 0,
          }),
        });
      }
    }

    // Sort decorations to ensure proper ordering when multiple refs on same line
    decorations.sort((a, b) => {
      if (a.from !== b.from) return a.from - b.from;
      // If same position, prefer wider ranges first (ensures proper nesting)
      return b.to - b.from - (a.to - a.from);
    });

    return decorations;
  }
}
