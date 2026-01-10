/**
 * BlockRef handler for Obsidian/Logseq-style block references.
 *
 * Syntax:
 * - ((uuid))        : normal block link (UUID should not be shown)
 * - !((uuid))       : embed block (UUID should not be shown)
 *
 * Rendering rules (live preview):
 * - Always hide the entire raw markup `((...))` / `!((...))` (including UUID), even on the cursor line.
 *   Editing still works because the document text remains; only the rendering hides it.
 * - Normal refs (()) render as a one-line inline preview widget (read-only) that:
 *   - fetches the referenced block content from the backend
 *   - renders a single line of preview text (truncated)
 *   - remains clickable via `createBlockRefClickHandler`
 * - Embed refs !(( )) render an inline, read-only subtree preview widget.
 *
 * Notes:
 * - This handler is regex/line-based (like WikiLinkHandler), not syntax-tree-based.
 * - The preview widgets are read-only by design.
 */

import { SyntaxNode } from "@lezer/common";
import { BaseHandler, RenderContext } from "./types";
import type { DecorationSpec } from "../utils/decorationHelpers";
import { createHiddenMarker } from "../utils/decorationHelpers";
import { Decoration, WidgetType } from "@codemirror/view";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspaceStore } from "../../../stores/workspaceStore";

type BlockRefMatch = {
  full: string;
  isEmbed: boolean;
  id: string;
  start: number;
  end: number;
};

type EmbedBlock = {
  id: string;
  parent_id: string | null;
  content: string;
  order_weight: number;
  is_collapsed: boolean;
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

  constructor(blockId: string) {
    super();
    this.blockId = blockId;
  }

  eq(other: EmbedSubtreeWidget) {
    return other.blockId === this.blockId;
  }

  toDOM() {
    const container = document.createElement("div");
    container.className = "cm-block-embed-subtree";
    container.style.margin = "6px 0";
    container.style.paddingLeft = "10px";
    container.style.borderLeft = "2px solid rgba(139, 92, 246, 0.25)";
    container.style.background = "rgba(139, 92, 246, 0.05)";
    container.style.borderRadius = "6px";
    container.style.paddingTop = "6px";
    container.style.paddingBottom = "6px";
    // NOTE: No container click navigation. Only bullets inside the embed navigate.

    const header = document.createElement("div");
    header.style.fontSize = "12px";
    header.style.fontWeight = "600";
    header.style.opacity = "0.75";
    header.style.padding = "0 8px 6px 8px";
    header.textContent = "Embedded block";
    container.appendChild(header);

    const body = document.createElement("div");
    body.style.padding = "0 8px";
    body.style.fontSize = "13px";
    body.style.lineHeight = "1.5";
    body.textContent = "Loading…";
    container.appendChild(body);

    // Fetch subtree asynchronously (read-only)
    const workspacePath = useWorkspaceStore.getState().workspacePath;

    if (!workspacePath) {
      body.textContent = "No workspace selected";
      return container;
    }

    void (async () => {
      try {
        const res: any = await invoke("get_block_subtree", {
          workspacePath,
          request: { block_id: this.blockId, max_depth: 1000 },
        });

        const blocks: EmbedBlock[] = (res ?? []).map((b: any) => ({
          id: b.id,
          parent_id: b.parentId ?? b.parent_id ?? null,
          content: (b.content ?? "").toString(),
          order_weight: b.orderWeight ?? b.order_weight ?? 0,
          is_collapsed: !!(b.isCollapsed ?? b.is_collapsed),
        }));

        body.textContent = "";

        // Build lookup + children map (local, no global mutable state)
        const byId: Record<string, EmbedBlock> = {};
        for (const b of blocks) byId[b.id] = b;

        const childMap: Record<string, string[]> = { root: [] };
        for (const b of blocks) {
          const key = b.parent_id ?? "root";
          if (!childMap[key]) childMap[key] = [];
          childMap[key].push(b.id);
        }
        for (const key of Object.keys(childMap)) {
          childMap[key].sort((a, b) => {
            const ba = byId[a];
            const bb = byId[b];
            return (ba?.order_weight ?? 0) - (bb?.order_weight ?? 0);
          });
        }

        const render = (id: string, depth: number) => {
          const b = byId[id];
          if (!b) return;

          const row = document.createElement("div");
          row.style.display = "flex";
          row.style.gap = "8px";
          row.style.alignItems = "flex-start";
          row.style.paddingLeft = `${depth * 16}px`;

          const bullet = document.createElement("button");
          bullet.type = "button";
          bullet.textContent = "•";
          bullet.style.opacity = "0.55";
          bullet.style.userSelect = "none";
          bullet.style.border = "none";
          bullet.style.background = "transparent";
          bullet.style.cursor = "pointer";
          bullet.style.padding = "0";
          bullet.style.margin = "0";
          bullet.setAttribute("data-embed-bullet", "true");
          bullet.title = "Zoom to this block";
          bullet.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            container.dispatchEvent(
              new CustomEvent("cm-embed-navigate", {
                bubbles: true,
                detail: { blockId: b.id },
              }),
            );
          });
          row.appendChild(bullet);

          const text = document.createElement("div");
          text.textContent = b.content || "Untitled";
          text.style.whiteSpace = "pre-wrap";
          text.style.wordBreak = "break-word";
          row.appendChild(text);

          body.appendChild(row);

          // Respect isCollapsed: do not render children if collapsed
          if (b.is_collapsed) return;

          const kids = childMap[id] ?? [];
          for (const kid of kids) render(kid, depth + 1);
        };

        // Root of embed subtree is the referenced block
        render(this.blockId, 0);
      } catch {
        body.textContent = "Failed to load embed";
      }
    })();

    return container;
  }

  ignoreEvent() {
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
    // Keep it read-only; navigation is handled by the click handler on .cm-block-ref.
    return true;
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
    _isOnCursorLine: boolean,
  ): DecorationSpec[] {
    const decorations: DecorationSpec[] = [];

    const matches = findBlockRefsInLine(lineText);
    for (const match of matches) {
      const from = lineFrom + match.start;
      const to = lineFrom + match.end;

      const hasBang = match.isEmbed;

      const bangStart = from;
      const bangEnd = hasBang ? from + 1 : from;

      const openStart = hasBang ? from + 1 : from;
      const openEnd = openStart + 2;

      // const idEnd = to - 2;

      if (hasBang) {
        // Hide "!" regardless of cursor line
        decorations.push(createHiddenMarker(bangStart, bangEnd, false));
      }

      // Hide "((" regardless of cursor line
      decorations.push(createHiddenMarker(openStart, openEnd, false));

      // Always hide the entire block-ref syntax, including UUID, even on the cursor line.
      // This prevents the UUID from ever becoming visible.
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
