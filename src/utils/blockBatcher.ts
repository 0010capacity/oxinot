import { invoke } from "@tauri-apps/api/core";
import type { BlockData } from "../stores/blockStore";
import { useWorkspaceStore } from "../stores/workspaceStore";

interface BlockBatcherOptions {
  timeoutMs?: number;
}

class BlockBatcher {
  private queue: string[] = [];
  private pendingResolvers: Map<
    string,
    Array<(block: BlockData | null) => void>
  > = new Map();
  private cache: Map<string, BlockData> = new Map();
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private timeoutMs: number;

  constructor(options: BlockBatcherOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 20; // 20ms debounce
  }

  public fetchBlock(blockId: string): Promise<BlockData | null> {
    // 1. Check cache
    const cached = this.cache.get(blockId);
    if (cached) {
      return Promise.resolve(cached);
    }

    // 2. Queue request
    let resolvers = this.pendingResolvers.get(blockId);
    if (!resolvers) {
      this.queue.push(blockId);
      resolvers = [];
      this.pendingResolvers.set(blockId, resolvers);
    }

    return new Promise((resolve) => {
      resolvers?.push(resolve);
      this.scheduleFlush();
    });
  }

  private scheduleFlush() {
    if (this.timeoutId) return;

    this.timeoutId = setTimeout(() => {
      this.flush();
      this.timeoutId = null;
    }, this.timeoutMs);
  }

  private async flush() {
    const idsToFetch = [...this.queue];
    this.queue = [];

    if (idsToFetch.length === 0) return;

    try {
      const workspacePath = useWorkspaceStore.getState().workspacePath;
      if (!workspacePath) {
        // If no workspace, we can't fetch. Resolve all with null.
        throw new Error("No workspace selected");
      }

      // Backend 'get_blocks' returns Vec<Block> (BlockData[])
      const blocks = await invoke<BlockData[]>("get_blocks", {
        workspacePath,
        request: { block_ids: idsToFetch },
      });

      // Populate cache and resolve
      const blocksMap = new Map(blocks.map((b) => [b.id, b]));

      for (const id of idsToFetch) {
        const resolvers = this.pendingResolvers.get(id);
        const block = blocksMap.get(id) ?? null;

        if (block) {
          this.cache.set(id, block);
        }

        if (resolvers) {
          for (const resolve of resolvers) {
            resolve(block);
          }
        }

        this.pendingResolvers.delete(id);
      }
    } catch (error) {
      console.warn("[BlockBatcher] Failed to batch fetch blocks", error);
      // Reject all pending for this batch with null (graceful degradation)
      for (const id of idsToFetch) {
        const resolvers = this.pendingResolvers.get(id);
        if (resolvers) {
          for (const resolve of resolvers) {
            resolve(null);
          }
        }
        this.pendingResolvers.delete(id);
      }
    }
  }

  public clearCache() {
    this.cache.clear();
  }

  public invalidate(blockId: string) {
    this.cache.delete(blockId);
  }
}

export const blockBatcher = new BlockBatcher();
