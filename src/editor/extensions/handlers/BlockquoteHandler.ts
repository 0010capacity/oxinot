/**
 * Blockquote handler for hybrid rendering
 *
 * Handles blockquote elements (> quoted text)
 * - Hides or dims the > marker based on cursor position
 * - Applies blockquote styling (border, padding, color, italic)
 */

import { SyntaxNode } from "@lezer/common";
import { BaseHandler, RenderContext } from "./types";
import { DecorationSpec } from "../utils/decorationHelpers";
import {
  createHiddenMarker,
  createStyledText,
} from "../utils/decorationHelpers";
import { getBlockquoteStyle } from "../theme/styles";

export class BlockquoteHandler extends BaseHandler {
  constructor() {
    super("BlockquoteHandler");
  }

  canHandle(node: SyntaxNode): boolean {
    return node.type.name === "Blockquote";
  }

  handle(node: SyntaxNode, context: RenderContext): DecorationSpec[] {
    const decorations: DecorationSpec[] = [];
    const line = this.getNodeLine(node, context);
    const lineText = line.text;

    // Blockquote format: > text
    const match = lineText.match(/^(>\s*)/);
    if (!match) {
      return decorations;
    }

    const markerEnd = line.from + match[1].length;

    // Hide/dim the > marker based on edit mode
    decorations.push(
      createHiddenMarker(line.from, markerEnd, context.isEditMode),
    );

    // Style the blockquote content
    if (markerEnd < line.to) {
      decorations.push(
        createStyledText(markerEnd, line.to, {
          className: "cm-blockquote",
          style: getBlockquoteStyle(),
        }),
      );
    }

    return decorations;
  }
}
