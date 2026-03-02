/**
 * Horizontal Rule handler for hybrid rendering
 *
 * Handles horizontal rules/dividers:
 * - --- (three or more hyphens)
 * - *** (three or more asterisks)
 * - ___ (three or more underscores)
 *
 * Rendering strategy (no widget — uses Decoration.line + CSS ::after):
 * - Adds a line-level class to the .cm-line element
 * - Hides the markdown syntax text
 * - Draws the visual line via CSS ::after pseudo-element
 * - This avoids widget-in-cm-line margin/padding mismatch issues
 * - Shows dimmed syntax when cursor is on the line in edit mode
 */

import { Decoration } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import type { DecorationSpec } from "../utils/decorationHelpers";
import { createHiddenMarker } from "../utils/decorationHelpers";
import { BaseHandler, type RenderContext } from "./types";

// Pre-built line decoration (reusable, immutable)
const hrLineDecoration = Decoration.line({ class: "cm-hr-line" });

export class HorizontalRuleHandler extends BaseHandler {
  constructor() {
    super("HorizontalRuleHandler");
  }

  canHandle(node: SyntaxNode): boolean {
    return node.type.name === "HorizontalRule";
  }

  handle(node: SyntaxNode, context: RenderContext): DecorationSpec[] {
    const decorations: DecorationSpec[] = [];
    const line = this.getNodeLine(node, context);
    const lineText = line.text;

    // Check if this is a horizontal rule
    // Match: --- or *** or ___ (3+ characters)
    const isHorizontalRule = /^(\s*)(-{3,}|\*{3,}|_{3,})(\s*)$/.test(lineText);

    if (!isHorizontalRule) {
      return decorations;
    }

    // Check if cursor is on this line (in edit mode, show dimmed syntax)
    const isOnCursorLine =
      context.cursor.pos >= line.from && context.cursor.pos <= line.to;

    if (context.isEditMode && isOnCursorLine) {
      // Edit mode with cursor on line: show dimmed syntax
      decorations.push(createHiddenMarker(line.from, line.to, true));
    } else {
      // Preview mode or cursor not on line:
      // 1. Add line decoration to style the .cm-line element itself
      decorations.push({
        from: line.from,
        to: line.from,
        decoration: hrLineDecoration,
      });

      // 2. Hide the markdown syntax text (---, ***, ___)
      decorations.push(createHiddenMarker(line.from, line.to, false));
    }

    return decorations;
  }
}
