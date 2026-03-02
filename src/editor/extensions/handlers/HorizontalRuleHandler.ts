/**
 * Horizontal Rule handler for hybrid rendering
 *
 * Handles horizontal rules/dividers:
 * - --- (three or more hyphens)
 * - *** (three or more asterisks)
 * - ___ (three or more underscores)
 *
 * - Renders a visual horizontal line
 * - Hides the markdown syntax in preview mode
 * - Shows dimmed syntax in edit mode
 */

import { WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import type { DecorationSpec } from "../utils/decorationHelpers";
import { createHiddenMarker, createWidget } from "../utils/decorationHelpers";
import { BaseHandler, type RenderContext } from "./types";

// Horizontal rule widget
class HorizontalRuleWidget extends WidgetType {
  toDOM(): HTMLElement {
    const container = document.createElement("div");
    container.className = "cm-horizontal-rule";
    container.setAttribute("contenteditable", "false");
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.margin = "var(--spacing-md) 0";
    container.style.minHeight = "24px";
    container.style.userSelect = "none";
    container.style.pointerEvents = "none";

    const line = document.createElement("div");
    line.style.flex = "1";
    line.style.height = "1px";
    line.style.backgroundColor = "var(--color-border-primary)";
    line.style.borderRadius = "var(--radius-sm)";

    container.appendChild(line);
    return container;
  }

  ignoreEvent(): boolean {
    return false;
  }

  eq(): boolean {
    return true;
  }
}

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

    // Hide the markdown syntax in preview mode, show dimmed in edit mode
    decorations.push(
      createHiddenMarker(line.from, line.to, context.isEditMode),
    );

    // Add the horizontal rule widget
    decorations.push(
      createWidget(line.from, new HorizontalRuleWidget(), 0),
    );

    return decorations;
  }
}
