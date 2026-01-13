/**
 * Strong handler for hybrid rendering
 *
 * Handles strong/bold text (**text** or __text__)
 * - Hides markers when cursor is not on line
 * - Shows dimmed markers when editing
 * - Applies bold styling to the content
 */

import type { SyntaxNode } from "@lezer/common";
import type { DecorationSpec } from "../utils/decorationHelpers";
import {
  createHiddenMarker,
  createStyledText,
} from "../utils/decorationHelpers";
import { BaseHandler, type RenderContext } from "./types";

export class StrongHandler extends BaseHandler {
  constructor() {
    super("StrongHandler");
  }

  canHandle(node: SyntaxNode): boolean {
    return node.type.name === "StrongEmphasis";
  }

  handle(node: SyntaxNode, context: RenderContext): DecorationSpec[] {
    const decorations: DecorationSpec[] = [];
    const content = this.getNodeText(node, context);

    // Strong emphasis is wrapped with ** or __
    // Format: **text** or __text__
    const markerLength =
      content.startsWith("**") || content.startsWith("__") ? 2 : 0;

    if (markerLength === 0) {
      return decorations;
    }

    // Opening markers (first 2 characters)
    decorations.push(
      createHiddenMarker(
        node.from,
        node.from + markerLength,
        context.isEditMode,
      ),
    );

    // Closing markers (last 2 characters)
    decorations.push(
      createHiddenMarker(node.to - markerLength, node.to, context.isEditMode),
    );

    // Style the content between markers
    if (node.from + markerLength < node.to - markerLength) {
      decorations.push(
        createStyledText(node.from + markerLength, node.to - markerLength, {
          className: "cm-strong",
          style: "font-weight: bold;",
        }),
      );
    }

    return decorations;
  }
}
