/**
 * Task List handler for hybrid rendering
 *
 * Handles interactive task lists with checkboxes
 * - [ ] Unchecked task
 * - [x] Checked task
 *
 * - Renders interactive checkbox widgets
 * - Hides markdown checkbox syntax
 * - Shows dimmed syntax when cursor is on line
 */

import { SyntaxNode } from "@lezer/common";
import { BaseHandler, RenderContext } from "./types";
import { DecorationSpec } from "../utils/decorationHelpers";
import { createHiddenMarker, createWidget } from "../utils/decorationHelpers";
import { CheckboxWidget } from "../widgets/CheckboxWidget";

export class TaskListHandler extends BaseHandler {
  constructor() {
    super("TaskListHandler");
  }

  canHandle(node: SyntaxNode): boolean {
    return node.type.name === "ListItem";
  }

  handle(node: SyntaxNode, context: RenderContext): DecorationSpec[] {
    const decorations: DecorationSpec[] = [];
    const line = this.getNodeLine(node, context);
    const lineText = line.text;

    // Check if this is a task list item
    // Format: - [ ] text or - [x] text (also works with *, +)
    const taskMatch = lineText.match(/^(\s*[*\-+]\s+)\[([ xX])\](\s+)(.*)$/);

    if (!taskMatch) {
      // Not a task list item, let it be handled normally
      return decorations;
    }

    const checked = taskMatch[2].toLowerCase() === "x";
    const markerEnd = line.from + taskMatch[1].length;
    const checkboxEnd = markerEnd + 3; // [x] or [ ]

    // Add checkbox widget at the start of the line
    decorations.push(
      createWidget(line.from, new CheckboxWidget(checked, line.from), 1),
    );

    // Hide the markdown checkbox syntax
    // Show dimmed in edit mode
    decorations.push(
      createHiddenMarker(markerEnd, checkboxEnd, context.isEditMode),
    );

    return decorations;
  }
}
