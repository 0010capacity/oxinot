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

import type { SyntaxNode } from "@lezer/common";
import type { DecorationSpec } from "../utils/decorationHelpers";
import { createHiddenMarker, createWidget } from "../utils/decorationHelpers";
import { CheckboxWidget } from "../widgets/CheckboxWidget";
import { BaseHandler, type RenderContext } from "./types";

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

    // Add checkbox widget at the checkbox position (not at line start)
    // side: -1 places it before the [x] marker to avoid line break issues
    decorations.push(
      createWidget(markerEnd, new CheckboxWidget(checked, markerEnd), -1),
    );

    // Hide the markdown checkbox syntax
    // Show dimmed in edit mode
    decorations.push(
      createHiddenMarker(markerEnd, checkboxEnd, context.isEditMode),
    );

    return decorations;
  }
}
