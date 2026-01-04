/**
 * Setext Heading handler for hybrid rendering
 *
 * Handles Setext-style headings (underlined with = or -)
 * - H1: Text followed by line of ===
 * - H2: Text followed by line of ---
 * - Hides the underline markers completely
 * - Applies appropriate heading styles to the text
 */

import { SyntaxNode } from "@lezer/common";
import { BaseHandler, RenderContext } from "./types";
import { DecorationSpec } from "../utils/decorationHelpers";
import {
  createHiddenMarker,
  createStyledText,
} from "../utils/decorationHelpers";
import { getHeadingStyle } from "../theme/styles";

export class SetextHeadingHandler extends BaseHandler {
  constructor() {
    super("SetextHeadingHandler");
  }

  canHandle(node: SyntaxNode): boolean {
    return node.type.name === "SetextHeading1" || node.type.name === "SetextHeading2";
  }

  handle(node: SyntaxNode, context: RenderContext): DecorationSpec[] {
    const decorations: DecorationSpec[] = [];

    // Determine heading level
    const level = node.type.name === "SetextHeading1" ? 1 : 2;

    // Get the document text
    const docText = context.state.doc.toString();
    const headingText = docText.slice(node.from, node.to);

    // Split by newlines to separate text from underline
    const lines = headingText.split('\n');

    if (lines.length < 2) {
      return decorations;
    }

    // First line is the heading text
    const textLine = lines[0];
    const textEnd = node.from + textLine.length;

    // Style the heading text
    decorations.push(
      createStyledText(node.from, textEnd, {
        className: `cm-heading-text cm-heading-${level}`,
        style: getHeadingStyle(level),
      })
    );

    // Hide the underline markers (everything after the text line)
    if (textEnd < node.to) {
      decorations.push(
        createHiddenMarker(textEnd, node.to, false)
      );
    }

    return decorations;
  }
}
