/**
 * BlockRef handler for Obsidian/Logseq-style block references.
 *
 * Syntax:
 * - ((uuid))        : normal block link (UUID should not be shown)
 * - !((uuid))       : embed block (UUID should not be shown)
 *
 * Rendering rules (live preview):
 * - Hide the wrapping markers: "((", "))", and the leading "!" (embed marker)
 * - Hide the UUID text (must never be visible)
 * - Normal refs (()) render as a token-like highlight (read-only)
 * - Embed refs !(( )) render an inline, read-only subtree preview widget that:
 *   - fetches the block subtree from the backend
 *   - respects `isCollapsed` (do not render children when collapsed)
 *   - only bullet clicks inside the embed navigate (no container click navigation)
 *
 * Notes:
 * - This handler is regex/line-based (like WikiLinkHandler), not syntax-tree-based.
 * - The embed preview is read-only by design.
 */

import { SyntaxNode } from "@lezer/common";
import { BaseHandler, RenderContext } from "./types";
import type { DecorationSpec } from "../utils/decorationHelpers";
import {
  createHiddenMarker,
  createStyledText,
} from "../utils/decorationHelpers";
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
  if (/\s|\)/.test(t)) return false;
  return true;
}

function findBlockRefsInLine(lineText: string): BlockRefMatch[] {
  const re = /(!)?\(\(([^\)\s]+)\)\)/g;

  const out: BlockRefMatch[] = [];
  let m: RegExpExecArray | null;

  while ((m = re.exec(lineText)) !== null) {
    const full = m[0];
    const isEmbed = !!m[1];
    const id = (m[2] ?? "").trim();

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
    isOnCursorLine: boolean,
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

      const idStart = openEnd;
      const idEnd = to - 2;

      const closeStart = idEnd;
      const closeEnd = to;

      if (hasBang) {
        decorations.push(
          createHiddenMarker(bangStart, bangEnd, isOnCursorLine),
        );
      }

      decorations.push(createHiddenMarker(openStart, openEnd, isOnCursorLine));

      // UUID must never be visible
      decorations.push(createHiddenMarker(idStart, idEnd, false));

      if (match.isEmbed) {
        // Embed: insert an inline widget (read-only subtree preview)
        decorations.push({
          from: idStart,
          to: idEnd,
          decoration: Decoration.widget({
            widget: new EmbedSubtreeWidget(match.id),
            side: 0,
          }),
        });
      } else {
        // Normal (()) link: token-like styling only (still clickable via click handler elsewhere)
        decorations.push(
          createStyledText(idStart, idEnd, {
            className: "cm-block-ref",
            style: `
              color: #8b5cf6;
              cursor: pointer;
              font-weight: 500;
              text-decoration: none;
              padding: 0 2px;
              border-radius: 4px;
              background: rgba(139, 92, 246, 0.12);
            `,
          }),
        );
      }

      decorations.push(
        createHiddenMarker(closeStart, closeEnd, isOnCursorLine),
      );
    }

    return decorations;
  }
}
