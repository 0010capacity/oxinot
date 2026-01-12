/**
 * Heading handler for hybrid rendering
 *
 * Handles ATX-style headings (# H1, ## H2, etc.)
 * - Hides hash marks in preview mode (block unfocused)
 * - Shows dimmed hash marks in edit mode (block focused)
 * - Applies appropriate font size and weight based on heading level
 */

import { SyntaxNode } from "@lezer/common";
import { BaseHandler, RenderContext } from "./types";
import { DecorationSpec } from "../utils/decorationHelpers";
import {
  createHiddenMarker,
  createStyledText,
} from "../utils/decorationHelpers";
import { getHeadingStyle } from "../theme/styles";

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
    // Allow optional text after the hash marks
    const match = lineText.match(/^(#{1,6})(\s+(.*))?$/);
    if (!match) {
      return decorations;
    }

    const hashMarks = match[1];
    const hashEnd = line.from + hashMarks.length;
    const level = hashMarks.length;

    // Hide/dim the hash marks based on edit mode
    decorations.push(
      createHiddenMarker(line.from, hashEnd, context.isEditMode),
    );

    // Style the heading text (if there is any)
    if (hashEnd < line.to) {
      decorations.push(
        createStyledText(hashEnd, line.to, {
          className: `cm-heading-text cm-heading-${level}`,
          style: `${getHeadingStyle(level)}; text-decoration: none !important; border-bottom: none !important;`,
        }),
      );
    }

    return decorations;
  }
}
