/**
 * Code Block handler for widget-based rendering
 *
 * Handles fenced code blocks (```lang ... ```)
 * - Hides the entire block when cursor is NOT on it
 * - Renders as a React widget with copy/edit buttons
 * - Shows raw text when cursor is present (edit mode)
 * - Only renders when code block is alone in the block (no other text)
 */

import { Decoration, type EditorView, WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { MantineProvider } from "@mantine/core";
import React from "react";
import { type Root, createRoot } from "react-dom/client";
import { CodeBlockCard } from "../../../components/CodeBlockCard";
import { ThemeProvider } from "../../../theme/ThemeProvider";
import type { DecorationSpec } from "../utils/decorationHelpers";
import { createHiddenMarker } from "../utils/decorationHelpers";
import { BaseHandler, type RenderContext } from "./types";

class CodeBlockWidget extends WidgetType {
  private readonly code: string;
  private readonly language: string;
  private root: Root | null = null;

  constructor(code: string, language: string) {
    super();
    this.code = code;
    this.language = language;
  }

  eq(other: CodeBlockWidget) {
    return other.code === this.code && other.language === this.language;
  }

  toDOM(view: EditorView) {
    const container = document.createElement("div");
    container.className = "cm-code-block-widget";

    this.root = createRoot(container);
    this.root.render(
      React.createElement(
        MantineProvider,
        { defaultColorScheme: "dark" },
        React.createElement(
          ThemeProvider,
          null,
          React.createElement(CodeBlockCard, {
            code: this.code,
            language: this.language,
            onEdit: () => {
              const pos = view.posAtDOM(container);
              if (pos !== null) {
                view.focus();
                view.dispatch({
                  selection: { anchor: pos },
                });
              }
            },
          }),
        ),
      ),
    );

    return container;
  }

  destroy() {
    if (this.root) {
      const rootToUnmount = this.root;
      this.root = null;
      setTimeout(() => {
        rootToUnmount.unmount();
      }, 0);
    }
  }

  ignoreEvent(event: Event) {
    const target = event.target as HTMLElement;
    if (target.tagName === "BUTTON" || target.closest("button")) {
      return false;
    }
    return true;
  }
}

export class CodeBlockHandler extends BaseHandler {
  constructor() {
    super("CodeBlockHandler");
  }

  canHandle(node: SyntaxNode): boolean {
    const result = node.type.name === "FencedCode";
    if (result) {
      console.log("[CodeBlockHandler] canHandle TRUE for node:", {
        nodeName: node.type.name,
        from: node.from,
        to: node.to,
      });
    }
    return result;
  }

  handle(node: SyntaxNode, context: RenderContext): DecorationSpec[] {
    console.log("[CodeBlockHandler] handle called", {
      nodeFrom: node.from,
      nodeTo: node.to,
      isEditMode: context.isEditMode,
      cursorPos: context.cursor.pos,
    });

    const decorations: DecorationSpec[] = [];
    const content = this.getNodeText(node, context);
    const lines = content.split("\n");

    console.log("[CodeBlockHandler] content lines:", lines.length);

    if (lines.length < 2) {
      console.log("[CodeBlockHandler] Early return: lines < 2");
      return decorations;
    }

    const cursorPos = context.cursor.pos;
    const isInCodeBlock = cursorPos >= node.from && cursorPos <= node.to;

    console.log("[CodeBlockHandler] Cursor check:", {
      isEditMode: context.isEditMode,
      isInCodeBlock,
      willShowWidget: !isInCodeBlock,
    });

    if (isInCodeBlock) {
      console.log("[CodeBlockHandler] Early return: cursor in block");
      return decorations;
    }

    const firstLine = lines[0] || "";
    const lastLine = lines[lines.length - 1] || "";

    const hasClosingFence = lastLine.trim().startsWith("```");
    if (!hasClosingFence) {
      return decorations;
    }

    const { state } = context;
    const doc = state.doc;

    const startLineObj = doc.lineAt(node.from);
    const endLineObj = doc.lineAt(node.to);

    const beforeCodeBlock = startLineObj.text
      .substring(0, node.from - startLineObj.from)
      .trim();
    const afterCodeBlock = endLineObj.text
      .substring(node.to - endLineObj.from)
      .trim();

    console.log("[CodeBlockHandler] Debug:", {
      nodeFrom: node.from,
      nodeTo: node.to,
      startLineFrom: startLineObj.from,
      endLineFrom: endLineObj.from,
      startLineText: startLineObj.text,
      endLineText: endLineObj.text,
      beforeCodeBlock,
      afterCodeBlock,
      willRender: beforeCodeBlock.length === 0 && afterCodeBlock.length === 0,
    });

    if (beforeCodeBlock.length > 0 || afterCodeBlock.length > 0) {
      return decorations;
    }

    const languageMatch = firstLine.match(/^```(\w+)?/);
    const language = languageMatch?.[1] || "";

    const codeLines = lines.slice(1, -1);
    const code = codeLines.join("\n");

    decorations.push(createHiddenMarker(node.from, node.to, false));

    decorations.push({
      from: node.from,
      to: node.to,
      decoration: Decoration.widget({
        widget: new CodeBlockWidget(code, language),
        side: 0,
        block: true,
      }),
    });

    return decorations;
  }
}
