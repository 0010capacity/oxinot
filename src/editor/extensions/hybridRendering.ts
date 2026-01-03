import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

/**
 * Widget for rendering checkboxes in task lists
 */
class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly pos: number,
  ) {
    super();
  }

  eq(other: CheckboxWidget) {
    return other.checked === this.checked;
  }

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
      const line = view.state.doc.lineAt(this.pos);
      const lineText = line.text;

      // Find the checkbox marker in the line
      const match = lineText.match(/^(\s*[*\-+]\s+)\[([ xX])\](\s+.*)$/);
      if (match) {
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
    });

    return checkbox;
  }

  ignoreEvent(event: Event): boolean {
    return event.type === "click";
  }
}

/**
 * Decoration spec with position
 */
interface DecorationSpec {
  from: number;
  to: number;
  decoration: Decoration;
}

/**
 * Build decorations for visible range
 */
function buildDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const decorations: DecorationSpec[] = [];

  // Only process visible ranges for performance
  for (const { from, to } of view.visibleRanges) {
    const tree = syntaxTree(state);

    tree.iterate({
      from,
      to,
      enter: (node) => {
        const { type, from: nodeFrom, to: nodeTo } = node;
        const typeName = type.name;

        // Task list items
        if (typeName === "ListItem") {
          const line = state.doc.lineAt(nodeFrom);
          const lineText = line.text;
          const taskMatch = lineText.match(
            /^(\s*[*\-+]\s+)\[([ xX])\](\s+)(.*)$/,
          );

          if (taskMatch) {
            const checked = taskMatch[2].toLowerCase() === "x";
            const markerEnd = line.from + taskMatch[1].length;
            const checkboxEnd = markerEnd + 3; // [x] or [ ]

            // Add checkbox widget at the start of the line
            decorations.push({
              from: line.from,
              to: line.from,
              decoration: Decoration.widget({
                widget: new CheckboxWidget(checked, line.from),
                side: 1,
              }),
            });

            // Hide the markdown checkbox syntax
            decorations.push({
              from: markerEnd,
              to: checkboxEnd,
              decoration: Decoration.mark({
                class: "cm-hidden",
                attributes: {
                  style: "opacity: 0.3; font-size: 0.85em;",
                },
              }),
            });
          }
          return false;
        }

        // Headings - style the text, keep syntax visible but dimmed
        if (typeName.startsWith("ATXHeading")) {
          const line = state.doc.lineAt(nodeFrom);
          const lineText = line.text;
          const match = lineText.match(/^(#{1,6})(\s+(.*))?$/);

          if (match) {
            const hashMarks = match[1];
            const hashEnd = line.from + hashMarks.length;
            const level = hashMarks.length;
            const fontSizeMultiplier = 2.2 - level * 0.2;

            // Dim the hash marks
            decorations.push({
              from: line.from,
              to: hashEnd,
              decoration: Decoration.mark({
                class: "cm-hidden",
                attributes: {
                  style: "opacity: 0.3; font-size: 0.85em;",
                },
              }),
            });

            // Style the heading text (if there is any)
            if (hashEnd < line.to) {
              decorations.push({
                from: hashEnd,
                to: line.to,
                decoration: Decoration.mark({
                  class: `cm-heading-text cm-heading-${level}`,
                  attributes: {
                    style: `
                      font-weight: ${level <= 2 ? "bold" : "600"};
                      font-size: ${fontSizeMultiplier}em;
                      line-height: 1.3;
                    `,
                  },
                }),
              });
            }
          }
          return false;
        }

        // Fenced code blocks
        if (typeName === "FencedCode") {
          const content = state.doc.sliceString(nodeFrom, nodeTo);
          const lines = content.split("\n");
          const firstLine = lines[0] || "";
          const lastLine = lines[lines.length - 1] || "";

          if (lines.length > 2) {
            const firstLineEnd = nodeFrom + firstLine.length;
            const lastLineStart = nodeTo - lastLine.length;

            // Dim the opening fence
            decorations.push({
              from: nodeFrom,
              to: firstLineEnd,
              decoration: Decoration.mark({
                class: "cm-hidden",
                attributes: {
                  style: "opacity: 0.3; font-size: 0.85em;",
                },
              }),
            });

            // Style the code content
            if (lastLineStart > firstLineEnd + 1) {
              decorations.push({
                from: firstLineEnd + 1,
                to: lastLineStart - 1,
                decoration: Decoration.mark({
                  class: "cm-code-content",
                  attributes: {
                    style: `
                      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                      background: rgba(128, 128, 128, 0.1);
                      display: block;
                      padding: 0.5em;
                    `,
                  },
                }),
              });
            }

            // Dim the closing fence
            if (lastLine.includes("```")) {
              decorations.push({
                from: lastLineStart,
                to: nodeTo,
                decoration: Decoration.mark({
                  class: "cm-hidden",
                  attributes: {
                    style: "opacity: 0.3; font-size: 0.85em;",
                  },
                }),
              });
            }
          }
          return false;
        }

        // Inline code
        if (typeName === "InlineCode") {
          decorations.push({
            from: nodeFrom,
            to: nodeTo,
            decoration: Decoration.mark({
              class: "cm-inline-code",
              attributes: {
                style: `
                  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                  background: rgba(128, 128, 128, 0.15);
                  padding: 0.1em 0.3em;
                  border-radius: 3px;
                  font-size: 0.9em;
                `,
              },
            }),
          });
          return false;
        }

        // Emphasis (italic)
        if (typeName === "Emphasis") {
          const content = state.doc.sliceString(nodeFrom, nodeTo);
          const inner = content.replace(/^[*_]/, "").replace(/[*_]$/, "");

          if (inner.length > 0 && content.length >= 2) {
            // Hide opening marker
            decorations.push({
              from: nodeFrom,
              to: nodeFrom + 1,
              decoration: Decoration.mark({
                class: "cm-hidden",
                attributes: {
                  style: "opacity: 0.3; font-size: 0.85em;",
                },
              }),
            });

            // Style the content
            decorations.push({
              from: nodeFrom + 1,
              to: nodeTo - 1,
              decoration: Decoration.mark({
                class: "cm-emphasis",
                attributes: {
                  style: "font-style: italic;",
                },
              }),
            });

            // Hide closing marker
            decorations.push({
              from: nodeTo - 1,
              to: nodeTo,
              decoration: Decoration.mark({
                class: "cm-hidden",
                attributes: {
                  style: "opacity: 0.3; font-size: 0.85em;",
                },
              }),
            });
          }
          return false;
        }

        // Strong emphasis (bold)
        if (typeName === "StrongEmphasis") {
          const content = state.doc.sliceString(nodeFrom, nodeTo);
          const markerLength = content.startsWith("**")
            ? 2
            : content.startsWith("__")
              ? 2
              : 1;

          if (content.length > markerLength * 2) {
            // Hide opening markers
            decorations.push({
              from: nodeFrom,
              to: nodeFrom + markerLength,
              decoration: Decoration.mark({
                class: "cm-hidden",
                attributes: {
                  style: "opacity: 0.3; font-size: 0.85em;",
                },
              }),
            });

            // Style the content
            decorations.push({
              from: nodeFrom + markerLength,
              to: nodeTo - markerLength,
              decoration: Decoration.mark({
                class: "cm-strong",
                attributes: {
                  style: "font-weight: bold;",
                },
              }),
            });

            // Hide closing markers
            decorations.push({
              from: nodeTo - markerLength,
              to: nodeTo,
              decoration: Decoration.mark({
                class: "cm-hidden",
                attributes: {
                  style: "opacity: 0.3; font-size: 0.85em;",
                },
              }),
            });
          }
          return false;
        }

        // Links
        if (typeName === "Link") {
          const content = state.doc.sliceString(nodeFrom, nodeTo);
          const match = content.match(/\[([^\]]+)\]\(([^)]+)\)/);

          if (match) {
            const textStart = nodeFrom + 1;
            const textEnd = textStart + match[1].length;

            // Hide opening bracket
            decorations.push({
              from: nodeFrom,
              to: textStart,
              decoration: Decoration.mark({
                class: "cm-hidden",
                attributes: {
                  style: "opacity: 0.3; font-size: 0.85em;",
                },
              }),
            });

            // Style link text
            decorations.push({
              from: textStart,
              to: textEnd,
              decoration: Decoration.mark({
                class: "cm-link-text",
                attributes: {
                  style:
                    "color: #4dabf7; text-decoration: underline; cursor: pointer;",
                },
              }),
            });

            // Hide the rest of the link syntax
            decorations.push({
              from: textEnd,
              to: nodeTo,
              decoration: Decoration.mark({
                class: "cm-hidden",
                attributes: {
                  style: "opacity: 0.3; font-size: 0.85em;",
                },
              }),
            });
          }
          return false;
        }

        // Blockquote
        if (typeName === "Blockquote") {
          decorations.push({
            from: nodeFrom,
            to: nodeTo,
            decoration: Decoration.mark({
              class: "cm-blockquote",
              attributes: {
                style: `
                  border-left: 3px solid #ccc;
                  padding-left: 1em;
                  margin-left: 0;
                  color: #666;
                  font-style: italic;
                `,
              },
            }),
          });
          return false;
        }

        return true;
      },
    });
  }

  // Sort decorations by position before building
  decorations.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    if (a.to !== b.to) return a.to - b.to;
    return 0;
  });

  // Build the decoration set
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to, decoration } of decorations) {
    builder.add(from, to, decoration);
  }

  return builder.finish();
}

/**
 * View plugin for hybrid rendering
 */
export const hybridRenderingPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      // Rebuild decorations if document changed or viewport changed
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

/**
 * Theme for hybrid rendering
 */
export const hybridRenderingTheme = EditorView.theme({
  ".cm-task-checkbox": {
    accentColor: "#4dabf7",
  },
  ".cm-heading": {
    display: "block",
  },
  ".cm-code-block": {
    margin: "0.5em 0",
  },
  ".cm-hidden": {
    opacity: "0.3",
    fontSize: "0.85em",
  },
  ".cm-emphasis": {
    fontStyle: "italic",
  },
  ".cm-strong": {
    fontWeight: "bold",
  },
  ".cm-inline-code": {
    fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
    backgroundColor: "rgba(128, 128, 128, 0.15)",
    padding: "0.1em 0.3em",
    borderRadius: "3px",
    fontSize: "0.9em",
  },
  ".cm-link-text": {
    color: "#4dabf7",
    textDecoration: "underline",
    cursor: "pointer",
  },
  ".cm-blockquote": {
    borderLeft: "3px solid #ccc",
    paddingLeft: "1em",
    marginLeft: "0",
    color: "#666",
    fontStyle: "italic",
  },
  ".cm-line": {
    lineHeight: "1.6",
  },
});
