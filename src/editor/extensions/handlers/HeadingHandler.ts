/**
 * Heading handler for hybrid rendering
 *
 * Handles ATX-style headings (# H1, ## H2, etc.)
 * - Hides hash marks in preview mode (block unfocused)
 * - Shows dimmed hash marks in edit mode (block focused)
 * - Applies appropriate font size and weight based on heading level
 */

import type { SyntaxNode } from "@lezer/common";
import { getHeadingStyle } from "../theme/styles";
import type { DecorationSpec } from "../utils/decorationHelpers";
import {
  createHiddenMarker,
  createStyledText,
} from "../utils/decorationHelpers";
import { BaseHandler, type RenderContext } from "./types";

export class HeadingHandler extends BaseHandler {
  constructor() {
    super("HeadingHandler");
  }

  canHandle(node: SyntaxNode): boolean {
    return node.type.name.startsWith("ATXHeading");
  }

  handle(node: SyntaxNode, context: RenderContext): DecorationSpec[] {
    const decorations: DecorationSpec[] = [];
    const line = this.getNodeLine(node, context);
    const lineText = line.text;

    // Match heading pattern: # text or ## text, etc.
    // Capture hash marks and the following space (if present)
    const match = lineText.match(/^(#{1,6})(\s)?(.*)$/);
    if (!match) {
      return decorations;
    }

    const hashMarks = match[1];
    const space = match[2] || "";
    const markerWithSpace = hashMarks + space;
    const markerEnd = line.from + markerWithSpace.length;
    const level = hashMarks.length;

    // Hide/dim the hash marks and the following space based on edit mode
    decorations.push(
      createHiddenMarker(line.from, markerEnd, context.isEditMode),
    );

    // Style the heading text (if there is any)
    if (markerEnd < line.to) {
      decorations.push(
        createStyledText(markerEnd, line.to, {
          className: `cm-heading-text cm-heading-${level}`,
          style: `${getHeadingStyle(level)}; text-decoration: none !important; border-bottom: none !important;`,
        }),
      );
    }

    return decorations;
  }
}
