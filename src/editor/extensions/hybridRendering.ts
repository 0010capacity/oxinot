/**
 * Hybrid Markdown Rendering System
 *
 * This module implements a handler-based system for rendering markdown elements
 * inline within the CodeMirror editor. It uses a plugin architecture where each
 * markdown element type is handled by a dedicated handler.
 *
 * Improvements in this version:
 * - IME safety: avoid aggressive decoration rebuilds during composition (e.g., Korean)
 * - Better performance: compute decorations only for merged visible ranges
 * - Line-by-line features (wiki links/tags/highlights/comments/callouts/tables/strike/footnotes)
 *   are processed only for visible lines (plus a small buffer).
 */

import { syntaxTree } from "@codemirror/language";
import { Compartment, Facet, RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";

import { BlockquoteHandler } from "./handlers/BlockquoteHandler";
import { CodeBlockHandler } from "./handlers/CodeBlockHandler";
import { EmphasisHandler } from "./handlers/EmphasisHandler";
// Import standard markdown handlers
import { HeadingHandler } from "./handlers/HeadingHandler";
import { InlineCodeHandler } from "./handlers/InlineCodeHandler";
import { LinkHandler } from "./handlers/LinkHandler";
import { SetextHeadingHandler } from "./handlers/SetextHeadingHandler";
import { StrongHandler } from "./handlers/StrongHandler";
import { TaskListHandler } from "./handlers/TaskListHandler";

import { BlockRefHandler } from "./handlers/BlockRefHandler";
import { CalloutHandler } from "./handlers/CalloutHandler";
import { CommentHandler } from "./handlers/CommentHandler";
import { HighlightHandler } from "./handlers/HighlightHandler";
import { TagHandler } from "./handlers/TagHandler";
// Import Obsidian-specific handlers
import { WikiLinkHandler } from "./handlers/WikiLinkHandler";

// Import handler system
import { HandlerRegistry } from "./handlers/HandlerRegistry";
import type { RenderContext } from "./handlers/types";
import {
  type DecorationSpec,
  sortDecorations,
} from "./utils/decorationHelpers";
import { getCursorInfo } from "./utils/nodeHelpers";

type VisibleRange = { from: number; to: number };

/**
 * Facet for tracking whether the editor is focused for rendering purposes.
 * This is used to control markdown marker visibility in outliner blocks.
 */
export const isFocusedFacet = Facet.define<boolean, boolean>({
  combine: (values) => values[values.length - 1] ?? false,
});

/**
 * Compartment for isFocused facet to allow dynamic reconfiguration
 */
export const isFocusedCompartment = new Compartment();

const VISIBLE_LINE_BUFFER = 2;

/**
 * Initialize the handler registry with all handlers
 */
function createHandlerRegistry(): HandlerRegistry {
  const registry = new HandlerRegistry();

  // Register all handlers
  // Order matters - handlers are checked in registration order
  registry.registerAll([
    new TaskListHandler(), // Check task lists before generic list items
    new HeadingHandler(), // ATX Headings (# ## ###)
    new SetextHeadingHandler(), // Setext Headings (underlined with === or ---)
    new StrongHandler(), // Bold (before emphasis to catch ** before *)
    new EmphasisHandler(), // Italic
    new InlineCodeHandler(), // Inline code
    new CodeBlockHandler(), // Code blocks
    new LinkHandler(), // Links
    new BlockquoteHandler(), // Blockquotes
  ]);

  return registry;
}

// Create singleton registry
const handlerRegistry = createHandlerRegistry();

function mergeRanges(ranges: readonly VisibleRange[]): VisibleRange[] {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((a, b) => a.from - b.from);
  const merged: VisibleRange[] = [];
  let cur = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const r = sorted[i];
    if (r.from <= cur.to) {
      cur.to = Math.max(cur.to, r.to);
    } else {
      merged.push(cur);
      cur = { ...r };
    }
  }

  merged.push(cur);
  return merged;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function getVisibleLineRanges(
  view: EditorView,
  mergedVisibleRanges: VisibleRange[],
  bufferLines: number,
): Array<{ fromLine: number; toLine: number }> {
  const { doc } = view.state;
  const out: Array<{ fromLine: number; toLine: number }> = [];

  for (const r of mergedVisibleRanges) {
    // lineAt expects a valid position in [0..doc.length]
    const fromPos = clamp(r.from, 0, doc.length);
    const toPos = clamp(r.to, 0, doc.length);

    const fromLine = doc.lineAt(fromPos).number;
    const toLine = doc.lineAt(toPos).number;

    out.push({
      fromLine: clamp(fromLine - bufferLines, 1, doc.lines),
      toLine: clamp(toLine + bufferLines, 1, doc.lines),
    });
  }

  // Merge overlapping line ranges to reduce redundant loops
  out.sort((a, b) => a.fromLine - b.fromLine);
  const merged: Array<{ fromLine: number; toLine: number }> = [];
  for (const r of out) {
    const last = merged[merged.length - 1];
    if (!last || r.fromLine > last.toLine) {
      merged.push({ ...r });
    } else {
      last.toLine = Math.max(last.toLine, r.toLine);
    }
  }

  return merged;
}

/**
 * Check if markers should be shown for a line in block-based editor
 *
 * For outliner blocks (single-line editors), we only care about block focus,
 * not individual line cursor position since each block is a single line.
 */
/**
 * Build decorations for the visible range using the handler system.
 *
 * Important:
 * - We compute decorations only for (merged) visible ranges to avoid doing full-doc work.
 * - We still sort all DecorationSpecs at the end (required by CM6).
 */
function buildDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const decorations: DecorationSpec[] = [];

  const mergedVisibleRanges = mergeRanges(view.visibleRanges);

  // Get cursor information once
  const cursor = getCursorInfo(state);

  // Check if block is in edit mode (block is focused in outliner)
  const isEditMode = state.facet(isFocusedFacet);

  // Create render context
  const context: RenderContext = {
    state,
    cursor,
    editorHasFocus: isEditMode,
    isEditMode,
    decorations,
  };

  // Cache syntax tree once per build
  const tree = syntaxTree(state);

  // Syntax-tree-driven handlers: only for visible ranges
  for (const { from, to } of mergedVisibleRanges) {
    tree.iterate({
      from,
      to,
      enter: (node) => {
        const syntaxNode = node.node;

        const nodeDecorations = handlerRegistry.handleNode(syntaxNode, context);
        if (nodeDecorations.length) decorations.push(...nodeDecorations);
        return true;
      },
    });
  }

  // Line-by-line features: only for visible lines (plus buffer)
  const visibleLineRanges = getVisibleLineRanges(
    view,
    mergedVisibleRanges,
    VISIBLE_LINE_BUFFER,
  );

  // Obsidian-esque inline patterns (not represented in syntax tree)
  for (const lr of visibleLineRanges) {
    for (let lineNum = lr.fromLine; lineNum <= lr.toLine; lineNum++) {
      const line = state.doc.line(lineNum);
      const lineText = line.text;

      decorations.push(
        ...WikiLinkHandler.processLine(lineText, line.from, isEditMode),
      );
      decorations.push(
        ...BlockRefHandler.processLine(lineText, line.from, isEditMode),
      );
      decorations.push(
        ...TagHandler.processLine(lineText, line.from, isEditMode),
      );
      decorations.push(
        ...HighlightHandler.processLine(lineText, line.from, isEditMode),
      );
      decorations.push(
        ...CommentHandler.processLine(lineText, line.from, isEditMode),
      );
      decorations.push(
        ...CalloutHandler.processLine(lineText, line.from, isEditMode),
      );
    }
  }

  // Tables (complex logic; keep as is but limited to visible lines)
  for (const lr of visibleLineRanges) {
    for (let lineNum = lr.fromLine; lineNum <= lr.toLine; lineNum++) {
      const line = state.doc.line(lineNum);
      const lineText = line.text;

      const isTableLine = /^\s*\|.*\|/.test(lineText);
      if (!isTableLine) continue;

      const isSeparator = /^\s*\|?[\s\-:|]+\|[\s\-:|]*$/.test(lineText);

      const isHeader =
        lineNum < state.doc.lines &&
        /^\s*\|?[\s\-:|]+\|[\s\-:|]*$/.test(state.doc.line(lineNum + 1).text);

      if (isSeparator) {
        if (!isEditMode) {
          decorations.push({
            from: line.from,
            to: line.to,
            decoration: Decoration.mark({
              class: "cm-table-separator-hidden",
              attributes: {
                style:
                  "font-size: 0; line-height: 0; opacity: 0; height: 0; display: block; overflow: hidden;",
              },
            }),
          });
        } else {
          decorations.push({
            from: line.from,
            to: line.to,
            decoration: Decoration.mark({
              class: "cm-table-separator",
              attributes: {
                style: "opacity: 0.4; color: #888;",
              },
            }),
          });
        }
        continue;
      }

      const cells = lineText
        .split("|")
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0);

      const rowStyle = isHeader
        ? `display: grid; grid-template-columns: repeat(${cells.length}, 1fr); gap: 0; padding: 0.75em 0; font-weight: 600; background: linear-gradient(to bottom, rgba(128, 128, 128, 0.08), rgba(128, 128, 128, 0.12)); border: 1px solid rgba(128, 128, 128, 0.25); border-bottom: 2px solid rgba(128, 128, 128, 0.4); margin-top: 0.5em;`
        : `display: grid; grid-template-columns: repeat(${cells.length}, 1fr); gap: 0; padding: 0.6em 0; border-left: 1px solid rgba(128, 128, 128, 0.25); border-right: 1px solid rgba(128, 128, 128, 0.25); border-bottom: 1px solid rgba(128, 128, 128, 0.25);`;

      decorations.push({
        from: line.from,
        to: line.to,
        decoration: Decoration.mark({
          class: isHeader ? "cm-table-header" : "cm-table-row",
          attributes: { style: rowStyle },
        }),
      });

      // Cell content styling
      let cellStart = lineText.indexOf("|");
      cells.forEach((cell, idx) => {
        const cellContent = `|${cell}|`;
        const cellPos = lineText.indexOf(cellContent, cellStart);
        if (cellPos === -1) return;

        const contentStart = cellPos + 1;
        const contentEnd = contentStart + cell.length;

        decorations.push({
          from: line.from + contentStart,
          to: line.from + contentEnd,
          decoration: Decoration.mark({
            class: "cm-table-cell",
            attributes: {
              style: `padding: 0 1em; ${idx < cells.length - 1 ? "border-right: 1px solid rgba(128, 128, 128, 0.2);" : ""}`,
            },
          }),
        });

        cellStart = contentEnd;
      });

      // Pipe visibility
      if (!isEditMode) {
        for (let i = 0; i < lineText.length; i++) {
          if (lineText[i] !== "|") continue;
          decorations.push({
            from: line.from + i,
            to: line.from + i + 1,
            decoration: Decoration.mark({
              class: "cm-table-pipe-hidden",
              attributes: { style: "font-size: 0; width: 0; opacity: 0;" },
            }),
          });
        }
      } else {
        for (let i = 0; i < lineText.length; i++) {
          if (lineText[i] !== "|") continue;
          decorations.push({
            from: line.from + i,
            to: line.from + i + 1,
            decoration: Decoration.mark({
              class: "cm-table-pipe",
              attributes: { style: "opacity: 0.3; color: #888;" },
            }),
          });
        }
      }
    }
  }

  // Strikethrough (visible lines only)
  for (const lr of visibleLineRanges) {
    for (let lineNum = lr.fromLine; lineNum <= lr.toLine; lineNum++) {
      const line = state.doc.line(lineNum);
      const lineText = line.text;

      const strikethroughRegex = /~~(.+?)~~/g;
      let match: RegExpExecArray | null;
      while ((match = strikethroughRegex.exec(lineText)) !== null) {
        const start = line.from + match.index;
        const end = start + match[0].length;

        decorations.push({
          from: start,
          to: end,
          decoration: Decoration.mark({
            class: "cm-strikethrough",
            attributes: {
              style: "text-decoration: line-through; opacity: 0.7;",
            },
          }),
        });

        if (!isEditMode) {
          decorations.push({
            from: start,
            to: start + 2,
            decoration: Decoration.replace({}),
          });
          decorations.push({
            from: end - 2,
            to: end,
            decoration: Decoration.replace({}),
          });
        } else {
          decorations.push({
            from: start,
            to: start + 2,
            decoration: Decoration.mark({
              class: "cm-dim-marker",
              attributes: { style: "opacity: 0.5;" },
            }),
          });
          decorations.push({
            from: end - 2,
            to: end,
            decoration: Decoration.mark({
              class: "cm-dim-marker",
              attributes: { style: "opacity: 0.5;" },
            }),
          });
        }
      }
    }
  }

  // Footnotes (visible lines only)
  for (const lr of visibleLineRanges) {
    for (let lineNum = lr.fromLine; lineNum <= lr.toLine; lineNum++) {
      const line = state.doc.line(lineNum);
      const lineText = line.text;

      const def = lineText.match(/^\[\^([^\]]+)\]:\s+(.+)$/);
      if (def) {
        if (!isEditMode) {
          decorations.push({
            from: line.from,
            to: line.to,
            decoration: Decoration.mark({
              class: "cm-footnote-def",
              attributes: {
                style:
                  "color: #888; font-size: 0.9em; font-style: italic; opacity: 0.7;",
              },
            }),
          });
        }
      }

      const footnoteRefRegex = /\[\^([^\]]+)\]/g;
      let match: RegExpExecArray | null;
      while ((match = footnoteRefRegex.exec(lineText)) !== null) {
        const refStart = line.from + match.index;
        const refEnd = refStart + match[0].length;

        decorations.push({
          from: refStart,
          to: refEnd,
          decoration: Decoration.mark({
            class: "cm-footnote-ref",
            attributes: {
              style:
                "color: #4dabf7; font-size: 0.85em; vertical-align: super; cursor: pointer;",
            },
          }),
        });
      }
    }
  }

  // Sort decorations (required by CM6)
  const sortedDecorations = sortDecorations(decorations);

  // Build decoration set using RangeSetBuilder
  const builder = new RangeSetBuilder<Decoration>();
  for (const spec of sortedDecorations) {
    if (spec.from >= spec.to) continue;

    try {
      builder.add(spec.from, spec.to, spec.decoration);
    } catch (error) {
      console.warn("Failed to add decoration:", error, spec);
    }
  }

  return builder.finish();
}

/**
 * View plugin that manages hybrid rendering decorations.
 *
 * IME safety:
 * - During IME composition, avoid frequent rebuilds triggered by doc/selection churn.
 * - Rebuild once on composition end (and allow viewport rebuilds while composing).
 */
export const hybridRenderingPlugin = ViewPlugin.fromClass(
  class HybridRenderingViewPlugin {
    decorations: DecorationSet;
    private isComposing = false;

    // CM will attach the view to plugin instances; declare for TS.
    view!: EditorView;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);

      // Track IME composition state. Using DOM listeners is reliable across platforms.
      view.dom.addEventListener("compositionstart", this.onCompositionStart, {
        passive: true,
      });
      view.dom.addEventListener("compositionend", this.onCompositionEnd, {
        passive: true,
      });
    }

    private onCompositionStart = () => {
      this.isComposing = true;
    };

    private onCompositionEnd = () => {
      this.isComposing = false;

      // Let the DOM/selection settle after composition commits.
      requestAnimationFrame(() => {
        try {
          this.decorations = buildDecorations(this.view);
        } catch {
          // Ignore errors if view was destroyed mid-frame
        }
      });
    };

    update(update: ViewUpdate) {
      if (this.isComposing) {
        if (update.viewportChanged) {
          this.decorations = buildDecorations(update.view);
        }
        return;
      }

      // Check if isFocused facet changed by comparing values
      const oldFocused = update.startState.facet(isFocusedFacet);
      const newFocused = update.state.facet(isFocusedFacet);
      const facetChanged = oldFocused !== newFocused;

      if (
        update.docChanged ||
        update.viewportChanged ||
        update.selectionSet ||
        facetChanged
      ) {
        this.decorations = buildDecorations(update.view);
      }
    }

    destroy() {
      try {
        this.view.dom.removeEventListener(
          "compositionstart",
          this.onCompositionStart,
        );
        this.view.dom.removeEventListener(
          "compositionend",
          this.onCompositionEnd,
        );
      } catch {
        // no-op
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

/**
 * Theme for hybrid rendering
 *
 * This theme provides base styles for all the decoration classes.
 * Individual handlers add inline styles for specific elements.
 */
export const hybridRenderingTheme = EditorView.theme({
  // Task checkbox styling
  ".cm-task-checkbox": {
    accentColor: "#0969da",
  },

  // Heading general styling
  ".cm-heading": {
    display: "block",
    textDecoration: "none !important",
    borderBottom: "none !important",
  },

  // Ensure markdown markers (like '#') never inherit underline from any surrounding styles
  ".cm-dim-marker": {
    opacity: "0.4",
    textDecoration: "none !important",
    borderBottom: "none !important",
  },

  ".cm-hidden-marker": {
    fontSize: "0.85em",
    opacity: "0.4",
    textDecoration: "none !important",
    borderBottom: "none !important",
  },

  ".cm-hidden": {
    opacity: "0",
    fontSize: "0.01em",
    textDecoration: "none !important",
    borderBottom: "none !important",
  },

  // Heading text specific styling
  ".cm-heading-text": {
    textDecoration: "none !important",
    borderBottom: "none !important",
  },

  // Individual heading levels
  ".cm-heading-1": {
    textDecoration: "none !important",
    borderBottom: "none !important",
  },

  ".cm-heading-2": {
    textDecoration: "none !important",
    borderBottom: "none !important",
  },

  ".cm-heading-3": {
    textDecoration: "none !important",
    borderBottom: "none !important",
  },

  ".cm-heading-4": {
    textDecoration: "none !important",
    borderBottom: "none !important",
  },

  ".cm-heading-5": {
    textDecoration: "none !important",
    borderBottom: "none !important",
  },

  ".cm-heading-6": {
    textDecoration: "none !important",
    borderBottom: "none !important",
  },

  // Code block styling
  ".cm-code-block": {
    margin: "8px 0",
  },

  // Hidden markers (completely hidden)
  // (moved above with explicit textDecoration/borderBottom reset)

  // Hidden markers that show on cursor line
  // (moved above with explicit textDecoration/borderBottom reset)

  // Dimmed markers
  // (moved above with explicit textDecoration/borderBottom reset)

  // Emphasis (italic)
  ".cm-emphasis": {
    fontStyle: "italic",
  },

  // Strong (bold)
  ".cm-strong": {
    fontWeight: "bold",
  },

  // Inline code
  ".cm-inline-code": {
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    backgroundColor: "rgba(127, 127, 127, 0.1)",
    padding: "0.2em 0.4em",
    borderRadius: "3px",
    fontSize: "0.9em",
  },

  // Link text
  ".cm-link-text": {
    color: "#0969da",
    textDecoration: "underline",
    cursor: "pointer",
  },

  // Blockquote
  ".cm-blockquote": {
    borderLeft: "3px solid rgba(127, 127, 127, 0.3)",
    paddingLeft: "12px",
    marginLeft: "4px",
    color: "rgba(127, 127, 127, 0.8)",
    fontStyle: "italic",
  },

  // Table styling (for future table handler)
  ".cm-table": {
    display: "table",
    margin: "16px 0",
    fontFamily: "inherit",
  },

  ".cm-table-row": {
    display: "table-row",
  },

  ".cm-table-separator": {
    opacity: "0.3",
    color: "#858585",
  },

  ".cm-table-separator-hidden": {
    fontSize: "0.01em",
    lineHeight: "0",
    opacity: "0",
    height: "0",
    display: "block",
    overflow: "hidden",
  },

  ".cm-table-delimiter": {
    opacity: "0.4",
    color: "#858585",
    padding: "0 4px",
  },

  ".cm-table-pipe": {
    opacity: "0.3",
    color: "#858585",
  },

  ".cm-table-pipe-hidden": {
    fontSize: "0.01em",
    width: "0",
    opacity: "0",
  },

  ".cm-table-header": {
    display: "table-header-group",
    fontWeight: "600",
    background: "rgba(127, 127, 127, 0.1)",
  },

  ".cm-table-body-row": {
    display: "table-row",
  },

  ".cm-table-cell": {
    padding: "6px 12px",
  },

  // Strikethrough (for future strikethrough handler)
  ".cm-strikethrough": {
    textDecoration: "line-through",
    opacity: "0.7",
  },

  // Autolink (for future autolink handler)
  ".cm-autolink": {
    color: "#0969da",
    textDecoration: "underline",
    cursor: "pointer",
  },

  // Footnote reference (for future footnote handler)
  ".cm-footnote-ref": {
    color: "#0969da",
    fontSize: "0.85em",
    verticalAlign: "super",
    cursor: "pointer",
  },

  // Footnote definition (for future footnote handler)
  ".cm-footnote-def": {
    color: "rgba(127, 127, 127, 0.8)",
    fontSize: "0.9em",
    fontStyle: "italic",
    opacity: "0.8",
  },

  // Obsidian features
  ".cm-wiki-link": {
    color: "#8b5cf6",
    textDecoration: "none !important",
  },
  ".cm-content .cm-wiki-link": {
    textDecoration: "none !important",
  },
  ".cm-line .cm-wiki-link": {
    textDecoration: "none !important",
  },
  "span.cm-wiki-link": {
    textDecoration: "none !important",
  },
  // Override any CodeMirror auto-generated classes
  ".cm-line span[class*='cm-']": {
    textDecoration: "inherit",
  },
  ".cm-line .cm-wiki-link[class]": {
    textDecoration: "none !important",
  },
  // Extremely specific selector to override CodeMirror's generated classes
  ".cm-content .cm-line span.cm-wiki-link": {
    textDecoration: "none !important",
  },

  // Block references / embeds
  // ((uuid)) and !((uuid)) are rendered as token-like highlights; UUID is hidden by handler.
  ".cm-block-ref": {
    color: "#8b5cf6",
    textDecoration: "none",
    cursor: "pointer",
    fontWeight: 500,
    padding: "0 2px",
    borderRadius: "4px",
    background: "rgba(139, 92, 246, 0.12)",
  },
  ".cm-block-embed": {
    color: "#8b5cf6",
    textDecoration: "none",
    cursor: "pointer",
    fontWeight: 600,
    padding: "0 2px",
    borderRadius: "4px",
    background: "rgba(139, 92, 246, 0.18)",
    boxShadow: "inset 0 0 0 1px rgba(139, 92, 246, 0.35)",
  },

  // Embed subtree widget container (read-only)
  ".cm-block-embed-subtree": {
    margin: "6px 0",
  },

  // Embed page widget container (read-only)
  ".cm-page-embed": {
    margin: "6px 0",
  },

  ".cm-tag": {
    color: "#10b981",
    background: "rgba(16, 185, 129, 0.1)",
    padding: "0.1em 0.3em",
    borderRadius: "3px",
    cursor: "pointer",
    fontWeight: "500",
  },

  ".cm-highlight": {
    background:
      "linear-gradient(to bottom, rgba(255, 235, 59, 0.3), rgba(255, 235, 59, 0.4))",
    padding: "0.1em 0.2em",
    borderRadius: "2px",
  },

  ".cm-comment": {
    color: "#888",
    opacity: "0.6",
    fontStyle: "italic",
  },

  ".cm-callout-title": {
    fontWeight: "600",
    padding: "0.5em",
    display: "block",
    borderRadius: "4px",
  },

  // Line height
  ".cm-line": {
    lineHeight: "1.6",
  },
});

/**
 * Export the handler registry for testing/extension
 */
export { handlerRegistry };
