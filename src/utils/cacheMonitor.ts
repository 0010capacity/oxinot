/**
 * Cache Monitoring Utility
 * Provides utilities for monitoring and debugging the page cache
 *
 * Usage:
 *   import { cacheMonitor } from '@/utils/cacheMonitor'
 *   cacheMonitor.start()      // Start monitoring
 *   cacheMonitor.getReport()  // Get detailed stats report
 *   cacheMonitor.stop()       // Stop monitoring
 *
 * Browser console:
 *   __cacheMonitor.getReport()  // View detailed stats
 *   __cacheMonitor.reset()      // Reset counters
 */

import {
  getCacheStats,
  resetCacheStats,
  clearPageCache,
} from "../stores/blockStore";
import { useCacheStatsStore } from "../stores/cacheStatsStore";
import type { CacheStatistics } from "../stores/blockStore";

class CacheMonitor {
  private refreshInterval: NodeJS.Timeout | null = null;
  isMonitoring = false;
  private autoUpdateEnabled = true;

  /**
   * Start monitoring cache statistics
   * Automatically updates cache stats store at regular intervals
   */
  start(intervalMs = 5000): void {
    if (this.isMonitoring) {
      console.warn("[cacheMonitor] Already monitoring cache");
      return;
    }

    this.isMonitoring = true;
    console.log(
      `[cacheMonitor] ✅ Started monitoring cache (interval: ${intervalMs}ms)`
    );

    // Perform initial update
    this.refresh();

    // Set up periodic refresh
    this.refreshInterval = setInterval(() => {
      if (this.autoUpdateEnabled) {
        this.refresh();
      }
    }, intervalMs);
  }

  /**
   * Stop monitoring cache statistics
   */
  stop(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.isMonitoring = false;
    console.log("[cacheMonitor] ⏹️  Stopped monitoring cache");
  }

  /**
   * Manually refresh cache statistics
   */
  refresh(): void {
    try {
      const stats = getCacheStats();
      useCacheStatsStore.getState().updateStats(stats);
    } catch (error) {
      console.error("[cacheMonitor] Error refreshing cache stats:", error);
    }
  }

  /**
   * Get current cache status
   */
  getStatus(): {
    isMonitoring: boolean;
    hasStats: boolean;
    stats: CacheStatistics | null;
  } {
    const stats = useCacheStatsStore.getState().getStats();
    return {
      isMonitoring: this.isMonitoring,
      hasStats: stats !== null,
      stats: stats,
    };
  }

  /**
   * Get detailed cache report as string
   */
  getReport(): string {
    this.refresh(); // Ensure latest stats
    const stats = useCacheStatsStore.getState().getStats();

    if (!stats) {
      return "[cacheMonitor] ❌ No statistics available. Start monitoring with cacheMonitor.start()";
    }

    const fullPercent = ((stats.size / stats.capacity) * 100).toFixed(1);
    const oldestAge = (stats.oldestPageAge / 1000).toFixed(1);
    const newestAge = (stats.newestPageAge / 1000).toFixed(1);
    const memoryKB = (stats.totalMemoryBytes / 1024).toFixed(2);
    const totalRequests = stats.hits + stats.misses;
    const totalEvents =
      stats.evictions + stats.ttlExpirations + stats.invalidations;

    return `
╔═══════════════════════════════════════════════════════════════╗
║                  📊 CACHE STATISTICS REPORT                    ║
╠═══════════════════════════════════════════════════════════════╣
║ 📦 CAPACITY & MEMORY                                           ║
║    Entries: ${String(stats.size).padEnd(2)} / ${
      stats.capacity
    } (${fullPercent.padStart(5)}% full)                                ║
║    Memory: ${memoryKB.padStart(
      8
    )}KB                                          ║
║                                                               ║
║ 📈 PERFORMANCE                                                ║
║    Hit Rate: ${stats.hitRate.toFixed(1).padStart(5)}% (${String(
      stats.hits
    ).padEnd(5)} hits / ${String(stats.misses).padEnd(5)} misses)            ║
║    Avg Load Time: ${stats.avgLoadTime
      .toFixed(2)
      .padStart(7)}ms                              ║
║    Total Requests: ${totalRequests}                                        ║
║                                                               ║
║ 🔄 CACHE EVENTS                                               ║
║    Evictions: ${String(stats.evictions).padStart(
      3
    )}                                       ║
║    TTL Expirations: ${String(stats.ttlExpirations).padStart(
      3
    )}                                   ║
║    Invalidations: ${String(stats.invalidations).padStart(
      3
    )}                                    ║
║    Total Events: ${totalEvents}                                        ║
║                                                               ║
║ ⏱️  ENTRY AGES                                                 ║
║    Oldest: ${oldestAge.padStart(
      5
    )}s ago                                      ║
║    Newest: ${newestAge.padStart(
      5
    )}s ago                                      ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `.trim();
  }

  /**
   * Print cache report to console
   */
  print(): void {
    console.log(this.getReport());
  }

  /**
   * Reset cache statistics
   * Clears hit/miss counters but keeps cached data
   */
  reset(): void {
    resetCacheStats();
    this.refresh();
    console.log("[cacheMonitor] 🔄 Cache statistics reset");
  }

  /**
   * Clear the cache entirely
   */
  clear(): void {
    clearPageCache();
    this.refresh();
    console.log("[cacheMonitor] 🗑️  Cache cleared");
  }

  /**
   * Check if cache monitoring is enabled
   */
  isEnabled(): boolean {
    return useCacheStatsStore.getState().enabled;
  }

  /**
   * Enable/disable cache monitoring
   */
  setEnabled(enabled: boolean): void {
    useCacheStatsStore.getState().setEnabled(enabled);
    console.log(
      `[cacheMonitor] ${enabled ? "✅" : "❌"} Cache monitoring ${
        enabled ? "enabled" : "disabled"
      }`
    );
  }

  /**
   * Set auto-update status
   */
  setAutoUpdate(enabled: boolean): void {
    this.autoUpdateEnabled = enabled;
    console.log(
      `[cacheMonitor] Auto-update ${enabled ? "enabled" : "disabled"}`
    );
  }

  /**
   * Get raw cache statistics object
   */
  getStats() {
    this.refresh();
    return useCacheStatsStore.getState().getStats();
  }
}

// Export singleton instance
export const cacheMonitor = new CacheMonitor();

// Make it available globally for debugging in browser console
declare global {
  // eslint-disable-next-line no-var
  var __cacheMonitor: typeof cacheMonitor;
}

if (typeof window !== "undefined") {
  window.__cacheMonitor = cacheMonitor;
  console.log("[cacheMonitor] 🚀 Cache monitor available at __cacheMonitor");
}

export default cacheMonitor;
