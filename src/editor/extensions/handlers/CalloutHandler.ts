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

import { SyntaxNode } from "@lezer/common";
import { BaseHandler, RenderContext } from "./types";
import { DecorationSpec } from "../utils/decorationHelpers";
import { Decoration } from "@codemirror/view";

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
    note: { color: "#3b82f6", bgColor: "rgba(59, 130, 246, 0.1)", icon: "ℹ️" },
    info: { color: "#3b82f6", bgColor: "rgba(59, 130, 246, 0.1)", icon: "ℹ️" },
    tip: { color: "#10b981", bgColor: "rgba(16, 185, 129, 0.1)", icon: "💡" },
    success: {
      color: "#10b981",
      bgColor: "rgba(16, 185, 129, 0.1)",
      icon: "✅",
    },
    question: {
      color: "#8b5cf6",
      bgColor: "rgba(139, 92, 246, 0.1)",
      icon: "❓",
    },
    warning: {
      color: "#f59e0b",
      bgColor: "rgba(245, 158, 11, 0.1)",
      icon: "⚠️",
    },
    error: { color: "#ef4444", bgColor: "rgba(239, 68, 68, 0.1)", icon: "❌" },
    danger: { color: "#ef4444", bgColor: "rgba(239, 68, 68, 0.1)", icon: "🔥" },
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
    todo: { color: "#8b5cf6", bgColor: "rgba(139, 92, 246, 0.1)", icon: "✏️" },
    example: {
      color: "#a855f7",
      bgColor: "rgba(168, 85, 247, 0.1)",
      icon: "📖",
    },
    quote: {
      color: "#64748b",
      bgColor: "rgba(100, 116, 139, 0.1)",
      icon: "💬",
    },
    bug: { color: "#ef4444", bgColor: "rgba(239, 68, 68, 0.1)", icon: "🐛" },
  };

  /**
   * Process callouts in a line of text
   * Called manually from the main rendering loop
   */
  static processLine(
    lineText: string,
    lineFrom: number,
    shouldShowMarkers: boolean,
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

      const config = this.CALLOUT_TYPES[calloutType] || this.CALLOUT_TYPES.note;

      // Hide the > [!type] part when not on cursor line
      if (!shouldShowMarkers) {
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
                style: "opacity: 0.4; font-size: 0.85em;",
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
