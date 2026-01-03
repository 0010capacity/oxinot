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

  // Get the current cursor line
  const cursorLine = state.doc.lineAt(state.selection.main.head);
  const cursorLineFrom = cursorLine.from;
  const cursorLineTo = cursorLine.to;

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

            // Hide the markdown checkbox syntax (completely hidden if not on cursor line)
            const isOnCursorLine =
              line.from >= cursorLineFrom && line.to <= cursorLineTo;
            decorations.push({
              from: markerEnd,
              to: checkboxEnd,
              decoration: Decoration.mark({
                class: "cm-hidden",
                attributes: {
                  style: isOnCursorLine
                    ? "opacity: 0.4; font-size: 0.85em;"
                    : "display: none;",
                },
              }),
            });
          }
          return true; // Continue to process inline elements inside list items
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

            // Hide hash marks completely unless on cursor line
            const isOnCursorLine =
              line.from >= cursorLineFrom && line.to <= cursorLineTo;
            decorations.push({
              from: line.from,
              to: hashEnd,
              decoration: Decoration.mark({
                class: "cm-hidden",
                attributes: {
                  style: isOnCursorLine
                    ? "opacity: 0.4; font-size: 0.85em;"
                    : "display: none;",
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

            // Check if cursor is in this code block
            const isInCodeBlock =
              cursorLineFrom >= nodeFrom && cursorLineTo <= nodeTo;

            // Hide the opening fence
            decorations.push({
              from: nodeFrom,
              to: firstLineEnd,
              decoration: Decoration.mark({
                class: "cm-hidden",
                attributes: {
                  style: isInCodeBlock
                    ? "opacity: 0.4; font-size: 0.85em;"
                    : "display: none;",
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

            // Hide the closing fence
            if (lastLine.includes("```")) {
              decorations.push({
                from: lastLineStart,
                to: nodeTo,
                decoration: Decoration.mark({
                  class: "cm-hidden",
                  attributes: {
                    style: isInCodeBlock
                      ? "opacity: 0.4; font-size: 0.85em;"
                      : "display: none;",
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
          const line = state.doc.lineAt(nodeFrom);
          const isOnCursorLine =
            state.selection.main.head >= line.from &&
            state.selection.main.head <= line.to;

          // Find markers (*, _)
          const markerChar = content[0];
          if (markerChar === "*" || markerChar === "_") {
            // Style the entire emphasis first
            decorations.push({
              from: nodeFrom,
              to: nodeTo,
              decoration: Decoration.mark({
                class: "cm-emphasis",
                attributes: {
                  style: "font-style: italic;",
                },
              }),
            });

            // Then hide markers on top
            if (!isOnCursorLine) {
              // Hide opening marker
              decorations.push({
                from: nodeFrom,
                to: nodeFrom + 1,
                decoration: Decoration.replace({}),
              });
              // Hide closing marker
              decorations.push({
                from: nodeTo - 1,
                to: nodeTo,
                decoration: Decoration.replace({}),
              });
            } else {
              // Show markers dimmed when cursor is on line
              decorations.push({
                from: nodeFrom,
                to: nodeFrom + 1,
                decoration: Decoration.mark({
                  class: "cm-dim-marker",
                  attributes: {
                    style: "opacity: 0.5;",
                  },
                }),
              });
              decorations.push({
                from: nodeTo - 1,
                to: nodeTo,
                decoration: Decoration.mark({
                  class: "cm-dim-marker",
                  attributes: {
                    style: "opacity: 0.5;",
                  },
                }),
              });
            }
          }
          return false;
        }

        // Strong emphasis (bold)
        if (typeName === "StrongEmphasis") {
          const content = state.doc.sliceString(nodeFrom, nodeTo);
          const line = state.doc.lineAt(nodeFrom);
          const isOnCursorLine =
            state.selection.main.head >= line.from &&
            state.selection.main.head <= line.to;

          // Find marker length (**, __)
          const markerLength =
            content.startsWith("**") || content.startsWith("__") ? 2 : 0;

          if (markerLength > 0 && content.length > markerLength * 2) {
            // Style the entire strong emphasis first
            decorations.push({
              from: nodeFrom,
              to: nodeTo,
              decoration: Decoration.mark({
                class: "cm-strong",
                attributes: {
                  style: "font-weight: bold;",
                },
              }),
            });

            // Then hide markers on top
            if (!isOnCursorLine) {
              // Hide opening markers
              decorations.push({
                from: nodeFrom,
                to: nodeFrom + markerLength,
                decoration: Decoration.replace({}),
              });
              // Hide closing markers
              decorations.push({
                from: nodeTo - markerLength,
                to: nodeTo,
                decoration: Decoration.replace({}),
              });
            } else {
              // Show markers dimmed when cursor is on line
              decorations.push({
                from: nodeFrom,
                to: nodeFrom + markerLength,
                decoration: Decoration.mark({
                  class: "cm-dim-marker",
                  attributes: {
                    style: "opacity: 0.5;",
                  },
                }),
              });
              decorations.push({
                from: nodeTo - markerLength,
                to: nodeTo,
                decoration: Decoration.mark({
                  class: "cm-dim-marker",
                  attributes: {
                    style: "opacity: 0.5;",
                  },
                }),
              });
            }
          }
          return false;
        }

        // Links
        if (typeName === "Link") {
          const content = state.doc.sliceString(nodeFrom, nodeTo);
          const line = state.doc.lineAt(nodeFrom);
          const isOnCursorLine =
            state.selection.main.head >= line.from &&
            state.selection.main.head <= line.to;

          const match = content.match(/\[([^\]]+)\]\(([^)]+)\)/);

          if (match) {
            const textStart = nodeFrom + 1;
            const textEnd = textStart + match[1].length;

            // Style link text first
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

            // Then hide/show brackets
            if (!isOnCursorLine) {
              // Hide opening bracket [
              decorations.push({
                from: nodeFrom,
                to: textStart,
                decoration: Decoration.replace({}),
              });
              // Hide ](url)
              decorations.push({
                from: textEnd,
                to: nodeTo,
                decoration: Decoration.replace({}),
              });
            } else {
              // Show brackets dimmed when cursor is on line
              decorations.push({
                from: nodeFrom,
                to: textStart,
                decoration: Decoration.mark({
                  class: "cm-dim-marker",
                  attributes: {
                    style: "opacity: 0.5;",
                  },
                }),
              });
              decorations.push({
                from: textEnd,
                to: nodeTo,
                decoration: Decoration.mark({
                  class: "cm-dim-marker",
                  attributes: {
                    style: "opacity: 0.5;",
                  },
                }),
              });
            }
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

        // Strikethrough
        if (typeName === "Strikethrough") {
          const content = state.doc.sliceString(nodeFrom, nodeTo);
          const line = state.doc.lineAt(nodeFrom);
          const isOnCursorLine =
            state.selection.main.head >= line.from &&
            state.selection.main.head <= line.to;

          // Check for ~~ markers
          if (content.startsWith("~~") && content.endsWith("~~")) {
            // Style the entire strikethrough text
            decorations.push({
              from: nodeFrom,
              to: nodeTo,
              decoration: Decoration.mark({
                class: "cm-strikethrough",
                attributes: {
                  style: "text-decoration: line-through; opacity: 0.7;",
                },
              }),
            });

            // Hide markers
            if (!isOnCursorLine) {
              // Hide opening ~~
              decorations.push({
                from: nodeFrom,
                to: nodeFrom + 2,
                decoration: Decoration.replace({}),
              });
              // Hide closing ~~
              decorations.push({
                from: nodeTo - 2,
                to: nodeTo,
                decoration: Decoration.replace({}),
              });
            } else {
              // Show markers dimmed when cursor is on line
              decorations.push({
                from: nodeFrom,
                to: nodeFrom + 2,
                decoration: Decoration.mark({
                  class: "cm-dim-marker",
                  attributes: {
                    style: "opacity: 0.5;",
                  },
                }),
              });
              decorations.push({
                from: nodeTo - 2,
                to: nodeTo,
                decoration: Decoration.mark({
                  class: "cm-dim-marker",
                  attributes: {
                    style: "opacity: 0.5;",
                  },
                }),
              });
            }
          }
          return false;
        }

        // Autolink (URLs)
        if (typeName === "URL" || typeName === "Autolink") {
          decorations.push({
            from: nodeFrom,
            to: nodeTo,
            decoration: Decoration.mark({
              class: "cm-autolink",
              attributes: {
                style:
                  "color: #4dabf7; text-decoration: underline; cursor: pointer;",
              },
            }),
          });
          return false;
        }

        return true;
      },
    });
  }

  // Process tables line by line with CSS styling
  let isHeaderRow = false;
  let prevLineWasTable = false;

  for (let lineNum = 1; lineNum <= state.doc.lines; lineNum++) {
    const line = state.doc.line(lineNum);
    const lineText = line.text;
    const isTableLine = /^\s*\|.*\|/.test(lineText);
    const isSeparator = /^\s*\|?[\s\-:|]+\|[\s\-:|]*$/.test(lineText);

    if (isTableLine) {
      const isOnCursorLine =
        state.selection.main.head >= line.from &&
        state.selection.main.head <= line.to;

      // Check if next line is separator (meaning this is header)
      const isHeader =
        lineNum < state.doc.lines &&
        /^\s*\|?[\s\-:|]+\|[\s\-:|]*$/.test(state.doc.line(lineNum + 1).text);

      if (isSeparator) {
        // Completely hide separator line when not on cursor
        if (!isOnCursorLine) {
          decorations.push({
            from: line.from,
            to: line.to,
            decoration: Decoration.mark({
              class: "cm-table-separator-hidden",
              attributes: {
                style:
                  "font-size: 0; line-height: 0; opacity: 0; height: 0; display: block; overflow: hidden;",
              },
            }),
          });
        } else {
          decorations.push({
            from: line.from,
            to: line.to,
            decoration: Decoration.mark({
              class: "cm-table-separator",
              attributes: {
                style: "opacity: 0.4; color: #888;",
              },
            }),
          });
        }
        prevLineWasTable = true;
      } else {
        // Parse cells and create grid layout
        const cells = lineText
          .split("|")
          .map((cell) => cell.trim())
          .filter((cell) => cell.length > 0);

        // Apply table row styling with proper borders and spacing
        const rowStyle = isHeader
          ? `
            display: grid;
            grid-template-columns: repeat(${cells.length}, 1fr);
            gap: 0;
            padding: 0.75em 0;
            font-weight: 600;
            background: linear-gradient(to bottom, rgba(128, 128, 128, 0.08), rgba(128, 128, 128, 0.12));
            border: 1px solid rgba(128, 128, 128, 0.25);
            border-bottom: 2px solid rgba(128, 128, 128, 0.4);
            margin-top: 0.5em;
          `
          : `
            display: grid;
            grid-template-columns: repeat(${cells.length}, 1fr);
            gap: 0;
            padding: 0.6em 0;
            border-left: 1px solid rgba(128, 128, 128, 0.25);
            border-right: 1px solid rgba(128, 128, 128, 0.25);
            border-bottom: 1px solid rgba(128, 128, 128, 0.25);
          `;

        decorations.push({
          from: line.from,
          to: line.to,
          decoration: Decoration.mark({
            class: isHeader ? "cm-table-header" : "cm-table-row",
            attributes: {
              style: rowStyle,
            },
          }),
        });

        // Style each cell with vertical separators
        let cellStart = lineText.indexOf("|");
        cells.forEach((cell, idx) => {
          const cellContent = `|${cell}|`;
          const cellPos = lineText.indexOf(cellContent, cellStart);

          if (cellPos !== -1) {
            const contentStart = cellPos + 1;
            const contentEnd = contentStart + cell.length;

            // Add cell styling
            decorations.push({
              from: line.from + contentStart,
              to: line.from + contentEnd,
              decoration: Decoration.mark({
                class: "cm-table-cell",
                attributes: {
                  style: `
                    padding: 0 1em;
                    ${idx < cells.length - 1 ? "border-right: 1px solid rgba(128, 128, 128, 0.2);" : ""}
                  `,
                },
              }),
            });

            cellStart = contentEnd;
          }
        });

        // Dim or hide pipe characters based on cursor position
        if (!isOnCursorLine) {
          for (let i = 0; i < lineText.length; i++) {
            if (lineText[i] === "|") {
              decorations.push({
                from: line.from + i,
                to: line.from + i + 1,
                decoration: Decoration.mark({
                  class: "cm-table-pipe-hidden",
                  attributes: {
                    style: "font-size: 0; width: 0; opacity: 0;",
                  },
                }),
              });
            }
          }
        } else {
          for (let i = 0; i < lineText.length; i++) {
            if (lineText[i] === "|") {
              decorations.push({
                from: line.from + i,
                to: line.from + i + 1,
                decoration: Decoration.mark({
                  class: "cm-table-pipe",
                  attributes: {
                    style: "opacity: 0.3; color: #888;",
                  },
                }),
              });
            }
          }
        }
        prevLineWasTable = true;
      }
    } else {
      prevLineWasTable = false;
    }
  }

  // Process strikethrough line by line (for cases parser doesn't catch)
  for (let lineNum = 1; lineNum <= state.doc.lines; lineNum++) {
    const line = state.doc.line(lineNum);
    const lineText = line.text;
    const isOnCursorLine =
      state.selection.main.head >= line.from &&
      state.selection.main.head <= line.to;

    // Find ~~text~~ patterns
    const strikethroughRegex = /~~([^~]+)~~/g;
    let match;
    while ((match = strikethroughRegex.exec(lineText)) !== null) {
      const start = line.from + match.index;
      const end = start + match[0].length;

      // Style the strikethrough text
      decorations.push({
        from: start,
        to: end,
        decoration: Decoration.mark({
          class: "cm-strikethrough",
          attributes: {
            style: "text-decoration: line-through; opacity: 0.7;",
          },
        }),
      });

      // Hide markers
      if (!isOnCursorLine) {
        // Hide opening ~~
        decorations.push({
          from: start,
          to: start + 2,
          decoration: Decoration.replace({}),
        });
        // Hide closing ~~
        decorations.push({
          from: end - 2,
          to: end,
          decoration: Decoration.replace({}),
        });
      } else {
        // Show markers dimmed when cursor is on line
        decorations.push({
          from: start,
          to: start + 2,
          decoration: Decoration.mark({
            class: "cm-dim-marker",
            attributes: {
              style: "opacity: 0.5;",
            },
          }),
        });
        decorations.push({
          from: end - 2,
          to: end,
          decoration: Decoration.mark({
            class: "cm-dim-marker",
            attributes: {
              style: "opacity: 0.5;",
            },
          }),
        });
      }
    }
  }

  // Process footnotes line by line
  for (let lineNum = 1; lineNum <= state.doc.lines; lineNum++) {
    const line = state.doc.line(lineNum);
    const lineText = line.text;

    // Footnote definition: [^1]: footnote text
    const footnoteDefMatch = lineText.match(/^\[\^([^\]]+)\]:\s+(.+)$/);
    if (footnoteDefMatch) {
      const isOnCursorLine =
        state.selection.main.head >= line.from &&
        state.selection.main.head <= line.to;

      if (!isOnCursorLine) {
        // Dim the entire footnote definition
        decorations.push({
          from: line.from,
          to: line.to,
          decoration: Decoration.mark({
            class: "cm-footnote-def",
            attributes: {
              style:
                "color: #888; font-size: 0.9em; font-style: italic; opacity: 0.7;",
            },
          }),
        });
      }
    }

    // Footnote reference: [^1]
    const footnoteRefRegex = /\[\^([^\]]+)\]/g;
    let match;
    while ((match = footnoteRefRegex.exec(lineText)) !== null) {
      const refStart = line.from + match.index;
      const refEnd = refStart + match[0].length;

      decorations.push({
        from: refStart,
        to: refEnd,
        decoration: Decoration.mark({
          class: "cm-footnote-ref",
          attributes: {
            style:
              "color: #4dabf7; font-size: 0.85em; vertical-align: super; cursor: pointer;",
          },
        }),
      });
    }
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
      // Rebuild decorations if document changed, viewport changed, or selection changed
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
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
  ".cm-hidden-marker": {
    fontSize: "0",
    opacity: "0",
  },
  ".cm-dim-marker": {
    opacity: "0.5",
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
  ".cm-table": {
    display: "block",
    margin: "1em 0",
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  ".cm-table-row": {
    display: "block",
  },
  ".cm-table-separator": {
    opacity: "0.4",
    color: "#888",
  },
  ".cm-table-separator-hidden": {
    fontSize: "0",
    lineHeight: "0",
    opacity: "0",
    height: "0",
    display: "block",
    overflow: "hidden",
  },
  ".cm-table-delimiter": {
    opacity: "0.2",
    color: "#666",
    padding: "0 0.5em",
  },
  ".cm-table-pipe": {
    opacity: "0.3",
    color: "#888",
  },
  ".cm-table-pipe-hidden": {
    fontSize: "0",
    width: "0",
    opacity: "0",
  },
  ".cm-table-header": {
    display: "grid",
    fontWeight: "600",
    background:
      "linear-gradient(to bottom, rgba(128, 128, 128, 0.08), rgba(128, 128, 128, 0.12))",
  },
  ".cm-table-row": {
    display: "grid",
  },
  ".cm-table-cell": {
    padding: "0 1em",
  },
  ".cm-strikethrough": {
    textDecoration: "line-through",
    opacity: "0.7",
  },
  ".cm-autolink": {
    color: "#4dabf7",
    textDecoration: "underline",
    cursor: "pointer",
  },
  ".cm-footnote-ref": {
    color: "#4dabf7",
    fontSize: "0.85em",
    verticalAlign: "super",
    cursor: "pointer",
  },
  ".cm-footnote-def": {
    color: "#888",
    fontSize: "0.9em",
    fontStyle: "italic",
    opacity: "0.7",
  },
  ".cm-line": {
    lineHeight: "1.6",
  },
});
