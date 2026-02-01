import { createWithEqualityFn as create } from "zustand/traditional";

/**
 * Cache Statistics Store
 * Provides access to blockStore cache performance metrics
 * Use this for monitoring and debugging cache effectiveness
 */

interface CacheStatistics {
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

interface CacheStatsState {
  stats: CacheStatistics | null;
  lastUpdated: number | null;
  enabled: boolean;
  autoRefreshInterval: number; // ms
}

interface CacheStatsActions {
  updateStats: (stats: CacheStatistics) => void;
  getStats: () => CacheStatistics | null;
  clearStats: () => void;
  setEnabled: (enabled: boolean) => void;
  setAutoRefreshInterval: (interval: number) => void;
}

type CacheStatsStore = CacheStatsState & CacheStatsActions;

export const useCacheStatsStore = create<CacheStatsStore>((set, get) => ({
  stats: null,
  lastUpdated: null,
  enabled: true,
  autoRefreshInterval: 5000, // 5 seconds default

  updateStats: (stats: CacheStatistics) => {
    set({
      stats,
      lastUpdated: Date.now(),
    });
  },

  getStats: () => {
    return get().stats;
  },

  clearStats: () => {
    set({
      stats: null,
      lastUpdated: null,
    });
  },

  setEnabled: (enabled: boolean) => {
    set({ enabled });
  },

  setAutoRefreshInterval: (interval: number) => {
    set({ autoRefreshInterval: interval });
  },
}));

/**
 * Format cache statistics for human-readable display
 */
export function formatCacheStats(stats: CacheStatistics): string {
  const fullPercent = ((stats.size / stats.capacity) * 100).toFixed(1);
  const oldestAge = (stats.oldestPageAge / 1000).toFixed(1);
  const newestAge = (stats.newestPageAge / 1000).toFixed(1);
  const memoryKB = (stats.totalMemoryBytes / 1024).toFixed(2);

  return `
=== 📊 Cache Statistics ===
Capacity: ${stats.size}/${stats.capacity} (${fullPercent}% full)
Hit Rate: ${stats.hitRate.toFixed(1)}% (${stats.hits} hits, ${stats.misses} misses)
Load Time: ${stats.avgLoadTime.toFixed(2)}ms average
Memory: ${memoryKB}KB
Events: ${stats.evictions} evictions, ${stats.ttlExpirations} TTL expiries, ${stats.invalidations} invalidations
Entry Ages: ${oldestAge}s oldest, ${newestAge}s newest
`.trim();
}

/**
 * Create a compact stats display for debugging
 */
export function compactCacheStats(stats: CacheStatistics): string {
  return `Cache: ${stats.size}/${stats.capacity} | Hit: ${stats.hitRate.toFixed(0)}% | Mem: ${(stats.totalMemoryBytes / 1024).toFixed(1)}KB | Load: ${stats.avgLoadTime.toFixed(1)}ms`;
}
