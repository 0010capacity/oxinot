import type { EditorState } from "@codemirror/state";

/**
 * Cache for CodeMirror EditorState instances per block.
 * Preserves undo/redo history when switching between blocks.
 * Uses LRU (Least Recently Used) eviction to prevent memory bloat.
 */
class EditorStateCache {
  private cache: Map<string, EditorState> = new Map();
  private accessOrder: string[] = [];
  private readonly MAX_ENTRIES = 50;

  /**
   * Store an editor state for a block
   */
  set(blockId: string, state: EditorState): void {
    // Remove from access order if already exists
    if (this.cache.has(blockId)) {
      const index = this.accessOrder.indexOf(blockId);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    }

    // Add to cache and access order
    this.cache.set(blockId, state);
    this.accessOrder.push(blockId);

    // Evict oldest if over limit
    while (this.accessOrder.length > this.MAX_ENTRIES) {
      const oldestId = this.accessOrder.shift();
      if (oldestId) {
        this.cache.delete(oldestId);
      }
    }
  }

  /**
   * Retrieve a cached editor state for a block
   */
  get(blockId: string): EditorState | undefined {
    if (!this.cache.has(blockId)) {
      return undefined;
    }

    // Update access order (move to end = most recently used)
    const index = this.accessOrder.indexOf(blockId);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
      this.accessOrder.push(blockId);
    }

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
    const index = this.accessOrder.indexOf(blockId);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Clear the entire cache
   */
  clearAll(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache size (for debugging)
   */
  size(): number {
    return this.cache.size;
  }
}

export const editorStateCache = new EditorStateCache();
