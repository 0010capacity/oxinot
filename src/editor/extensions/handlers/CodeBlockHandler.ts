/**
 * Code Block handler for hybrid rendering
 *
 * Handles fenced code blocks (```lang ... ```)
 * - Hides fence markers completely
 * - Renders code block as a styled widget with optional line numbers
 * - Applies monospace font and background styling
 */

import { SyntaxNode } from "@lezer/common";
import { BaseHandler, RenderContext } from "./types";
import { DecorationSpec } from "../utils/decorationHelpers";
import {
  createHiddenMarker,
  createStyledText,
} from "../utils/decorationHelpers";
import { Decoration, WidgetType } from "@codemirror/view";
import { useOutlinerSettingsStore } from "../../../stores/outlinerSettingsStore";

class CodeBlockWidget extends WidgetType {
  private readonly code: string;
  private readonly language: string;
  private readonly showLineNumbers: boolean;

  constructor(code: string, language: string, showLineNumbers: boolean) {
    super();
    this.code = code;
    this.language = language;
    this.showLineNumbers = showLineNumbers;
  }

  eq(other: CodeBlockWidget) {
    return (
      other.code === this.code &&
      other.language === this.language &&
      other.showLineNumbers === this.showLineNumbers
    );
  }

  toDOM() {
    const container = document.createElement("div");
    container.className = "cm-code-block-widget";
    container.style.margin = "8px 0";
    container.style.background = "rgba(128, 128, 128, 0.08)";
    container.style.borderRadius = "6px";
    container.style.overflow = "hidden";
    container.style.border = "1px solid rgba(128, 128, 128, 0.15)";

    // Language header (if specified)
    if (this.language) {
      const header = document.createElement("div");
      header.className = "cm-code-block-header";
      header.style.padding = "6px 12px";
      header.style.background = "rgba(128, 128, 128, 0.06)";
      header.style.borderBottom = "1px solid rgba(128, 128, 128, 0.1)";
      header.style.fontSize = "12px";
      header.style.fontWeight = "500";
      header.style.opacity = "0.7";
      header.textContent = this.language;
      container.appendChild(header);
    }

    // Code content container
    const codeContainer = document.createElement("div");
    codeContainer.className = "cm-code-block-content";
    codeContainer.style.display = "flex";
    codeContainer.style.padding = "12px 0";

    const lines = this.code.split("\n");

    // Line numbers (if enabled)
    if (this.showLineNumbers) {
      const lineNumbers = document.createElement("div");
      lineNumbers.className = "cm-code-block-line-numbers";
      lineNumbers.style.padding = "0 12px 0 16px";
      lineNumbers.style.textAlign = "right";
      lineNumbers.style.userSelect = "none";
      lineNumbers.style.opacity = "0.4";
      lineNumbers.style.fontFamily =
        "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace";
      lineNumbers.style.fontSize = "13px";
      lineNumbers.style.lineHeight = "1.6";
      lineNumbers.style.minWidth = "40px";

      lines.forEach((_, index) => {
        const lineNum = document.createElement("div");
        lineNum.textContent = String(index + 1);
        lineNumbers.appendChild(lineNum);
      });

      codeContainer.appendChild(lineNumbers);
    }

    // Code content
    const codeContent = document.createElement("pre");
    codeContent.className = "cm-code-block-pre";
    codeContent.style.margin = "0";
    codeContent.style.padding = this.showLineNumbers ? "0 16px 0 0" : "0 16px";
    codeContent.style.flex = "1";
    codeContent.style.overflow = "auto";
    codeContent.style.fontFamily =
      "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace";
    codeContent.style.fontSize = "13px";
    codeContent.style.lineHeight = "1.6";

    const codeElement = document.createElement("code");
    codeElement.textContent = this.code;
    codeContent.appendChild(codeElement);

    codeContainer.appendChild(codeContent);
    container.appendChild(codeContainer);

    return container;
  }

  ignoreEvent() {
    // Make code block read-only when rendered as widget
    return true;
  }
}

export class CodeBlockHandler extends BaseHandler {
  constructor() {
    super("CodeBlockHandler");
  }

  canHandle(node: SyntaxNode): boolean {
    return node.type.name === "FencedCode";
  }

  handle(node: SyntaxNode, context: RenderContext): DecorationSpec[] {
    const decorations: DecorationSpec[] = [];
    const content = this.getNodeText(node, context);
    const lines = content.split("\n");

    if (lines.length < 2) {
      return decorations;
    }

    // Check if cursor is in this code block
    const cursorPos = context.cursor.pos;
    const isInCodeBlock = cursorPos >= node.from && cursorPos <= node.to;

    // If cursor is in the code block, don't render as widget (allow editing)
    if (isInCodeBlock) {
      const firstLine = lines[0] || "";
      const lastLine = lines[lines.length - 1] || "";
      const firstLineEnd = node.from + firstLine.length;
      const lastLineStart = node.to - lastLine.length;

      // Always hide fence markers completely (even when cursor is inside)
      decorations.push(createHiddenMarker(node.from, firstLineEnd, false));

      if (lastLine.includes("```")) {
        decorations.push(createHiddenMarker(lastLineStart, node.to, false));
      }

      // Apply styling to code content when editing
      if (lastLineStart > firstLineEnd + 1) {
        decorations.push(
          createStyledText(firstLineEnd + 1, lastLineStart - 1, {
            className: "cm-code-block-editing",
            style: `
              font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
              background: rgba(128, 128, 128, 0.08);
              border: 1px solid rgba(128, 128, 128, 0.15);
              border-radius: 6px;
              padding: 8px;
              display: block;
              line-height: 1.6;
            `,
          }),
        );
      }

      return decorations;
    }

    // Not in code block: render as widget
    const firstLine = lines[0] || "";
    const lastLine = lines[lines.length - 1] || "";

    // Check if code block is complete (has closing ```)
    const hasClosingFence = lastLine.trim().startsWith("```");
    if (!hasClosingFence) {
      // Incomplete code block - just hide the opening marker
      const firstLineEnd = node.from + firstLine.length;
      decorations.push(createHiddenMarker(node.from, firstLineEnd, false));
      return decorations;
    }

    // Extract language from first line (```language)
    const languageMatch = firstLine.match(/^```(\w+)?/);
    const language = languageMatch?.[1] || "";

    // Extract code content (everything between first and last line)
    const codeLines = lines.slice(1, -1);
    const code = codeLines.join("\n");

    // Get setting for line numbers
    const showLineNumbers =
      useOutlinerSettingsStore.getState().showCodeBlockLineNumbers;

    // Hide the entire code block content
    decorations.push(createHiddenMarker(node.from, node.to, false));

    // Insert widget at the code block position
    decorations.push({
      from: node.from,
      to: node.to,
      decoration: Decoration.widget({
        widget: new CodeBlockWidget(code, language, showLineNumbers),
        side: 0,
        block: true,
      }),
    });

    return decorations;
  }
}
