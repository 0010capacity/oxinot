import { invoke } from "@tauri-apps/api/core";
import { temporal } from "zundo";
import { immer } from "zustand/middleware/immer";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn as create } from "zustand/traditional";
import {
  getInsertBelowTarget,
  normalizeBlocks,
  updateChildrenMap,
} from "./blockGraphHelpers";
import { useBlockUIStore } from "./blockUIStore";
import { useWorkspaceStore } from "./workspaceStore";

// ============ Caching ============

interface CachedPageData {
  rootBlocks: BlockData[];
  childrenByParent: Record<string, BlockData[]>;
  metadata: Record<string, Record<string, string>>;
  timestamp: number;
  loadTime?: number; // Time to load this page in ms
  accessCount: number;
  lastAccess: number;
}

export interface CacheStatistics {
  size: number;
  capacity: number;
  hits: number;
  misses: number;
  hitRate: number; // percentage
  evictions: number;
  ttlExpirations: number;
  invalidations: number;
  avgLoadTime: number;
  totalMemoryBytes: number;
  oldestPageAge: number; // ms
  newestPageAge: number; // ms
}

class PageCache {
  private cache = new Map<string, CachedPageData>();
  private readonly MAX_ENTRIES = 50;
  private readonly TTL_MS = 30 * 60 * 1000;
  private readonly MIN_TTL_MS = 5 * 60 * 1000;
  private readonly MAX_TTL_MS = 2 * 60 * 60 * 1000;
  private storageKey = "page-cache-v1";
  private warmed = false;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  // Statistics tracking
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private ttlExpirations = 0;
  private invalidations = 0;
  private loadTimes: number[] = [];

  set(pageId: string, data: CachedPageData): void {
    // Track load time if available
    if (data.loadTime !== undefined) {
      this.loadTimes.push(data.loadTime);
      // Keep only last 100 load times for average calculation
      if (this.loadTimes.length > 100) {
        this.loadTimes.shift();
      }
    }

    if (this.cache.size >= this.MAX_ENTRIES) {
      const oldest = Array.from(this.cache.entries()).sort(
        ([, a], [, b]) => a.timestamp - b.timestamp
      )[0];
      if (oldest) {
        this.cache.delete(oldest[0]);
        this.evictions++;
        console.log(
          `[blockStore cache] Evicted oldest page: ${oldest[0]}. Cache size: ${this.cache.size}/${this.MAX_ENTRIES}`
        );
      }
    }
    const now = Date.now();
    const existing = this.cache.get(pageId);
    const accessCount = existing ? existing.accessCount : 0;
    this.cache.set(pageId, {
      ...data,
      accessCount,
      lastAccess: now,
    });
    this.scheduleSave();
    console.log(
      `[blockStore cache] Cached page ${pageId}. Cache size: ${this.cache.size}/${this.MAX_ENTRIES}`
    );
  }

  get(pageId: string): CachedPageData | undefined {
    const data = this.cache.get(pageId);
    if (!data) {
      this.misses++;
      return undefined;
    }

    const now = Date.now();
    const age = now - data.timestamp;
    const ttlMs = this.getAdaptiveTtl(data);
    if (age > ttlMs) {
      this.cache.delete(pageId);
      this.ttlExpirations++;
      console.log(
        `[blockStore cache] TTL expired for page ${pageId} (age: ${(
          age / 1000
        ).toFixed(1)}s, ttl: ${(ttlMs / 1000).toFixed(1)}s)`
      );
      return undefined;
    }

    this.hits++;
    data.accessCount += 1;
    data.lastAccess = now;
    this.scheduleSave();
    console.log(
      `[blockStore cache] Cache hit for page ${pageId}. Hit rate: ${this.getHitRate().toFixed(
        1
      )}%`
    );
    return data;
  }

  private getAdaptiveTtl(data: CachedPageData): number {
    const scaled = this.TTL_MS * (1 + Math.log2(1 + data.accessCount) * 0.5);
    if (scaled < this.MIN_TTL_MS) return this.MIN_TTL_MS;
    if (scaled > this.MAX_TTL_MS) return this.MAX_TTL_MS;
    return scaled;
  }

  invalidate(pageId: string): void {
    if (this.cache.has(pageId)) {
      this.cache.delete(pageId);
      this.invalidations++;
      this.scheduleSave();
      console.log(`[blockStore cache] Invalidated page ${pageId}`);
    }
  }

  invalidateAll(): void {
    const previousSize = this.cache.size;
    this.cache.clear();
    if (previousSize > 0) {
      this.invalidations += previousSize;
      this.scheduleSave();
      console.log(
        `[blockStore cache] Invalidated all ${previousSize} cached pages`
      );
    }
  }

  private scheduleSave(): void {
    if (!this.getStorage()) return;
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      void this.saveToStorage();
    }, 1000);
  }

  async warmFromStorage(storageKey: string): Promise<void> {
    if (!storageKey || this.warmed) return;
    this.storageKey = storageKey;
    this.cache.clear();
    await this.loadFromStorage();
    this.warmed = true;
  }

  private getStorage(): Storage | null {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  private encodeBase64(data: Uint8Array): string {
    let binary = "";
    for (const byte of data) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }

  private decodeBase64(data: string): Uint8Array {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private async compressString(
    data: string
  ): Promise<{ compressed: boolean; data: string }> {
    if (
      typeof CompressionStream === "undefined" ||
      typeof TextEncoder === "undefined"
    ) {
      return { compressed: false, data };
    }

    try {
      const encoder = new TextEncoder();
      const input = encoder.encode(data);
      const stream = new Blob([new Uint8Array(input)])
        .stream()
        .pipeThrough(new CompressionStream("gzip"));
      const buffer = await new Response(stream).arrayBuffer();
      return {
        compressed: true,
        data: this.encodeBase64(new Uint8Array(buffer)),
      };
    } catch (error) {
      console.error("[blockStore cache] Failed to compress cache:", error);
      return { compressed: false, data };
    }
  }

  private async decompressString(
    data: string,
    compressed: boolean
  ): Promise<string> {
    if (!compressed) return data;
    if (
      typeof DecompressionStream === "undefined" ||
      typeof TextDecoder === "undefined"
    ) {
      return data;
    }

    try {
      const bytes = this.decodeBase64(data);
      const stream = new Blob([new Uint8Array(bytes)])
        .stream()
        .pipeThrough(new DecompressionStream("gzip"));
      const buffer = await new Response(stream).arrayBuffer();
      return new TextDecoder().decode(buffer);
    } catch (error) {
      console.error("[blockStore cache] Failed to decompress cache:", error);
      return data;
    }
  }

  private async loadFromStorage(): Promise<void> {
    const storage = this.getStorage();
    if (!storage) return;

    try {
      const raw = storage.getItem(this.storageKey);
      if (!raw) return;
      const envelope: unknown = JSON.parse(raw);
      if (!this.isRecord(envelope)) return;
      const compressed = envelope.compressed === true;
      const data = envelope.data;
      if (typeof data !== "string") return;

      const payloadText = await this.decompressString(data, compressed);
      const payload: unknown = JSON.parse(payloadText);
      if (!this.isRecord(payload)) return;

      const entries = payload.entries;
      if (!Array.isArray(entries)) return;

      const now = Date.now();
      for (const item of entries) {
        if (!this.isRecord(item)) continue;
        const pageId = item.pageId;
        const dataEntry = item.data;
        if (typeof pageId !== "string") continue;
        if (!this.isRecord(dataEntry)) continue;
        const timestamp = dataEntry.timestamp;
        if (typeof timestamp !== "number") continue;

        const cached: CachedPageData = {
          rootBlocks: Array.isArray(dataEntry.rootBlocks)
            ? (dataEntry.rootBlocks as BlockData[])
            : [],
          childrenByParent: this.isRecord(dataEntry.childrenByParent)
            ? (dataEntry.childrenByParent as Record<string, BlockData[]>)
            : {},
          metadata: this.isRecord(dataEntry.metadata)
            ? (dataEntry.metadata as Record<string, Record<string, string>>)
            : {},
          timestamp,
          loadTime:
            typeof dataEntry.loadTime === "number"
              ? dataEntry.loadTime
              : undefined,
          accessCount:
            typeof dataEntry.accessCount === "number"
              ? dataEntry.accessCount
              : 0,
          lastAccess:
            typeof dataEntry.lastAccess === "number"
              ? dataEntry.lastAccess
              : timestamp,
        };

        const age = now - cached.timestamp;
        if (age > this.getAdaptiveTtl(cached)) {
          continue;
        }

        this.cache.set(pageId, cached);
      }
    } catch (error) {
      console.error(
        "[blockStore cache] Failed to load cache from storage:",
        error
      );
      storage.removeItem(this.storageKey);
    }
  }

  private async saveToStorage(): Promise<void> {
    const storage = this.getStorage();
    if (!storage) return;

    const now = Date.now();
    const entries: Array<{ pageId: string; data: CachedPageData }> = [];
    for (const [pageId, data] of this.cache.entries()) {
      const age = now - data.timestamp;
      if (age > this.getAdaptiveTtl(data)) continue;
      entries.push({ pageId, data });
    }

    try {
      const payload = JSON.stringify({
        version: 1,
        savedAt: now,
        entries,
      });
      const compressed = await this.compressString(payload);
      storage.setItem(
        this.storageKey,
        JSON.stringify({
          version: 1,
          savedAt: now,
          compressed: compressed.compressed,
          data: compressed.data,
        })
      );
    } catch (error) {
      console.error(
        "[blockStore cache] Failed to save cache to storage:",
        error
      );
    }
  }

  async setStorageKey(storageKey: string): Promise<void> {
    if (!storageKey || this.storageKey === storageKey) return;
    await this.warmFromStorage(storageKey);
  }

  private getHitRate(): number {
    const total = this.hits + this.misses;
    if (total === 0) return 0;
    return (this.hits / total) * 100;
  }

  private getEstimatedMemory(): number {
    let totalBytes = 0;
    for (const data of this.cache.values()) {
      // Rough estimation: JSON.stringify size
      totalBytes += JSON.stringify(data).length;
    }
    return totalBytes;
  }

  stats(): CacheStatistics {
    const now = Date.now();
    const pages = Array.from(this.cache.values());
    const ages = pages.map((p) => now - p.timestamp);

    return {
      size: this.cache.size,
      capacity: this.MAX_ENTRIES,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.getHitRate(),
      evictions: this.evictions,
      ttlExpirations: this.ttlExpirations,
      invalidations: this.invalidations,
      avgLoadTime:
        this.loadTimes.length > 0
          ? this.loadTimes.reduce((a, b) => a + b, 0) / this.loadTimes.length
          : 0,
      totalMemoryBytes: this.getEstimatedMemory(),
      oldestPageAge: ages.length > 0 ? Math.max(...ages) : 0,
      newestPageAge: ages.length > 0 ? Math.min(...ages) : 0,
    };
  }

  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.ttlExpirations = 0;
    this.invalidations = 0;
    this.loadTimes = [];
    console.log("[blockStore cache] Statistics reset");
  }

  /**
   * Get a detailed report of cache statistics
   */
  getReport(): string {
    const s = this.stats();
    return `
=== Cache Statistics Report ===
Size: ${s.size}/${s.capacity} entries (${((s.size / s.capacity) * 100).toFixed(
      1
    )}% full)
Hit Rate: ${s.hits} hits / ${s.misses} misses = ${s.hitRate.toFixed(1)}%
Evictions: ${s.evictions}
TTL Expirations: ${s.ttlExpirations}
Invalidations: ${s.invalidations}
Avg Load Time: ${s.avgLoadTime.toFixed(2)}ms
Memory Usage: ${(s.totalMemoryBytes / 1024).toFixed(2)}KB
Oldest Entry: ${(s.oldestPageAge / 1000).toFixed(1)}s ago
Newest Entry: ${(s.newestPageAge / 1000).toFixed(1)}s ago
==============================
    `.trim();
  }
}

const pageCache = new PageCache();

// ============ Types ============

export interface BlockData {
  id: string;
  pageId: string;
  parentId: string | null;
  content: string;
  orderWeight: number;
  isCollapsed: boolean;
  blockType: "bullet" | "code" | "fence";
  language?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, string>;
}

export type BlockStatus = "synced" | "optimistic" | "syncing" | "error";

interface BlockState {
  // 정규화된 데이터
  blocksById: Record<string, BlockData>;
  childrenMap: Record<string, string[]>;
  blockStatus: Record<string, BlockStatus>;

  // 현재 상태
  currentPageId: string | null;
  isLoading: boolean;
  error: string | null;

  // tempId 추적 및 pending updates 큐
  tempIdMap: Record<string, string>; // tempId -> realId 매핑
  pendingUpdates: Array<{
    tempId: string;
    content: string;
  }>;
}

interface BlockActions {
  // 페이지 로드
  loadPage: (pageId: string) => Promise<void>;
  clearPage: () => void;
  updatePartialBlocks: (
    blocks: BlockData[],
    deletedBlockIds?: string[],
    skipCacheInvalidation?: boolean
  ) => void;

  // 블록 CRUD
  createBlock: (
    afterBlockId: string | null,
    content?: string,
    pageId?: string
  ) => Promise<string | undefined>;
  updateBlock: (id: string, updates: Partial<BlockData>) => Promise<void>;
  updateBlockContent: (id: string, content: string) => Promise<void>;
  deleteBlock: (id: string) => Promise<void>;
  splitBlockAtCursor: (
    id: string,
    offset: number,
    draftContent?: string
  ) => Promise<void>;

  // 블록 조작
  indentBlock: (id: string) => Promise<void>;
  outdentBlock: (id: string) => Promise<void>;
  moveBlock: (
    id: string,
    newParentId: string | null,
    afterBlockId: string | null
  ) => Promise<void>;
  mergeWithPrevious: (id: string, draftContent?: string) => Promise<void>;
  toggleCollapse: (id: string) => Promise<void>;

  // 키보드 네비게이션
  getBlock: (id: string) => BlockData | undefined;
  getChildren: (parentId: string | null) => string[];
  getRootBlockIds: () => string[];
  getPreviousVisibleBlock: (id: string) => string | null;
  /**
   * Alias for getPreviousVisibleBlock (deprecated)
   */
  getPreviousBlock: (id: string) => string | null;
  getNextBlock: (id: string) => string | null;

  // Page Lifecycle
  openPage: (pageId: string) => Promise<void>;
}

type BlockStore = BlockState & BlockActions;

// ============ Cache Invalidation Helper ============

function invalidatePageCache(get: () => BlockStore): void {
  const { currentPageId } = get();
  if (currentPageId) {
    pageCache.invalidate(currentPageId);
  }
}

function invalidatePagesByIds(pageIds: Iterable<string>): void {
  for (const pageId of pageIds) {
    pageCache.invalidate(pageId);
  }
}

function invalidatePagesForBlocks(
  get: () => BlockStore,
  blocks: BlockData[],
  deletedBlockIds?: string[]
): void {
  const { blocksById } = get();
  const pageIds = new Set<string>();

  for (const block of blocks) {
    pageIds.add(block.pageId);
  }

  if (deletedBlockIds) {
    for (const blockId of deletedBlockIds) {
      const pageId = blocksById[blockId]?.pageId;
      if (pageId) pageIds.add(pageId);
    }
  }

  if (pageIds.size > 0) {
    invalidatePagesByIds(pageIds);
  } else {
    invalidatePageCache(get);
  }
}

// ============ Store Implementation ============

export const useBlockStore = create<BlockStore>()(
  temporal(
    immer((set, get) => ({
      // Initial State
      blocksById: {},
      childrenMap: {},
      blockStatus: {},
      currentPageId: null,
      isLoading: false,
      error: null,
      tempIdMap: {},
      pendingUpdates: [],

      // ============ Page Operations ============

      openPage: async (pageId: string) => {
        const pageLoadStartTime = performance.now();

        if (get().currentPageId === pageId && get().isLoading) return;

        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          const workspacePath = useWorkspaceStore.getState().workspacePath;
          if (!workspacePath) {
            throw new Error("No workspace selected");
          }

          console.log(`[blockStore:timing] Page load started for ${pageId}`);

          const cached = pageCache.get(pageId);
          if (cached) {
            const cacheStartTime = performance.now();
            console.log(
              `[blockStore] Cache hit: Using cached blocks for page ${pageId}`
            );
            const { blocksById, childrenMap } = normalizeBlocks(
              cached.rootBlocks
            );
            const normalizeTime = performance.now() - cacheStartTime;

            const stateStartTime = performance.now();
            set((state) => {
              state.blocksById = blocksById;
              state.childrenMap = childrenMap;
              state.currentPageId = pageId;
              state.isLoading = false;

              for (const [blockId, metadata] of Object.entries(
                cached.metadata
              )) {
                if (state.blocksById[blockId]) {
                  state.blocksById[blockId].metadata = metadata;
                }
              }
            });
            const stateTime = performance.now() - stateStartTime;
            const totalTime = performance.now() - pageLoadStartTime;

            console.log(
              `[blockStore:timing] Cache hit complete: normalize=${normalizeTime.toFixed(
                2
              )}ms, setState=${stateTime.toFixed(
                2
              )}ms, total=${totalTime.toFixed(2)}ms`
            );
            return;
          }

          const ipcStartTime = performance.now();
          const response = await invoke<{
            rootBlocks: BlockData[];
            childrenByParent: Record<string, BlockData[]>;
            metadata: Record<string, Record<string, string>>;
          }>("get_page_blocks_complete", {
            workspacePath,
            pageId,
          });
          const ipcTime = performance.now() - ipcStartTime;
          console.log(
            `[blockStore:timing] IPC call completed in ${ipcTime.toFixed(2)}ms`
          );

          const normalizeStartTime = performance.now();
          const { blocksById, childrenMap } = normalizeBlocks(
            response.rootBlocks
          );
          const normalizeTime = performance.now() - normalizeStartTime;
          console.log(
            `[blockStore:timing] Normalization completed in ${normalizeTime.toFixed(
              2
            )}ms`
          );

          const isRootEmpty = (childrenMap.root ?? []).length === 0;

          const metadataStartTime = performance.now();
          set((state) => {
            state.blocksById = blocksById;
            state.childrenMap = childrenMap;
            state.currentPageId = pageId;

            for (const [blockId, metadata] of Object.entries(
              response.metadata
            )) {
              if (state.blocksById[blockId]) {
                state.blocksById[blockId].metadata = metadata;
              }
            }

            if (!isRootEmpty) {
              state.isLoading = false;
            }
          });
          const metadataTime = performance.now() - metadataStartTime;
          console.log(
            `[blockStore:timing] State update (with metadata) completed in ${metadataTime.toFixed(
              2
            )}ms`
          );

          pageCache.set(pageId, {
            rootBlocks: response.rootBlocks,
            childrenByParent: response.childrenByParent,
            metadata: response.metadata,
            timestamp: Date.now(),
            accessCount: 0,
            lastAccess: Date.now(),
          });

          if (isRootEmpty) {
            console.log(
              `[blockStore] Creating initial block for page ${pageId}...`
            );
            try {
              await get().createBlock(null, "");
              console.log(
                `[blockStore] Initial block created successfully for page ${pageId}`
              );
            } catch (blockError) {
              console.error(
                `[blockStore] Failed to create initial block for page ${pageId}:`,
                blockError
              );
              throw new Error(
                `Failed to create initial block: ${
                  blockError instanceof Error
                    ? blockError.message
                    : String(blockError)
                }`
              );
            }

            set((state) => {
              state.isLoading = false;
            });
          }

          const totalTime = performance.now() - pageLoadStartTime;
          console.log(
            `[blockStore:timing] === TOTAL PAGE LOAD TIME: ${totalTime.toFixed(
              2
            )}ms (IPC: ${ipcTime.toFixed(
              2
            )}ms, Normalize: ${normalizeTime.toFixed(
              2
            )}ms, Metadata: ${metadataTime.toFixed(2)}ms) ===`
          );
        } catch (error) {
          console.error(
            `[blockStore] Failed to load page ${pageId}:`,
            error,
            "Workspace:",
            useWorkspaceStore.getState().workspacePath
          );
          set((state) => {
            state.error =
              typeof error === "string"
                ? error
                : error instanceof Error
                ? error.message
                : "Failed to load page";
            state.isLoading = false;
          });
        }
      },

      openPageProgressive: async (pageId: string) => {
        if (get().currentPageId === pageId && get().isLoading) return;

        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          const workspacePath = useWorkspaceStore.getState().workspacePath;
          if (!workspacePath) {
            throw new Error("No workspace selected");
          }

          console.log(`[blockStore] Loading root blocks for page ${pageId}...`);
          const startTime = performance.now();
          const rootBlocks: BlockData[] = await invoke("get_page_blocks_root", {
            workspacePath,
            pageId,
          });
          const rootLoadTime = performance.now() - startTime;
          console.log(
            `[blockStore] Loaded ${
              rootBlocks.length
            } root blocks in ${rootLoadTime.toFixed(2)}ms`
          );

          const {
            blocksById: initialBlocksById,
            childrenMap: initialChildrenMap,
          } = normalizeBlocks(rootBlocks);

          const isRootEmpty = (initialChildrenMap.root ?? []).length === 0;

          set((state) => {
            state.blocksById = initialBlocksById;
            state.childrenMap = initialChildrenMap;
            state.currentPageId = pageId;
            if (!isRootEmpty) {
              state.isLoading = false;
            }
          });

          if (isRootEmpty) {
            console.log(
              `[blockStore] Creating initial block for page ${pageId}...`
            );
            try {
              await get().createBlock(null, "");
              console.log(
                `[blockStore] Initial block created successfully for page ${pageId}`
              );
            } catch (blockError) {
              console.error(
                `[blockStore] Failed to create initial block for page ${pageId}:`,
                blockError
              );
              throw new Error(
                `Failed to create initial block: ${
                  blockError instanceof Error
                    ? blockError.message
                    : String(blockError)
                }`
              );
            }

            set((state) => {
              state.isLoading = false;
            });
          }

          const rootBlockIds = rootBlocks.map((b) => b.id);
          if (rootBlockIds.length > 0) {
            invoke<BlockData[]>("get_page_blocks_children", {
              workspacePath,
              parentIds: rootBlockIds,
            })
              .then((childBlocks) => {
                console.log(
                  `[blockStore] Loaded ${childBlocks.length} child blocks progressively`
                );
                set((state) => {
                  const {
                    blocksById: newBlocksById,
                    childrenMap: newChildrenMap,
                  } = normalizeBlocks(childBlocks);
                  Object.assign(state.blocksById, newBlocksById);
                  Object.assign(state.childrenMap, newChildrenMap);
                });
              })
              .catch((err) => {
                console.error("[blockStore] Failed to load child blocks:", err);
              });
          }

          const blockIds = rootBlocks.map((b) => b.id);
          if (blockIds.length > 0) {
            invoke<Record<string, Record<string, string>>>(
              "get_page_blocks_metadata",
              {
                workspacePath,
                blockIds,
              }
            )
              .then((metadataMap) => {
                console.log(
                  `[blockStore] Loaded metadata for ${
                    Object.keys(metadataMap).length
                  } root blocks`
                );
                set((state) => {
                  for (const [blockId, metadata] of Object.entries(
                    metadataMap
                  )) {
                    if (state.blocksById[blockId]) {
                      state.blocksById[blockId].metadata = metadata;
                    }
                  }
                });
              })
              .catch((err) => {
                console.error(
                  "[blockStore] Failed to load root block metadata:",
                  err
                );
              });
          }
        } catch (error) {
          console.error(
            `[blockStore] Failed to load page ${pageId}:`,
            error,
            "Workspace:",
            useWorkspaceStore.getState().workspacePath
          );
          set((state) => {
            state.error =
              typeof error === "string"
                ? error
                : error instanceof Error
                ? error.message
                : "Failed to load page";
            state.isLoading = false;
          });
        }
      },

      loadPage: async (pageId: string) => {
        // Legacy wrapper: use openPage
        return get().openPage(pageId);
      },

      clearPage: () => {
        set((state) => {
          state.blocksById = {};
          state.childrenMap = { root: [] };
          state.currentPageId = null;
        });
        useBlockUIStore.setState({
          focusedBlockId: null,
          selectedBlockIds: [],
          mergingBlockId: null,
          mergingTargetBlockId: null,
          targetCursorPosition: null,
        });
      },

      updatePartialBlocks: (
        blocks: BlockData[],
        deletedBlockIds?: string[],
        skipCacheInvalidation?: boolean
      ) => {
        set((state) => {
          // 1. Update childrenMap incrementally (O(M*K + K log K))
          // Pass state.blocksById BEFORE updating it so the helper can find old parents
          updateChildrenMap(
            state.childrenMap,
            state.blocksById,
            blocks,
            deletedBlockIds ?? []
          );

          // 2. Update blocksById - create new object to ensure re-render
          const updatedBlocksById = { ...state.blocksById };
          for (const block of blocks) {
            updatedBlocksById[block.id] = block;
          }

          // 3. Remove deleted blocks from blocksById
          if (deletedBlockIds) {
            for (const id of deletedBlockIds) {
              delete updatedBlocksById[id];
            }
          }

          // 4. Assign new reference to trigger re-render
          state.blocksById = updatedBlocksById;

          // 5. Also update childrenMap reference to ensure consistency
          state.childrenMap = { ...state.childrenMap };
        });

        // Only invalidate cache if not skipped (default is to invalidate)
        if (!skipCacheInvalidation) {
          invalidatePagesForBlocks(get, blocks, deletedBlockIds);
        }
      },

      // ============ Block CRUD ============

      createBlock: async (
        afterBlockId: string | null,
        content?: string,
        pageId?: string
      ) => {
        const { currentPageId, blocksById, childrenMap } = get();
        const targetPageId = pageId ?? currentPageId;
        if (!targetPageId) throw new Error("No page loaded");

        // Determine where to place the new block:
        let parentId: string | null = null;
        let afterBlockIdForBackend: string | null = null;

        if (afterBlockId) {
          // Use canonical rule for "insert below"
          const target = getInsertBelowTarget(
            afterBlockId,
            blocksById,
            childrenMap
          );
          parentId = target.parentId;
          afterBlockIdForBackend = target.afterBlockId;
        }

        // Use optimistic update only for root block creation (initial empty page)
        // to avoid flicker. For user-initiated creates, reload for accuracy.
        const isRootBlockCreation = afterBlockId === null && content === "";

        if (isRootBlockCreation) {
          // Optimistic: 임시 ID로 즉시 추가
          const tempId = `temp-${Date.now()}`;
          const nowIso = new Date().toISOString();
          const tempBlock: BlockData = {
            id: tempId,
            pageId: targetPageId,
            parentId,
            content: content ?? "",
            orderWeight: Date.now(),
            isCollapsed: false,
            blockType: "bullet",
            createdAt: nowIso,
            updatedAt: nowIso,
          };

          set((state) => {
            state.blocksById[tempId] = tempBlock;
            state.blockStatus[tempId] = "optimistic";
            const parentKey = parentId ?? "root";
            if (!state.childrenMap[parentKey]) {
              state.childrenMap[parentKey] = [];
            }
            state.childrenMap[parentKey].push(tempId);
          });
          useBlockUIStore.setState({ focusedBlockId: tempId });

          try {
            const workspacePath = useWorkspaceStore.getState().workspacePath;
            if (!workspacePath) {
              throw new Error("No workspace selected");
            }

            const newBlock: BlockData = await invoke("create_block", {
              workspacePath,
              request: {
                pageId: targetPageId,
                parentId,
                afterBlockId: afterBlockIdForBackend,
                content,
              },
            });

            // Capture pending updates before clearing them
            const pendingUpdates = get().pendingUpdates.filter(
              (u) => u.tempId === tempId
            );
            const latestContent =
              pendingUpdates.length > 0
                ? pendingUpdates[pendingUpdates.length - 1].content
                : null;

            // 임시 블록을 실제 블록으로 교체
            set((state) => {
              delete state.blocksById[tempId];
              delete state.blockStatus[tempId];

              // Add new block
              state.blocksById[newBlock.id] = newBlock;
              state.blockStatus[newBlock.id] = "synced";

              const parentKey = parentId ?? "root";
              const tempIndex = state.childrenMap[parentKey].indexOf(tempId);
              if (tempIndex !== -1) {
                state.childrenMap[parentKey][tempIndex] = newBlock.id;
              }

              // tempIdMap에 매핑 기록
              state.tempIdMap[tempId] = newBlock.id;

              // Apply latest content from pending updates
              if (latestContent !== null) {
                if (state.blocksById[newBlock.id]) {
                  state.blocksById[newBlock.id].content = latestContent;
                  state.blocksById[newBlock.id].updatedAt =
                    new Date().toISOString();
                }
                // pending updates 제거
                state.pendingUpdates = state.pendingUpdates.filter(
                  (u) => u.tempId !== tempId
                );
              }
            });

            if (useBlockUIStore.getState().focusedBlockId === tempId) {
              useBlockUIStore.setState({ focusedBlockId: newBlock.id });
            }

            // 백엔드에 pending updates 동기화
            if (latestContent !== null) {
              try {
                const workspacePath =
                  useWorkspaceStore.getState().workspacePath;
                if (workspacePath) {
                  await invoke("update_block", {
                    workspacePath,
                    request: { id: newBlock.id, content: latestContent },
                  });
                }
              } catch (error) {
                console.error(
                  "Failed to sync pending updates for new block:",
                  error
                );
              }
            }
          } catch (error) {
            // 롤백
            set((state) => {
              delete state.blocksById[tempId];
              delete state.blockStatus[tempId];
              const parentKey = parentId ?? "root";
              state.childrenMap[parentKey] = state.childrenMap[
                parentKey
              ].filter((id) => id !== tempId);
            });
            throw error;
          }
        } else {
          // User-initiated block creation: no optimistic update, reload for accuracy
          try {
            const workspacePath = useWorkspaceStore.getState().workspacePath;
            if (!workspacePath) {
              throw new Error("No workspace selected");
            }

            const newBlock: BlockData = await invoke("create_block", {
              workspacePath,
              request: {
                pageId: currentPageId,
                parentId,
                afterBlockId: afterBlockIdForBackend,
                content,
              },
            });

            // Update only the new block
            get().updatePartialBlocks([newBlock]);

            // Set focus to properly sync across all stores
            useBlockUIStore.getState().setFocusedBlock(newBlock.id, 0);

            return newBlock.id ?? undefined;
          } catch (error) {
            console.error("Failed to create block:", error);
            // Reload to restore correct state
            const pageId = get().currentPageId;
            if (pageId) await get().loadPage(pageId);
            throw error;
          }
        }
      },

      updateBlock: async (id: string, updates: Partial<BlockData>) => {
        const { blocksById } = get();
        const block = blocksById[id];
        if (!block) return;

        // Optimistic update
        set((state) => {
          if (state.blocksById[id]) {
            state.blocksById[id] = { ...state.blocksById[id], ...updates };
          }
        });

        try {
          const workspacePath = useWorkspaceStore.getState().workspacePath;
          if (!workspacePath) throw new Error("No workspace selected");

          if (updates.metadata) {
            await invoke("update_block", {
              workspacePath,
              request: {
                id,
                metadata: updates.metadata,
              },
            });

            invalidatePageCache(get);
          }
        } catch (error) {
          console.error("Failed to update block:", error);
          // Revert
          set((state) => {
            if (state.blocksById[id]) {
              state.blocksById[id] = block;
            }
          });
          throw error;
        }
      },

      updateBlockContent: async (id: string, content: string) => {
        const { blocksById, blockStatus } = get();
        const { mergingBlockId, mergingTargetBlockId } =
          useBlockUIStore.getState();

        // Prevent UI from overwriting blocks involved in an active merge operation.
        if (id === mergingBlockId || id === mergingTargetBlockId) {
          return;
        }

        const block = blocksById[id];
        if (!block) return;

        // Check if this is a tempId or optimistic/syncing status
        const status = blockStatus[id];
        const isOptimistic =
          status === "optimistic" ||
          status === "syncing" ||
          id.startsWith("temp-");

        if (isOptimistic) {
          // 큐에 추가하고 실제 ID로 교체될 때까지 대기
          set((state) => {
            state.pendingUpdates.push({ tempId: id, content });
            // 블록 UI는 즉시 업데이트
            if (state.blocksById[id]) {
              state.blocksById[id].content = content;
              state.blocksById[id].updatedAt = new Date().toISOString();
            }
          });
          return;
        }

        // 실제 ID인 경우 일반 업데이트 진행
        try {
          const workspacePath = useWorkspaceStore.getState().workspacePath;
          if (!workspacePath) {
            throw new Error("No workspace selected");
          }

          await invoke("update_block", {
            workspacePath,
            request: { id, content },
          });

          // Update state with backend result
          set((state) => {
            if (state.blocksById[id]) {
              state.blocksById[id].content = content;
              state.blocksById[id].updatedAt = new Date().toISOString();
            }
          });
        } catch (error) {
          console.error("Failed to update block content:", error);
          // Reload to restore correct state
          const pageId = get().currentPageId;
          if (pageId) await get().loadPage(pageId);
          throw error;
        }
      },

      splitBlockAtCursor: async (
        id: string,
        offset: number,
        draftContent?: string
      ) => {
        const { currentPageId, blocksById, childrenMap } = get();
        if (!currentPageId) throw new Error("No page loaded");

        const block = blocksById[id];
        if (!block) throw new Error("Block not found");

        const contentToSplit = draftContent ?? block.content;
        const beforeContent = contentToSplit.slice(0, offset);
        const afterContent = contentToSplit.slice(offset);

        // Determine where to place the new block using canonical rule
        const { parentId: newParentId, afterBlockId: afterBlockIdForBackend } =
          getInsertBelowTarget(id, blocksById, childrenMap);

        // Update current block content first (this also updates state)
        try {
          await get().updateBlockContent(id, beforeContent);

          const workspacePath = useWorkspaceStore.getState().workspacePath;
          if (!workspacePath) {
            throw new Error("No workspace selected");
          }

          // Create new block at appropriate position
          const newBlock: BlockData = await invoke("create_block", {
            workspacePath,
            request: {
              pageId: currentPageId,
              parentId: newParentId,
              afterBlockId: afterBlockIdForBackend,
              content: afterContent,
            },
          });

          // Update only the new block (current block already updated by updateBlockContent)
          get().updatePartialBlocks([newBlock]);

          // Set focus to properly sync across all stores
          useBlockUIStore.getState().setFocusedBlock(newBlock.id, 0);
        } catch (error) {
          console.error("Failed to split block:", error);
          // Reload to restore correct state
          const pageId = get().currentPageId;
          if (pageId) await get().loadPage(pageId);
          throw error;
        }
      },

      deleteBlock: async (id: string) => {
        const { blocksById, getPreviousVisibleBlock, currentPageId } = get();
        const block = blocksById[id];
        if (!block) return;

        // Prevent deleting the last block of a page to ensure the editor always has a place to type.
        const totalBlocks = Object.keys(blocksById).length;
        if (totalBlocks <= 1) {
          return;
        }

        // Check if we need to move focus BEFORE deletion (so we know where to go)
        const { focusedBlockId } = useBlockUIStore.getState();
        let nextFocusId: string | null = null;

        if (focusedBlockId === id) {
          // If deleting the focused block, move focus to previous visible block
          nextFocusId = getPreviousVisibleBlock(id);
        }

        try {
          const workspacePath = useWorkspaceStore.getState().workspacePath;
          if (!workspacePath) {
            throw new Error("No workspace selected");
          }

          await invoke("delete_block", {
            workspacePath,
            blockId: id,
          });

          if (currentPageId) {
            await get().loadPage(currentPageId);
          }

          if (nextFocusId) {
            useBlockUIStore.setState({ focusedBlockId: nextFocusId });
          }
        } catch (error) {
          console.error("Failed to delete block:", error);
          // Reload to restore correct state
          const pageId = get().currentPageId;
          if (pageId) await get().loadPage(pageId);
          throw error;
        }
      },

      // ============ Block Manipulation ============

      indentBlock: async (id: string) => {
        const { blocksById, childrenMap } = get();
        const block = blocksById[id];
        if (!block) return;

        // Check if we can indent (must have a previous sibling)
        const parentId = block.parentId ?? "root";
        const siblings = childrenMap[parentId] ?? [];
        const index = siblings.indexOf(id);

        if (index <= 0) {
          // No previous sibling, cannot indent. Fail silently.
          console.log(
            "[blockStore:indentBlock] Cannot indent: no previous sibling"
          );
          return;
        }

        try {
          const workspacePath = useWorkspaceStore.getState().workspacePath;
          if (!workspacePath) {
            throw new Error("No workspace selected");
          }

          console.log(
            "[blockStore:indentBlock] Calling backend indent_block for:",
            id
          );
          // Backend returns the updated block
          const updatedBlock: BlockData = await invoke("indent_block", {
            workspacePath,
            blockId: id,
          });

          console.log(
            "[blockStore:indentBlock] Backend returned, new parentId:",
            updatedBlock.parentId
          );
          // Update only the changed block without invalidating page cache
          // This prevents the Hook error that occurs when all blocks briefly become undefined
          get().updatePartialBlocks([updatedBlock], undefined, true);
          console.log("[blockStore:indentBlock] updatePartialBlocks completed");
        } catch (error) {
          console.error("Failed to indent block:", error);
          const pageId = get().currentPageId;
          if (pageId) await get().loadPage(pageId);
          throw error;
        }
      },

      outdentBlock: async (id: string) => {
        const { blocksById } = get();
        const block = blocksById[id];
        if (!block || !block.parentId) return;

        try {
          const workspacePath = useWorkspaceStore.getState().workspacePath;
          if (!workspacePath) {
            throw new Error("No workspace selected");
          }

          // Backend returns the updated block
          const updatedBlock: BlockData = await invoke("outdent_block", {
            workspacePath,
            blockId: id,
          });

          // Update only the changed block
          get().updatePartialBlocks([updatedBlock]);
        } catch (error) {
          console.error("Failed to outdent block:", error);
          const pageId = get().currentPageId;
          if (pageId) await get().loadPage(pageId);
          throw error;
        }
      },

      moveBlock: async (
        id: string,
        targetParentId: string | null,
        afterBlockId: string | null
      ) => {
        const workspacePath = useWorkspaceStore.getState().workspacePath;
        if (!workspacePath) {
          throw new Error("No workspace path");
        }

        // Backend returns the updated block
        const updatedBlock: BlockData = await invoke("move_block", {
          workspacePath,
          blockId: id,
          newParentId: targetParentId,
          afterBlockId,
        });

        // Update only the changed block
        get().updatePartialBlocks([updatedBlock]);
      },

      mergeWithPrevious: async (id: string, draftContent?: string) => {
        const { blocksById, getPreviousVisibleBlock, deleteBlock } = get();

        // Prevent concurrent merges on the same block
        const { mergingBlockId } = useBlockUIStore.getState();
        if (mergingBlockId === id) {
          return;
        }

        useBlockUIStore.setState({
          mergingBlockId: id,
          mergingTargetBlockId: null,
        });

        try {
          const currentBlock = blocksById[id];
          if (!currentBlock) return;

          const contentToMerge = draftContent ?? currentBlock.content;

          // Case 1: If current block is empty, delete it and move focus to previous
          if (contentToMerge === "") {
            const prevBlockId = getPreviousVisibleBlock(id);
            await deleteBlock(id);

            if (prevBlockId) {
              const prevBlock = get().blocksById[prevBlockId];
              if (prevBlock) {
                useBlockUIStore.setState({
                  focusedBlockId: prevBlockId,
                  targetCursorPosition: prevBlock.content.length,
                });
              } else {
                useBlockUIStore.setState({ focusedBlockId: prevBlockId });
              }
            }
            return;
          }

          // Case 2: Non-empty block, merge into previous
          const prevBlockId = getPreviousVisibleBlock(id);
          if (!prevBlockId) {
            return;
          }

          // Lock the target block to prevent stale UI updates from overwriting the merge result
          useBlockUIStore.setState({ mergingTargetBlockId: prevBlockId });

          const prevBlock = blocksById[prevBlockId];
          if (!prevBlock) return;

          const workspacePath = useWorkspaceStore.getState().workspacePath;
          if (!workspacePath) throw new Error("No workspace selected");

          // Paranoid sync: Ensure target block content in DB matches Store before merge
          if (prevBlock) {
            await invoke("update_block", {
              workspacePath,
              request: { id: prevBlockId, content: prevBlock.content },
            });
          }

          // Calculate cursor position for focus after merge
          const cursorPosition = prevBlock.content.length;

          // If draftContent is provided, update the block content first
          if (
            draftContent !== undefined &&
            draftContent !== currentBlock.content
          ) {
            await invoke("update_block", {
              workspacePath,
              request: { id, content: draftContent },
            });

            set((state) => {
              if (state.blocksById[id]) {
                state.blocksById[id].content = draftContent;
                state.blocksById[id].updatedAt = new Date().toISOString();
              }
            });
          }

          // Backend handles the merge atomically and returns changed blocks
          const changedBlocks: BlockData[] = await invoke("merge_blocks", {
            workspacePath,
            blockId: id,
            targetId: prevBlockId,
          });

          // Update only the changed blocks (merged block + moved children)
          get().updatePartialBlocks(changedBlocks, [id]);

          // Set focus and cursor position
          useBlockUIStore.setState({
            focusedBlockId: prevBlockId,
            targetCursorPosition: cursorPosition,
          });
        } catch (error) {
          console.error("Failed to merge blocks:", error);

          // Error recovery: Clear focus to ensure Editor components re-initialize with fresh data on reload
          useBlockUIStore.setState({ focusedBlockId: null });

          const pageId = get().currentPageId;
          if (pageId) await get().loadPage(pageId);

          // Restore focus
          const state = get();
          if (state.blocksById[id]) {
            // If the block still exists (merge failed), focus it so user can retry or see state
            useBlockUIStore.setState({ focusedBlockId: id });
          } else {
            // Block is gone (maybe deleted by race?), focus previous or root
            const prev =
              getPreviousVisibleBlock(id) ?? state.childrenMap.root?.[0];
            useBlockUIStore.setState({ focusedBlockId: prev ?? null });
          }
        } finally {
          useBlockUIStore.setState({
            mergingBlockId: null,
            mergingTargetBlockId: null,
          });
        }
      },

      toggleCollapse: async (id: string) => {
        const block = get().blocksById[id];
        if (!block) return;

        try {
          const workspacePath = useWorkspaceStore.getState().workspacePath;
          if (!workspacePath) {
            throw new Error("No workspace selected");
          }

          // Backend returns the updated block
          const updatedBlock: BlockData = await invoke("toggle_collapse", {
            workspacePath,
            blockId: id,
          });

          // Update only the changed block
          get().updatePartialBlocks([updatedBlock]);
        } catch (error) {
          console.error("Failed to toggle collapse:", error);
          const pageId = get().currentPageId;
          if (pageId) await get().loadPage(pageId);
          throw error;
        }
      },

      // ============ Selectors ============

      getBlock: (id: string) => get().blocksById[id],

      getChildren: (parentId: string | null) => {
        const key = parentId ?? "root";
        return get().childrenMap[key] ?? [];
      },

      getRootBlockIds: () => get().childrenMap.root ?? [],

      // ============ Keyboard Navigation ============

      getPreviousVisibleBlock: (id: string) => {
        const { blocksById, childrenMap } = get();
        const block = blocksById[id];
        if (!block) return null;

        const parentKey = block.parentId ?? "root";
        const siblings = childrenMap[parentKey] ?? [];
        const index = siblings.indexOf(id);

        if (index > 0) {
          // Previous sibling exists
          const prevSiblingId = siblings[index - 1];
          const prevSibling = blocksById[prevSiblingId];
          if (!prevSibling) return null;

          // If expanded and has children, find the last visible descendant
          let currentId = prevSiblingId;
          while (true) {
            const currentBlock = blocksById[currentId];
            const children = childrenMap[currentId];

            if (
              currentBlock &&
              !currentBlock.isCollapsed &&
              children &&
              children.length > 0
            ) {
              // Go to last child
              currentId = children[children.length - 1];
            } else {
              // No more visible children
              return currentId;
            }
          }
        }

        if (block.parentId) {
          // First sibling -> go to parent
          return block.parentId;
        }

        return null;
      },

      getPreviousBlock: (id: string) => get().getPreviousVisibleBlock(id),

      getNextBlock: (id: string) => {
        const { blocksById, childrenMap } = get();
        const block = blocksById[id];
        if (!block) return null;

        // 접혀있지 않고 자식이 있으면 첫 번째 자식으로
        const children = childrenMap[id] ?? [];
        if (children.length > 0 && !block.isCollapsed) {
          return children[0];
        }

        // 자식이 없으면 다음 형제 찾기
        let currentId: string | null = id;
        let currentBlock = block;

        while (currentId) {
          const parentKey = currentBlock.parentId ?? "root";
          const siblings = childrenMap[parentKey] ?? [];
          const index = siblings.indexOf(currentId);

          if (index < siblings.length - 1) {
            // 다음 형제가 있으면 반환
            return siblings[index + 1];
          }

          // 부모의 다음 형제 찾기
          currentId = currentBlock.parentId;
          if (!currentId) break;
          currentBlock = blocksById[currentId];
          if (!currentBlock) break;
        }

        return null;
      },
    })),
    {
      limit: 100,
      partialize: (state) => ({
        blocksById: state.blocksById,
        childrenMap: state.childrenMap,
      }),
    }
  )
);

// ============ Selector Hooks ============

/**
 * Get a specific block by ID.
 * NOTE: This subscribes to the entire block object reference.
 * Consider using granular selectors (useBlockContent, etc.) for better performance.
 */
export const useBlock = (id: string) =>
  useBlockStore((state) => state.blocksById[id]);

/**
 * Get children IDs for a parent.
 * NOTE: This subscribes to the entire children array.
 * Consider using useBlockHasChildren if you only need to know if children exist.
 */
export const useChildrenIds = (parentId: string | null) =>
  useBlockStore(
    (state) => state.childrenMap[parentId ?? "root"] ?? [],
    shallow
  );

export const useBlocksLoading = () => useBlockStore((state) => state.isLoading);

// ============ Granular Performance-Optimized Selectors ============
/**
 * These selectors subscribe to minimal state slices to prevent unnecessary re-renders.
 * Use these instead of useBlock/useChildrenIds when you only need specific properties.
 */

/**
 * Get block content only.
 * Re-renders only when THIS block's content changes.
 */
export const useBlockContent = (id: string) =>
  useBlockStore((state) => state.blocksById[id]?.content, shallow);

/**
 * Get block collapse state only.
 * Re-renders only when THIS block's collapse state changes.
 */
export const useBlockIsCollapsed = (id: string) =>
  useBlockStore((state) => state.blocksById[id]?.isCollapsed, shallow);

/**
 * Check if block has any children (boolean only, not the array).
 * Re-renders only when children count for THIS block changes.
 */
export const useBlockHasChildren = (id: string) =>
  useBlockStore((state) => (state.childrenMap[id]?.length ?? 0) > 0, shallow);

/**
 * Get block metadata only.
 * Re-renders only when THIS block's metadata changes.
 */
export const useBlockMetadata = (id: string) =>
  useBlockStore((state) => state.blocksById[id]?.metadata, shallow);

/**
 * Get block type only.
 * Re-renders only when THIS block's type changes.
 */
export const useBlockType = (id: string) =>
  useBlockStore((state) => state.blocksById[id]?.blockType, shallow);

/**
 * Get block status only (synced/syncing/error/optimistic).
 * Re-renders only when THIS block's sync status changes.
 */
export const useBlockStatus = (id: string) =>
  useBlockStore((state) => state.blockStatus[id], shallow);

// ============ Cache Monitoring Export ============

/**
 * Get current cache statistics
 * Returns detailed cache performance metrics
 */
export function getCacheStats() {
  return pageCache.stats();
}

/**
 * Get formatted cache statistics report
 * Returns a human-readable string with cache metrics
 */
export function getCacheReport(): string {
  return pageCache.getReport();
}

/**
 * Reset cache statistics
 * Clears hit/miss counters but keeps cached data
 */
export function resetCacheStats(): void {
  pageCache.resetStats();
}

/**
 * Clear all cached pages
 */
export function clearPageCache(): void {
  pageCache.invalidateAll();
}

export async function warmPageCacheFromStorage(
  storageKey: string
): Promise<void> {
  await pageCache.warmFromStorage(storageKey);
}
