/**
 * Link handler for hybrid rendering
 *
 * Handles markdown links [text](url)
 * - Hides brackets and parentheses when cursor is not on line
 * - Shows dimmed markers when editing
 * - Styles link text as clickable
 */

import type { SyntaxNode } from "@lezer/common";
import { getLinkStyle } from "../theme/styles";
import type { DecorationSpec } from "../utils/decorationHelpers";
import {
  createHiddenMarker,
  createStyledText,
} from "../utils/decorationHelpers";
import { BaseHandler, type RenderContext } from "./types";

export class LinkHandler extends BaseHandler {
  constructor() {
    super("LinkHandler");
  }

  canHandle(node: SyntaxNode): boolean {
    return node.type.name === "Link";
  }

  handle(node: SyntaxNode, context: RenderContext): DecorationSpec[] {
    const decorations: DecorationSpec[] = [];
    const content = this.getNodeText(node, context);

    // Link format: [text](url)
    // We need to parse it to find the boundaries
    const match = content.match(/^\[([^\]]*)\]\(([^)]*)\)$/);
    if (!match) {
      return decorations;
    }

    const text = match[1];
    const url = match[2];

    const textStart = node.from + 1; // After [
    const textEnd = textStart + text.length;
    const urlStart = textEnd + 2; // After ](
    const urlEnd = urlStart + url.length;

    // Hide opening bracket [
    decorations.push(
      createHiddenMarker(node.from, node.from + 1, context.isEditMode)
    );

    // Style the link text
    decorations.push(
      createStyledText(textStart, textEnd, {
        className: "cm-link-text",
        style: getLinkStyle(),
      })
    );

    // Hide ]( between text and URL
    decorations.push(createHiddenMarker(textEnd, urlStart, context.isEditMode));

    // Hide URL in preview mode, but show it with readable styling in edit mode
    if (context.isEditMode) {
      decorations.push(
        createStyledText(urlStart, urlEnd, {
          className: "cm-link-url",
        })
      );
    } else {
      decorations.push(
        createHiddenMarker(urlStart, urlEnd, context.isEditMode)
      );
    }

    // Hide closing parenthesis )
    decorations.push(createHiddenMarker(urlEnd, node.to, context.isEditMode));

    return decorations;
  }
}
