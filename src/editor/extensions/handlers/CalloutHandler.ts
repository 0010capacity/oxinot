/**
 * Callout handler for Obsidian-style callouts/admonitions
 *
 * Handles Obsidian-style callouts:
 * > [!note] Title
 * > Content here
 *
 * Supported types:
 * - note, info, tip, success, question, warning, error, danger
 * - abstract, summary, todo, example, quote, bug
 *
 * - Styles callouts with colored left border and background
 * - Shows icon and title
 * - Supports collapsible callouts with +/-
 */

import { Decoration } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import type { DecorationSpec } from "../utils/decorationHelpers";
import { BaseHandler, type RenderContext } from "./types";

export class CalloutHandler extends BaseHandler {
  constructor() {
    super("CalloutHandler");
  }

  canHandle(_node: SyntaxNode): boolean {
    // Callouts are blockquotes with special syntax, process line-by-line
    return false;
  }

  handle(_node: SyntaxNode, _context: RenderContext): DecorationSpec[] {
    return [];
  }

  /**
   * Callout types and their colors
   */
  private static readonly CALLOUT_TYPES: Record<
    string,
    { color: string; bgColor: string; icon: string }
  > = {
    note: {
      color: "var(--color-text-link)",
      bgColor: "color-mix(in srgb, var(--color-text-link), transparent 90%)",
      icon: "ℹ️",
    },
    info: {
      color: "var(--color-text-link)",
      bgColor: "color-mix(in srgb, var(--color-text-link), transparent 90%)",
      icon: "ℹ️",
    },
    tip: {
      color: "var(--color-success)",
      bgColor: "color-mix(in srgb, var(--color-success), transparent 90%)",
      icon: "💡",
    },
    success: {
      color: "var(--color-success)",
      bgColor: "color-mix(in srgb, var(--color-success), transparent 90%)",
      icon: "✅",
    },
    question: {
      color: "var(--color-accent)",
      bgColor: "color-mix(in srgb, var(--color-accent), transparent 90%)",
      icon: "❓",
    },
    warning: {
      color: "var(--color-warning)",
      bgColor: "color-mix(in srgb, var(--color-warning), transparent 90%)",
      icon: "⚠️",
    },
    error: {
      color: "var(--color-error)",
      bgColor: "color-mix(in srgb, var(--color-error), transparent 90%)",
      icon: "❌",
    },
    danger: {
      color: "var(--color-error)",
      bgColor: "color-mix(in srgb, var(--color-error), transparent 90%)",
      icon: "🔥",
    },
    abstract: {
      color: "#06b6d4",
      bgColor: "rgba(6, 182, 212, 0.1)",
      icon: "📝",
    },
    summary: {
      color: "#06b6d4",
      bgColor: "rgba(6, 182, 212, 0.1)",
      icon: "📋",
    },
    todo: {
      color: "var(--color-accent)",
      bgColor: "color-mix(in srgb, var(--color-accent), transparent 90%)",
      icon: "✏️",
    },
    example: {
      color: "var(--color-accent)",
      bgColor: "color-mix(in srgb, var(--color-accent), transparent 90%)",
      icon: "📖",
    },
    quote: {
      color: "var(--color-text-secondary)",
      bgColor:
        "color-mix(in srgb, var(--color-text-secondary), transparent 90%)",
      icon: "💬",
    },
    bug: {
      color: "var(--color-error)",
      bgColor: "color-mix(in srgb, var(--color-error), transparent 90%)",
      icon: "🐛",
    },
  };

  /**
   * Process callouts in a line of text
   * Called manually from the main rendering loop
   */
  static processLine(
    lineText: string,
    lineFrom: number,
    isEditMode: boolean
  ): DecorationSpec[] {
    const decorations: DecorationSpec[] = [];

    // Match callout start: > [!type] Title or > [!type]+ Title or > [!type]- Title
    const calloutMatch = lineText.match(/^>\s*\[!([a-z]+)\]([+-])?\s*(.*)$/);

    if (calloutMatch) {
      const calloutType = calloutMatch[1].toLowerCase();
      // calloutMatch[2] is collapsible flag (+ or -) - reserved for future use
      const title =
        calloutMatch[3] ||
        calloutType.charAt(0).toUpperCase() + calloutType.slice(1);

      const config =
        CalloutHandler.CALLOUT_TYPES[calloutType] ||
        CalloutHandler.CALLOUT_TYPES.note;

      // Hide the > [!type] part in preview mode
      if (!isEditMode) {
        const syntaxEnd = lineText.indexOf(title);
        if (syntaxEnd > 0) {
          decorations.push({
            from: lineFrom,
            to: lineFrom + syntaxEnd,
            decoration: Decoration.mark({
              class: "cm-hidden",
              attributes: {
                style: "display: none;",
              },
            }),
          });
        }
      } else {
        // Dim the syntax when cursor is not on line
        const syntaxEnd = lineText.indexOf(title);
        if (syntaxEnd > 0) {
          decorations.push({
            from: lineFrom,
            to: lineFrom + syntaxEnd,
            decoration: Decoration.mark({
              class: "cm-dim-marker",
              attributes: {
                style: "opacity: 0.65; font-size: 0.85em;",
              },
            }),
          });
        }
      }

      // Style the title with icon
      const titleStart = lineText.indexOf(title);
      if (titleStart >= 0) {
        decorations.push({
          from: lineFrom + titleStart,
          to: lineFrom + lineText.length,
          decoration: Decoration.mark({
            class: `cm-callout-title cm-callout-${calloutType}`,
            attributes: {
              style: `
                color: ${config.color};
                font-weight: 600;
                padding: 0.5em;
                display: block;
                background: ${config.bgColor};
                border-left: 4px solid ${config.color};
                border-radius: 4px;
              `,
              "data-callout-icon": config.icon,
            },
          }),
        });
      }
    } else if (lineText.startsWith(">") && !lineText.match(/^>\s*\[!/)) {
      // This is a continuation line of a callout (plain blockquote line after callout start)
      // We should check if previous line was a callout, but for now just style blockquotes normally
      // This will be handled by the blockquote handler
    }

    return decorations;
  }

  /**
   * Check if a line is part of a callout block
   */
  static isCalloutLine(lineText: string): boolean {
    return /^>\s*\[!([a-z]+)\]/.test(lineText);
  }
}
