import type { EditorState } from "@codemirror/state";

/**
 * Cache for CodeMirror EditorState instances per block.
 * Preserves undo/redo history when switching between blocks.
 */
class EditorStateCache {
  private cache: Map<string, EditorState> = new Map();

  /**
   * Store an editor state for a block
   */
  set(blockId: string, state: EditorState): void {
    this.cache.set(blockId, state);
  }

  /**
   * Retrieve a cached editor state for a block
   */
  get(blockId: string): EditorState | undefined {
    return this.cache.get(blockId);
  }

  /**
   * Check if we have a cached state for a block
   */
  has(blockId: string): boolean {
    return this.cache.has(blockId);
  }

  /**
   * Clear the cache for a block
   */
  clear(blockId: string): void {
    this.cache.delete(blockId);
  }

  /**
   * Clear the entire cache
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * Get cache size (for debugging)
   */
  size(): number {
    return this.cache.size;
  }
}

export const editorStateCache = new EditorStateCache();
