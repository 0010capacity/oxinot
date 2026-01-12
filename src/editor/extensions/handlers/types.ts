/**
 * Handler system types and interfaces
 *
 * This module defines the core abstractions for the handler-based decoration system.
 * Each markdown element type (heading, emphasis, code block, etc.) is handled by a
 * dedicated handler that implements the DecorationHandler interface.
 */

import type { EditorState } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import type { DecorationSpec } from "../utils/decorationHelpers";
import type { CursorInfo } from "../utils/nodeHelpers";

/**
 * Context provided to handlers for rendering decisions
 */
export interface RenderContext {
  /** The editor state */
  state: EditorState;

  /** Information about the current cursor position */
  cursor: CursorInfo;

  /** Whether the editor currently has focus */
  editorHasFocus: boolean;

  /**
   * Whether the block is in edit mode (has focus)
   * - true: edit mode - show markers dimmed (block has focus, user is editing)
   * - false: preview mode - hide markers completely (block unfocused, show rendered)
   */
  isEditMode: boolean;

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
   * @deprecated Use context.isEditMode instead for consistent behavior
   */
  protected isOnCursorLine(_node: SyntaxNode, context: RenderContext): boolean {
    return context.isEditMode;
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
