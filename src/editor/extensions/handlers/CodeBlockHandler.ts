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
    container.setAttribute("contenteditable", "false");
    container.style.userSelect = "none";
    container.style.pointerEvents = "auto";

    // Prevent mousedown from propagating to editor (except for buttons)
    container.addEventListener(
      "mousedown",
      (e) => {
        const target = e.target as HTMLElement;
        const isButton =
          target.tagName === "BUTTON" || target.closest("button");

        if (!isButton) {
          e.stopImmediatePropagation();
          e.preventDefault();
        }
      },
      true
    );

    // Prevent click from propagating to editor (except for buttons)
    container.addEventListener(
      "click",
      (e) => {
        const target = e.target as HTMLElement;
        const isButton =
          target.tagName === "BUTTON" || target.closest("button");

        if (!isButton) {
          e.stopImmediatePropagation();
          e.preventDefault();
        }
      },
      true
    );

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
          })
        )
      )
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
    const isButton = target.tagName === "BUTTON" || target.closest("button");
    // Only allow events from buttons (Edit, Copy)
    // All other clicks should be ignored to prevent entering edit mode
    if (isButton) {
      return false;
    }
    // Ignore all other events (including clicks on the widget itself)
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

    if (context.isEditMode) {
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

    if (beforeCodeBlock.length > 0 || afterCodeBlock.length > 0) {
      return decorations;
    }

    const languageMatch = firstLine.match(/^```(\w+)?/);
    const language = languageMatch?.[1] || "";

    const codeLines = lines.slice(1, -1);
    const code = codeLines.join("\n");

    // NEW APPROACH: Use an inline widget at the start position
    // The widget will be displayed, and original text will be hidden via mark decorations
    decorations.push({
      from: node.from,
      to: node.from,
      decoration: Decoration.widget({
        widget: new CodeBlockWidget(code, language),
        side: 0,
      }),
    });

    // Hide the entire code block content (all lines from node.from to node.to)
    // using a mark decoration with display: none
    decorations.push({
      from: node.from,
      to: node.to,
      decoration: Decoration.mark({
        class: "cm-code-block-hidden",
        attributes: {
          style: "display: none !important;",
        },
      }),
    });

    return decorations;
  }
}
