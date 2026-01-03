/**
 * Handler Registry
 *
 * Central registry for all decoration handlers. Manages handler registration
 * and dispatches syntax nodes to appropriate handlers.
 */

import { SyntaxNode } from "@lezer/common";
import { DecorationHandler, RenderContext } from "./types";
import { DecorationSpec } from "../utils/decorationHelpers";

/**
 * Registry for managing decoration handlers
 */
export class HandlerRegistry {
  private handlers: DecorationHandler[] = [];

  /**
   * Register a handler
   */
  register(handler: DecorationHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Register multiple handlers at once
   */
  registerAll(handlers: DecorationHandler[]): void {
    this.handlers.push(...handlers);
  }

  /**
   * Handle a node by finding the first matching handler
   *
   * @param node - The syntax node to handle
   * @param context - The rendering context
   * @returns Array of decoration specs
   */
  handleNode(node: SyntaxNode, context: RenderContext): DecorationSpec[] {
    for (const handler of this.handlers) {
      if (handler.canHandle(node)) {
        try {
          return handler.handle(node, context);
        } catch (error) {
          console.error(`Error in handler ${handler.name}:`, error);
          return [];
        }
      }
    }
    return [];
  }

  /**
   * Get all registered handlers
   */
  getHandlers(): ReadonlyArray<DecorationHandler> {
    return this.handlers;
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers = [];
  }

  /**
   * Get the number of registered handlers
   */
  get count(): number {
    return this.handlers.length;
  }
}

/**
 * Create and configure the default handler registry
 */
export function createDefaultRegistry(): HandlerRegistry {
  const registry = new HandlerRegistry();

  // Import handlers lazily to avoid circular dependencies
  // Handlers will be registered in the main hybridRendering module

  return registry;
}

/**
 * Singleton instance of the handler registry
 */
let globalRegistry: HandlerRegistry | null = null;

/**
 * Get the global handler registry (singleton)
 */
export function getHandlerRegistry(): HandlerRegistry {
  if (!globalRegistry) {
    globalRegistry = createDefaultRegistry();
  }
  return globalRegistry;
}

/**
 * Reset the global registry (useful for testing)
 */
export function resetHandlerRegistry(): void {
  globalRegistry = null;
}
