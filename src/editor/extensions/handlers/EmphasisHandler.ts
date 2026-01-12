/**
 * Emphasis handler for hybrid rendering
 *
 * Handles emphasis/italic text (*text* or _text_)
 * - Hides markers when cursor is not on line
 * - Shows dimmed markers when editing
 * - Applies italic styling to the content
 */

import type { SyntaxNode } from "@lezer/common";
import { BaseHandler, type RenderContext } from "./types";
import type { DecorationSpec } from "../utils/decorationHelpers";
import {
  createHiddenMarker,
  createStyledText,
} from "../utils/decorationHelpers";

export class EmphasisHandler extends BaseHandler {
  constructor() {
    super("EmphasisHandler");
  }

  canHandle(node: SyntaxNode): boolean {
    return node.type.name === "Emphasis";
  }

  handle(node: SyntaxNode, context: RenderContext): DecorationSpec[] {
    const decorations: DecorationSpec[] = [];
    const content = this.getNodeText(node, context);

    // Emphasis is wrapped with * or _
    // Format: *text* or _text_
    const markerChar = content[0]; // * or _

    if (markerChar !== "*" && markerChar !== "_") {
      return decorations;
    }

    // Opening marker (first character)
    decorations.push(
      createHiddenMarker(node.from, node.from + 1, context.isEditMode),
    );

    // Closing marker (last character)
    decorations.push(
      createHiddenMarker(node.to - 1, node.to, context.isEditMode),
    );

    // Style the content between markers
    if (node.from + 1 < node.to - 1) {
      decorations.push(
        createStyledText(node.from + 1, node.to - 1, {
          className: "cm-emphasis",
          style: "font-style: italic;",
        }),
      );
    }

    return decorations;
  }
}
