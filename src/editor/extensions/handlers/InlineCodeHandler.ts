/**
 * Inline code handler for hybrid rendering
 *
 * Handles inline code (`code`)
 * - Hides backtick markers when cursor is not on line
 * - Shows dimmed markers when editing
 * - Applies monospace font and background styling
 */

import { SyntaxNode } from "@lezer/common";
import { BaseHandler, RenderContext } from "./types";
import { DecorationSpec } from "../utils/decorationHelpers";
import {
  createHiddenMarker,
  createStyledText,
} from "../utils/decorationHelpers";
import { getInlineCodeStyle } from "../theme/styles";

export class InlineCodeHandler extends BaseHandler {
  constructor() {
    super("InlineCodeHandler");
  }

  canHandle(node: SyntaxNode): boolean {
    return node.type.name === "InlineCode";
  }

  handle(node: SyntaxNode, context: RenderContext): DecorationSpec[] {
    const decorations: DecorationSpec[] = [];
    const content = this.getNodeText(node, context);

    // Inline code is wrapped with backticks
    // Format: `code`
    if (!content.startsWith("`") || !content.endsWith("`")) {
      return decorations;
    }

    // Opening backtick
    decorations.push(
      createHiddenMarker(node.from, node.from + 1, context.isEditMode),
    );

    // Closing backtick
    decorations.push(
      createHiddenMarker(node.to - 1, node.to, context.isEditMode),
    );

    // Style the code content between backticks
    if (node.from + 1 < node.to - 1) {
      decorations.push(
        createStyledText(node.from + 1, node.to - 1, {
          className: "cm-inline-code",
          style: getInlineCodeStyle(),
        }),
      );
    }

    return decorations;
  }
}
