/**
 * Hybrid Markdown Rendering System
 *
 * This module implements a handler-based system for rendering markdown elements
 * inline within the CodeMirror editor. It uses a plugin architecture where each
 * markdown element type is handled by a dedicated handler.
 *
 * Key improvements over the previous implementation:
 * - Modular handler system (easy to add/remove/modify handlers)
 * - Reduced code duplication (common patterns extracted to utilities)
 * - Better separation of concerns (each handler is independent)
 * - Easier to test (handlers can be tested in isolation)
 * - More maintainable (no giant 1000-line function)
 */

import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

// Import handlers
import { HeadingHandler } from "./handlers/HeadingHandler";
import { EmphasisHandler } from "./handlers/EmphasisHandler";
import { StrongHandler } from "./handlers/StrongHandler";
import { InlineCodeHandler } from "./handlers/InlineCodeHandler";
import { TaskListHandler } from "./handlers/TaskListHandler";
import { LinkHandler } from "./handlers/LinkHandler";
import { BlockquoteHandler } from "./handlers/BlockquoteHandler";
import { CodeBlockHandler } from "./handlers/CodeBlockHandler";

// Import handler system
import { HandlerRegistry } from "./handlers/HandlerRegistry";
import { RenderContext } from "./handlers/types";
import { DecorationSpec, sortDecorations } from "./utils/decorationHelpers";
import { getCursorInfo } from "./utils/nodeHelpers";

/**
 * Initialize the handler registry with all handlers
 */
function createHandlerRegistry(): HandlerRegistry {
  const registry = new HandlerRegistry();

  // Register all handlers
  // Order matters - handlers are checked in registration order
  registry.registerAll([
    new TaskListHandler(), // Check task lists before generic list items
    new HeadingHandler(), // Headings
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

/**
 * Build decorations for the visible range using the handler system
 */
function buildDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const decorations: DecorationSpec[] = [];

  // Get cursor information once
  const cursor = getCursorInfo(state);

  // Create render context
  const context: RenderContext = {
    state,
    cursor,
    decorations,
  };

  // Process only visible ranges for performance
  for (const { from, to } of view.visibleRanges) {
    const tree = syntaxTree(state);

    // Iterate through syntax tree
    tree.iterate({
      from,
      to,
      enter: (node) => {
        // Create a proper SyntaxNode for handlers
        const syntaxNode = node.node;

        // Let handlers process this node
        const nodeDecorations = handlerRegistry.handleNode(syntaxNode, context);
        decorations.push(...nodeDecorations);

        // Return true to process children
        return true;
      },
    });
  }

  // Process tables line by line (not yet in handler system - complex logic)
  for (let lineNum = 1; lineNum <= state.doc.lines; lineNum++) {
    const line = state.doc.line(lineNum);
    const lineText = line.text;
    const isTableLine = /^\s*\|.*\|/.test(lineText);
    const isSeparator = /^\s*\|?[\s\-:|]+\|[\s\-:|]*$/.test(lineText);

    if (isTableLine) {
      const isOnCursorLine =
        state.selection.main.head >= line.from &&
        state.selection.main.head <= line.to;

      const isHeader =
        lineNum < state.doc.lines &&
        /^\s*\|?[\s\-:|]+\|[\s\-:|]*$/.test(state.doc.line(lineNum + 1).text);

      if (isSeparator) {
        if (!isOnCursorLine) {
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
      } else {
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
            attributes: {
              style: rowStyle,
            },
          }),
        });

        let cellStart = lineText.indexOf("|");
        cells.forEach((cell, idx) => {
          const cellContent = `|${cell}|`;
          const cellPos = lineText.indexOf(cellContent, cellStart);

          if (cellPos !== -1) {
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
          }
        });

        if (!isOnCursorLine) {
          for (let i = 0; i < lineText.length; i++) {
            if (lineText[i] === "|") {
              decorations.push({
                from: line.from + i,
                to: line.from + i + 1,
                decoration: Decoration.mark({
                  class: "cm-table-pipe-hidden",
                  attributes: {
                    style: "font-size: 0; width: 0; opacity: 0;",
                  },
                }),
              });
            }
          }
        } else {
          for (let i = 0; i < lineText.length; i++) {
            if (lineText[i] === "|") {
              decorations.push({
                from: line.from + i,
                to: line.from + i + 1,
                decoration: Decoration.mark({
                  class: "cm-table-pipe",
                  attributes: {
                    style: "opacity: 0.3; color: #888;",
                  },
                }),
              });
            }
          }
        }
      }
    }
  }

  // Process strikethrough line by line
  for (let lineNum = 1; lineNum <= state.doc.lines; lineNum++) {
    const line = state.doc.line(lineNum);
    const lineText = line.text;
    const isOnCursorLine =
      state.selection.main.head >= line.from &&
      state.selection.main.head <= line.to;

    const strikethroughRegex = /~~([^~]+)~~/g;
    let match;
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

      if (!isOnCursorLine) {
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
            attributes: {
              style: "opacity: 0.5;",
            },
          }),
        });
        decorations.push({
          from: end - 2,
          to: end,
          decoration: Decoration.mark({
            class: "cm-dim-marker",
            attributes: {
              style: "opacity: 0.5;",
            },
          }),
        });
      }
    }
  }

  // Process footnotes line by line
  for (let lineNum = 1; lineNum <= state.doc.lines; lineNum++) {
    const line = state.doc.line(lineNum);
    const lineText = line.text;

    const footnoteDefMatch = lineText.match(/^\[\^([^\]]+)\]:\s+(.+)$/);
    if (footnoteDefMatch) {
      const isOnCursorLine =
        state.selection.main.head >= line.from &&
        state.selection.main.head <= line.to;

      if (!isOnCursorLine) {
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
    let match;
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

  // Sort decorations (required by CM6)
  const sortedDecorations = sortDecorations(decorations);

  // Build decoration set using RangeSetBuilder
  const builder = new RangeSetBuilder<Decoration>();
  for (const spec of sortedDecorations) {
    // Skip invalid ranges
    if (spec.from >= spec.to) continue;

    try {
      builder.add(spec.from, spec.to, spec.decoration);
    } catch (error) {
      // Log but don't crash - CM6 can throw on invalid ranges
      console.warn("Failed to add decoration:", error, spec);
    }
  }

  return builder.finish();
}

/**
 * View plugin that manages hybrid rendering decorations
 */
export const hybridRenderingPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      // Rebuild decorations when:
      // - Document changed
      // - Viewport changed (scrolling)
      // - Selection changed (cursor moved - affects marker visibility)
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildDecorations(update.view);
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
  },

  // Code block styling
  ".cm-code-block": {
    margin: "8px 0",
  },

  // Hidden markers (completely hidden)
  ".cm-hidden": {
    opacity: "0",
    fontSize: "0.01em",
  },

  // Hidden markers that show on cursor line
  ".cm-hidden-marker": {
    fontSize: "0.85em",
    opacity: "0.4",
  },

  // Dimmed markers
  ".cm-dim-marker": {
    opacity: "0.4",
  },

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

  // Line height
  ".cm-line": {
    lineHeight: "1.6",
  },
});

/**
 * Export the handler registry for testing/extension
 */
export { handlerRegistry };
