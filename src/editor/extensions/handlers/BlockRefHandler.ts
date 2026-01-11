/**
 * BlockRef handler for Obsidian/Logseq-style block references.
 *
 * Syntax:
 * - ((uuid))        : normal block link (UUID should not be shown)
 * - !((uuid))       : embed block (UUID should not be shown)
 *
 * Rendering rules (live preview):
 * - Hide the raw markup and show widgets ONLY when cursor is NOT on the line.
 * - When cursor is on the line, show the source code for editing.
 * - Normal refs (()) render as a one-line inline preview widget (read-only) that:
 *   - fetches the referenced block content from the backend
 *   - renders a single line of preview text (truncated)
 *   - remains clickable via `createBlockRefClickHandler`
 * - Embed refs !(( )) render an inline, read-only subtree preview widget.
 *
 * Notes:
 * - This handler is regex/line-based (like WikiLinkHandler), not syntax-tree-based.
 * - The preview widgets are read-only by design, but become editable when cursor enters the line.
 */

import { SyntaxNode } from "@lezer/common";
import { BaseHandler, RenderContext } from "./types";
import type { DecorationSpec } from "../utils/decorationHelpers";
import { createHiddenMarker } from "../utils/decorationHelpers";
import { Decoration, WidgetType, EditorView } from "@codemirror/view";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspaceStore } from "../../../stores/workspaceStore";
import React from "react";
import { createRoot, Root } from "react-dom/client";
import { EmbeddedBlockCard } from "../../../components/EmbeddedBlockCard";
import { MantineProvider } from "@mantine/core";
import { ThemeProvider } from "../../../theme/ThemeProvider";

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
  let m: RegExpExecArray | null;

  while ((m = re.exec(lineText)) !== null) {
    const full = m[0];
    const isEmbed = !!m[1];
    const id = (m[2] ?? "").trim();

    // Only treat as a real block ref when the id looks "complete enough".
    // This avoids applying hide/styling decorations while the user is still typing.
    if (!isProbablyUuid(id)) continue;

    out.push({
      full,
      isEmbed,
      id,
      start: m.index,
      end: m.index + full.length,
    });
  }

  return out;
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
                }),
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
        const res: any = await invoke("get_block", {
          workspacePath,
          request: { block_id: this.blockId },
        });

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
    shouldShowMarkers: boolean,
  ): DecorationSpec[] {
    const decorations: DecorationSpec[] = [];

    const matches = findBlockRefsInLine(lineText);
    for (const match of matches) {
      const from = lineFrom + match.start;
      const to = lineFrom + match.end;

      // Show source code in edit mode (when markers should be shown)
      // This allows the user to edit the source code
      if (shouldShowMarkers) {
        continue;
      }

      const hasBang = match.isEmbed;

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
        // Embed: insert an inline widget (read-only subtree preview)
        decorations.push({
          from,
          to,
          decoration: Decoration.widget({
            widget: new EmbedSubtreeWidget(match.id),
            side: 0,
          }),
        });
      } else {
        // Normal (()) link: render a one-line inline preview widget (read-only).
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

    return decorations;
  }
}
