/**
 * Code Block handler for hybrid rendering
 *
 * Handles fenced code blocks (```lang ... ```)
 * Features:
 * - Interactive view mode with copy button
 * - Hover-triggered edit button
 * - Click to enter edit mode
 * - Keyboard navigation (Escape to exit and collapse, arrows at boundaries)
 * - Optional line numbers
 * - Language and title support (```javascript title="My Code")
 */

import { Decoration, type EditorView, WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { useOutlinerSettingsStore } from "../../../stores/outlinerSettingsStore";
import type { DecorationSpec } from "../utils/decorationHelpers";
import {
  createHiddenMarker,
  createStyledText,
} from "../utils/decorationHelpers";
import { BaseHandler, type RenderContext } from "./types";

/**
 * Parse language and optional title from opening fence
 * Supports: ```javascript title="My Code"
 */
function parseFenceMetadata(firstLine: string): {
  language: string;
  title: string | null;
} {
  const match = firstLine.match(/^```(\w+)?(?:\s+title="([^"]*)")?/);
  return {
    language: match?.[1] || "",
    title: match?.[2] || null,
  };
}

class CodeBlockWidget extends WidgetType {
  private readonly code: string;
  private readonly language: string;
  private readonly title: string | null;
  private readonly showLineNumbers: boolean;
  private readonly onEdit: () => void;

  constructor(
    code: string,
    language: string,
    title: string | null,
    showLineNumbers: boolean,
    onEdit: () => void,
  ) {
    super();
    this.code = code;
    this.language = language;
    this.title = title;
    this.showLineNumbers = showLineNumbers;
    this.onEdit = onEdit;
  }

  eq(other: CodeBlockWidget) {
    return (
      other.code === this.code &&
      other.language === this.language &&
      other.title === this.title &&
      other.showLineNumbers === this.showLineNumbers
    );
  }

  toDOM() {
    const container = document.createElement("div");
    container.className = "cm-code-block-widget";
    container.style.cssText = `
      position: relative;
      margin: 8px 0;
      background: rgba(128, 128, 128, 0.08);
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid rgba(128, 128, 128, 0.15);
    `;

    // Top bar with language/title and buttons
    const topBar = document.createElement("div");
    topBar.className = "cm-code-block-topbar";
    topBar.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 12px;
      background: rgba(128, 128, 128, 0.06);
      border-bottom: 1px solid rgba(128, 128, 128, 0.1);
      font-size: 12px;
      font-weight: 500;
      min-height: 32px;
    `;

    // Language/title label
    const label = document.createElement("div");
    label.style.cssText = `
      opacity: 0.7;
      flex: 1;
    `;
    if (this.title) {
      label.textContent = this.title;
      if (this.language) {
        label.textContent += ` (${this.language})`;
      }
    } else if (this.language) {
      label.textContent = this.language;
    } else {
      label.textContent = "Code";
    }
    topBar.appendChild(label);

    // Button container
    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = `
      display: flex;
      gap: 4px;
      align-items: center;
    `;

    // Copy button (always visible)
    const copyButton = document.createElement("button");
    copyButton.className = "cm-code-block-btn";
    copyButton.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    `;
    copyButton.style.cssText = `
      background: transparent;
      border: none;
      color: var(--color-text-secondary, rgba(255, 255, 255, 0.6));
      cursor: pointer;
      padding: 4px 6px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      opacity: 0.7;
    `;
    copyButton.title = "Copy code";
    copyButton.addEventListener("click", (e) => {
      e.stopPropagation();
      void navigator.clipboard.writeText(this.code);
      copyButton.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;
      setTimeout(() => {
        copyButton.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        `;
      }, 1500);
    });
    copyButton.addEventListener("mouseenter", () => {
      copyButton.style.opacity = "1";
      copyButton.style.background = "rgba(128, 128, 128, 0.15)";
    });
    copyButton.addEventListener("mouseleave", () => {
      copyButton.style.opacity = "0.7";
      copyButton.style.background = "transparent";
    });

    // Edit button (hidden by default, shown on hover)
    const editButton = document.createElement("button");
    editButton.className = "cm-code-block-btn cm-code-block-edit-btn";
    editButton.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    `;
    editButton.style.cssText = `
      background: transparent;
      border: none;
      color: var(--color-text-secondary, rgba(255, 255, 255, 0.6));
      cursor: pointer;
      padding: 4px 6px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      opacity: 0;
      pointer-events: none;
    `;
    editButton.title = "Edit code block";
    editButton.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onEdit();
    });
    editButton.addEventListener("mouseenter", () => {
      editButton.style.background = "rgba(128, 128, 128, 0.15)";
    });
    editButton.addEventListener("mouseleave", () => {
      editButton.style.background = "transparent";
    });

    buttonContainer.appendChild(copyButton);
    buttonContainer.appendChild(editButton);
    topBar.appendChild(buttonContainer);
    container.appendChild(topBar);

    // Show edit button on container hover
    container.addEventListener("mouseenter", () => {
      editButton.style.opacity = "1";
      editButton.style.pointerEvents = "auto";
    });
    container.addEventListener("mouseleave", () => {
      editButton.style.opacity = "0";
      editButton.style.pointerEvents = "none";
    });

    // Code content container
    const codeContainer = document.createElement("div");
    codeContainer.className = "cm-code-block-content";
    codeContainer.style.cssText = `
      display: flex;
      padding: 12px 0;
    `;

    const lines = this.code.split("\n");

    // Line numbers (if enabled)
    if (this.showLineNumbers) {
      const lineNumbers = document.createElement("div");
      lineNumbers.className = "cm-code-block-line-numbers";
      lineNumbers.style.cssText = `
        padding: 0 12px 0 16px;
        text-align: right;
        user-select: none;
        opacity: 0.4;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
        font-size: 13px;
        line-height: 1.6;
        min-width: 40px;
      `;

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
    codeContent.style.cssText = `
      margin: 0;
      padding: ${this.showLineNumbers ? "0 16px 0 0" : "0 16px"};
      flex: 1;
      overflow: auto;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
      font-size: 13px;
      line-height: 1.6;
    `;

    const codeElement = document.createElement("code");
    codeElement.textContent = this.code;
    codeContent.appendChild(codeElement);

    codeContainer.appendChild(codeContent);
    container.appendChild(codeContainer);

    return container;
  }

  ignoreEvent(event: Event): boolean {
    // Allow button clicks to work
    const target = event.target as HTMLElement;
    if (target.closest(".cm-code-block-btn")) {
      return false;
    }
    // Make the rest of the code block read-only
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

    // If cursor is in the code block, show edit mode (allow editing)
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

    // Not in code block: render as interactive widget
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

    // Parse language and title from first line
    const { language, title } = parseFenceMetadata(firstLine);

    // Extract code content (everything between first and last line)
    const codeLines = lines.slice(1, -1);
    const code = codeLines.join("\n");

    // Get setting for line numbers
    const showLineNumbers =
      useOutlinerSettingsStore.getState().showCodeBlockLineNumbers;

    // Create edit handler that will focus the editor at the code block position
    const onEdit = () => {
      const view = (context as { view?: EditorView }).view;
      if (view) {
        // Focus the editor and place cursor at the start of code content (after opening fence)
        const firstLineEnd = node.from + firstLine.length + 1;
        view.focus();
        view.dispatch({
          selection: { anchor: firstLineEnd },
          scrollIntoView: true,
        });
      }
    };

    // Hide the entire code block content
    decorations.push(createHiddenMarker(node.from, node.to, false));

    // Insert widget at the code block position
    decorations.push({
      from: node.from,
      to: node.to,
      decoration: Decoration.widget({
        widget: new CodeBlockWidget(
          code,
          language,
          title,
          showLineNumbers,
          onEdit,
        ),
        side: 0,
        block: true,
      }),
    });

    return decorations;
  }
}
