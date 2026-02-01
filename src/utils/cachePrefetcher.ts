/**
 * Cache Prefetcher Utility
 * Automatically prefetches frequently visited pages when the app is idle
 * 
 * Usage:
 *   cachePrefetcher.start()      // Start monitoring and prefetching
 *   cachePrefetcher.stop()       // Stop prefetching
 *   cachePrefetcher.getStats()   // View prefetch statistics
 */

import { useBlockStore } from "../stores/blockStore";

interface PageVisitEntry {
  pageId: string;
  visits: number;
  lastVisited: number;
  prefetched: boolean;
  prefetchTime?: number;
}

interface PrefetcherConfig {
  enabled: boolean;
  minVisitsToPreload: number; // Prefetch after this many visits
  idleTimeMs: number; // Wait this long after last activity
  maxPrefetchQueue: number; // Max pages to prefetch at once
  prefetchDelay: number; // Delay between prefetch requests (ms)
  ttl: number; // How long to track page visits (ms)
}

class CachePrefetcher {
  private pageVisits = new Map<string, PageVisitEntry>();
  private config: PrefetcherConfig = {
    enabled: true,
    minVisitsToPreload: 2, // Prefetch after 2nd visit
    idleTimeMs: 3000, // 3 seconds of idle time
    maxPrefetchQueue: 3, // Prefetch up to 3 pages at once
    prefetchDelay: 100, // 100ms between each prefetch
    ttl: 24 * 60 * 60 * 1000, // 24 hours
  };

  private isMonitoring = false;
  private lastActivityTime = Date.now();
  private prefetching = false;
  private prefetchQueue: string[] = [];
  private activityCheckInterval: NodeJS.Timeout | null = null;
  private prefetchInterval: NodeJS.Timeout | null = null;
  private unsubscribeActivity: (() => void) | null = null;
  private totalPrefetched = 0;
  private prefetchSuccesses = 0;
  private prefetchErrors = 0;

  /**
   * Start monitoring page visits and prefetching
   */
  start(): void {
    if (this.isMonitoring) {
      console.warn("[cachePrefetcher] Already monitoring");
      return;
    }

    this.isMonitoring = true;
    console.log("[cachePrefetcher] ✅ Started monitoring page visits");

    // Track page visits by hooking into store updates
    this.setupActivityTracking();

    // Check for idle time and trigger prefetch
    this.activityCheckInterval = setInterval(() => {
      this.checkAndPrefetch();
    }, 1000); // Check every second

    // Process prefetch queue
    this.prefetchInterval = setInterval(() => {
      this.processPrefetchQueue();
    }, this.config.prefetchDelay);
  }

  /**
   * Stop monitoring and prefetching
   */
  stop(): void {
    if (this.activityCheckInterval) {
      clearInterval(this.activityCheckInterval);
    }
    if (this.prefetchInterval) {
      clearInterval(this.prefetchInterval);
    }
    if (this.unsubscribeActivity) {
      try {
        this.unsubscribeActivity();
      } catch (e) {
        // Ignore unsubscribe errors
      }
    }
    this.isMonitoring = false;
    console.log("[cachePrefetcher] ⏹️  Stopped monitoring");
  }

  /**
   * Track page visits by hooking into store updates
   */
  private setupActivityTracking(): void {
    // Listen to block store changes
    let lastPageId: string | null = null;
    
    this.unsubscribeActivity = useBlockStore.subscribe(
      (state) => {
        const currentPageId = state.currentPageId;
        if (currentPageId && currentPageId !== lastPageId) {
          lastPageId = currentPageId;
          this.recordPageVisit(currentPageId);
          this.lastActivityTime = Date.now();
        }
      },
    );
  }

  /**
   * Record a page visit
   */
  private recordPageVisit(pageId: string): void {
    const existing = this.pageVisits.get(pageId);

    if (existing) {
      existing.visits++;
      existing.lastVisited = Date.now();
    } else {
      this.pageVisits.set(pageId, {
        pageId,
        visits: 1,
        lastVisited: Date.now(),
        prefetched: false,
      });
    }

    console.log(
      `[cachePrefetcher] Page visit: ${pageId} (${existing ? existing.visits : 1} times)`,
    );
  }

  /**
   * Check for idle time and queue pages for prefetch
   */
  private checkAndPrefetch(): void {
    if (!this.config.enabled || this.prefetching) return;

    const idleTime = Date.now() - this.lastActivityTime;

    if (idleTime > this.config.idleTimeMs) {
      this.queueHighFrequencyPages();
    }
  }

  /**
   * Queue high-frequency pages for prefetching
   */
  private queueHighFrequencyPages(): void {
    const candidates = Array.from(this.pageVisits.values())
      .filter(
        (entry) =>
          entry.visits >= this.config.minVisitsToPreload && !entry.prefetched,
      )
      .sort((a, b) => b.visits - a.visits)
      .slice(0, this.config.maxPrefetchQueue);

    if (candidates.length > 0) {
      console.log(
        `[cachePrefetcher] Found ${candidates.length} pages to prefetch`,
      );
      this.prefetchQueue.push(...candidates.map((c) => c.pageId));
      this.prefetching = true;
    }
  }

  /**
   * Process prefetch queue
   */
  private processPrefetchQueue(): void {
    if (this.prefetchQueue.length === 0) {
      this.prefetching = false;
      return;
    }

    const pageId = this.prefetchQueue.shift();
    if (!pageId) return;

    this.prefetchPage(pageId);
  }

  /**
   * Prefetch a page (load it into cache)
   */
  private async prefetchPage(pageId: string): Promise<void> {
    try {
      const startTime = Date.now();

      // Try to load the page
      await useBlockStore.getState().openPage(pageId);

      const loadTime = Date.now() - startTime;

      // Mark as prefetched
      const entry = this.pageVisits.get(pageId);
      if (entry) {
        entry.prefetched = true;
        entry.prefetchTime = loadTime;
      }

      this.totalPrefetched++;
      this.prefetchSuccesses++;

      console.log(
        `[cachePrefetcher] ✅ Prefetched ${pageId} in ${loadTime}ms`,
      );
    } catch (error) {
      this.prefetchErrors++;
      console.error(`[cachePrefetcher] ❌ Failed to prefetch ${pageId}:`, error);
    }
  }

  /**
   * Get prefetcher statistics
   */
  getStats(): {
    isMonitoring: boolean;
    totalPages: number;
    frequentPages: number;
    totalPrefetched: number;
    prefetchSuccesses: number;
    prefetchErrors: number;
    successRate: number;
    topPages: Array<{
      pageId: string;
      visits: number;
      prefetched: boolean;
      prefetchTime?: number;
    }>;
  } {
    const frequentPages = Array.from(this.pageVisits.values()).filter(
      (p) => p.visits >= this.config.minVisitsToPreload,
    ).length;

    const topPages = Array.from(this.pageVisits.values())
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 5);

    const successRate =
      this.totalPrefetched > 0
        ? (this.prefetchSuccesses / this.totalPrefetched) * 100
        : 0;

    return {
      isMonitoring: this.isMonitoring,
      totalPages: this.pageVisits.size,
      frequentPages,
      totalPrefetched: this.totalPrefetched,
      prefetchSuccesses: this.prefetchSuccesses,
      prefetchErrors: this.prefetchErrors,
      successRate,
      topPages,
    };
  }

  /**
   * Get a formatted report
   */
  getReport(): string {
    const stats = this.getStats();

    return `
╔══════════════════════════════════════════════════════════╗
║              📥 PREFETCHER STATISTICS REPORT               ║
╠══════════════════════════════════════════════════════════╣
║ 📊 OVERVIEW                                              ║
║    Monitoring: ${stats.isMonitoring ? "✅ Active" : "❌ Inactive"}                                  ║
║    Total Pages: ${String(stats.totalPages).padEnd(5)}                                  ║
║    Frequent Pages: ${String(stats.frequentPages).padEnd(5)}                              ║
║                                                          ║
║ 📈 PREFETCH STATS                                        ║
║    Total Prefetched: ${String(stats.totalPrefetched).padEnd(5)}                          ║
║    Successes: ${String(stats.prefetchSuccesses).padEnd(5)}                                    ║
║    Errors: ${String(stats.prefetchErrors).padEnd(5)}                                        ║
║    Success Rate: ${stats.successRate.toFixed(1).padStart(5)}%                             ║
║                                                          ║
║ 🏆 TOP VISITED PAGES                                     ║
${stats.topPages
  .map(
    (p, i) =>
      `║    ${i + 1}. ${p.pageId.substring(0, 20).padEnd(20)} (${String(p.visits).padStart(2)} visits${p.prefetched ? ", prefetched" : ""}) ║`,
  )
  .join("\n")}
║                                                          ║
╚══════════════════════════════════════════════════════════╝
    `.trim();
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<PrefetcherConfig>): void {
    this.config = { ...this.config, ...config };
    console.log("[cachePrefetcher] Configuration updated", this.config);
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.pageVisits.clear();
    this.totalPrefetched = 0;
    this.prefetchSuccesses = 0;
    this.prefetchErrors = 0;
    this.prefetchQueue = [];
    console.log("[cachePrefetcher] Statistics reset");
  }

  /**
   * Get configuration
   */
  getConfig(): PrefetcherConfig {
    return { ...this.config };
  }
}

// Export singleton
export const cachePrefetcher = new CachePrefetcher();

// Make available globally for debugging
if (typeof window !== "undefined") {
  (window as any).__cachePrefetcher = cachePrefetcher;
  console.log("[cachePrefetcher] 🚀 Prefetcher available at __cachePrefetcher");
}

export default cachePrefetcher;
