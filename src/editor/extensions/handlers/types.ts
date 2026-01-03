/**
 * Handler system types and interfaces
 *
 * This module defines the core abstractions for the handler-based decoration system.
 * Each markdown element type (heading, emphasis, code block, etc.) is handled by a
 * dedicated handler that implements the DecorationHandler interface.
 */

import { EditorState } from "@codemirror/state";
import { SyntaxNode } from "@lezer/common";
import { DecorationSpec } from "../utils/decorationHelpers";
import { CursorInfo } from "../utils/nodeHelpers";

/**
 * Context provided to handlers for rendering decisions
 */
export interface RenderContext {
  /** The editor state */
  state: EditorState;

  /** Information about the current cursor position */
  cursor: CursorInfo;

  /** Array to collect decoration specs */
  decorations: DecorationSpec[];
}

/**
 * Handler for a specific markdown element type
 *
 * Each handler is responsible for:
 * 1. Determining if it can handle a given syntax node
 * 2. Creating appropriate decorations for that node
 * 3. Handling cursor-based visibility (showing/hiding markers)
 */
export interface DecorationHandler {
  /**
   * The name of this handler (for debugging)
   */
  readonly name: string;

  /**
   * Check if this handler can process the given node
   *
   * @param node - The syntax tree node to check
   * @returns true if this handler should process the node
   */
  canHandle(node: SyntaxNode): boolean;

  /**
   * Process a node and return decoration specs
   *
   * @param node - The syntax tree node to process
   * @param context - The rendering context
   * @returns Array of decoration specs to apply
   */
  handle(node: SyntaxNode, context: RenderContext): DecorationSpec[];
}

/**
 * Abstract base class for decoration handlers
 *
 * Provides common functionality and ensures consistent implementation
 */
export abstract class BaseHandler implements DecorationHandler {
  constructor(public readonly name: string) {}

  abstract canHandle(node: SyntaxNode): boolean;
  abstract handle(node: SyntaxNode, context: RenderContext): DecorationSpec[];

  /**
   * Helper to check if node is on cursor line
   */
  protected isOnCursorLine(node: SyntaxNode, context: RenderContext): boolean {
    const nodeLine = context.state.doc.lineAt(node.from);
    return (
      nodeLine.from >= context.cursor.lineFrom &&
      nodeLine.to <= context.cursor.lineTo
    );
  }

  /**
   * Helper to get node text
   */
  protected getNodeText(node: SyntaxNode, context: RenderContext): string {
    return context.state.doc.sliceString(node.from, node.to);
  }

  /**
   * Helper to get line at node position
   */
  protected getNodeLine(node: SyntaxNode, context: RenderContext) {
    return context.state.doc.lineAt(node.from);
  }
}
