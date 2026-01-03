/**
 * Checkbox Widget for Task Lists
 *
 * Interactive checkbox widget that renders in place of markdown task list syntax.
 * Handles click events to toggle task completion state.
 */

import { EditorView, WidgetType } from "@codemirror/view";

/**
 * Widget for rendering interactive checkboxes in task lists
 *
 * Replaces markdown syntax like:
 * - [ ] Unchecked task
 * - [x] Checked task
 *
 * With actual clickable checkbox elements
 */
export class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly pos: number,
  ) {
    super();
  }

  /**
   * Check if this widget is equal to another (for optimization)
   */
  eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked;
  }

  /**
   * Create the DOM element for the checkbox
   */
  toDOM(view: EditorView): HTMLElement {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = this.checked;
    checkbox.className = "cm-task-checkbox";
    checkbox.style.cssText = `
      margin-right: 0.5em;
      cursor: pointer;
      vertical-align: middle;
    `;

    // Handle checkbox toggle
    checkbox.addEventListener("click", (e) => {
      e.preventDefault();
      this.toggleCheckbox(view);
    });

    return checkbox;
  }

  /**
   * Toggle the checkbox state by modifying the document
   */
  private toggleCheckbox(view: EditorView): void {
    const line = view.state.doc.lineAt(this.pos);
    const lineText = line.text;

    // Find the checkbox marker in the line
    const match = lineText.match(/^(\s*[*\-+]\s+)\[([ xX])\](\s+.*)$/);
    if (!match) {
      return;
    }

    const newMarker = this.checked ? " " : "x";
    const newText = `${match[1]}[${newMarker}]${match[3]}`;

    view.dispatch({
      changes: {
        from: line.from,
        to: line.to,
        insert: newText,
      },
    });
  }

  /**
   * Specify which events this widget handles
   */
  ignoreEvent(event: Event): boolean {
    return event.type === "click";
  }
}
