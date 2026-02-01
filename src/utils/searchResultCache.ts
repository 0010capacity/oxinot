/**
 * Search Result Cache Utility
 * Caches search results to reduce backend load and improve search performance
 * 
 * Usage:
 *   searchResultCache.search("keyword")     // Search (uses cache if available)
 *   searchResultCache.getStats()            // View cache statistics
 *   searchResultCache.clear()               // Clear all cached results
 */

import { invoke } from "@tauri-apps/api/core";

interface SearchResult {
  id: string;
  page_id: string;
  page_title: string;
  result_type: "page" | "block";
  content: string;
  snippet: string;
}

interface CachedSearch {
  query: string;
  results: SearchResult[];
  timestamp: number;
}

interface SearchCacheStats {
  size: number;
  capacity: number;
  hits: number;
  misses: number;
  hitRate: number;
  totalQueries: number;
  avgResultsPerQuery: number;
  recentQueries: string[];
}

class SearchResultCache {
  private cache = new Map<string, CachedSearch>();
  private readonly MAX_ENTRIES = 50;
  private readonly TTL_MS = 10 * 60 * 1000; // 10 minutes for search results

  private hits = 0;
  private misses = 0;

  /**
   * Search with caching
   */
  async search(
    workspacePath: string,
    query: string,
  ): Promise<SearchResult[]> {
    // Normalize query for caching (lowercase, trim)
    const cacheKey = query.toLowerCase().trim();

    if (!cacheKey) {
      return [];
    }

    // Try to get from cache
    const cached = this.getFromCache(cacheKey);
    if (cached !== null) {
      this.hits++;
      console.log(
        `[searchCache] Cache hit for "${query}". Hit rate: ${this.getHitRate().toFixed(1)}%`,
      );
      return cached;
    }

    // Not in cache, perform search
    this.misses++;

    try {
      console.log(`[searchCache] Cache miss for "${query}". Searching...`);
      const results = await invoke<SearchResult[]>("search_content", {
        workspacePath,
        query: cacheKey,
      });

      // Cache the results
      this.cacheResult(cacheKey, results);

      return results;
    } catch (error) {
      console.error(`[searchCache] Search failed for "${query}":`, error);
      return [];
    }
  }

  /**
   * Get results from cache
   */
  private getFromCache(query: string): SearchResult[] | null {
    const cached = this.cache.get(query);

    if (!cached) {
      return null;
    }

    // Check TTL
    const age = Date.now() - cached.timestamp;
    if (age > this.TTL_MS) {
      this.cache.delete(query);
      console.log(`[searchCache] TTL expired for "${query}" (age: ${(age / 1000).toFixed(1)}s)`);
      return null;
    }

    return cached.results;
  }

  /**
   * Cache search results
   */
  private cacheResult(query: string, results: SearchResult[]): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.MAX_ENTRIES) {
      const oldest = Array.from(this.cache.entries()).sort(
        ([, a], [, b]) => a.timestamp - b.timestamp,
      )[0];

      if (oldest) {
        this.cache.delete(oldest[0]);
        console.log(
          `[searchCache] Evicted oldest query: "${oldest[0]}"`,
        );
      }
    }

    this.cache.set(query, {
      query,
      results,
      timestamp: Date.now(),
    });

    console.log(
      `[searchCache] Cached "${query}" (${results.length} results). Cache size: ${this.cache.size}/${this.MAX_ENTRIES}`,
    );
  }

  /**
   * Get cache statistics
   */
  getStats(): SearchCacheStats {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;
    const totalResults = Array.from(this.cache.values()).reduce(
      (sum, cached) => sum + cached.results.length,
      0,
    );
    const avgResults =
      this.cache.size > 0 ? totalResults / this.cache.size : 0;

    const recentQueries = Array.from(this.cache.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10)
      .map((c) => c.query);

    return {
      size: this.cache.size,
      capacity: this.MAX_ENTRIES,
      hits: this.hits,
      misses: this.misses,
      hitRate,
      totalQueries: total,
      avgResultsPerQuery: avgResults,
      recentQueries,
    };
  }

  /**
   * Get formatted report
   */
  getReport(): string {
    const stats = this.getStats();

    return `
╔════════════════════════════════════════════════════════╗
║              🔍 SEARCH CACHE STATISTICS                 ║
╠════════════════════════════════════════════════════════╣
║ CAPACITY                                               ║
║   Cached Queries: ${String(stats.size).padEnd(2)} / ${stats.capacity} (${((stats.size / stats.capacity) * 100).toFixed(1)}%)
║   Avg Results/Query: ${stats.avgResultsPerQuery.toFixed(1)}
║                                                        ║
║ PERFORMANCE                                            ║
║   Hit Rate: ${stats.hitRate.toFixed(1)}% (${stats.hits} hits / ${stats.misses} misses)
║   Total Queries: ${stats.totalQueries}
║                                                        ║
║ RECENT QUERIES                                         ║
${stats.recentQueries
  .map((q, i) => `║   ${i + 1}. "${q}"`)
  .join("\n")}
║                                                        ║
╚════════════════════════════════════════════════════════╝
    `.trim();
  }

  /**
   * Clear all cached results
   */
  clear(): void {
    const previousSize = this.cache.size;
    this.cache.clear();
    console.log(`[searchCache] Cleared ${previousSize} cached queries`);
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    console.log("[searchCache] Statistics reset");
  }

  /**
   * Invalidate specific query
   */
  invalidate(query: string): void {
    const normalized = query.toLowerCase().trim();
    if (this.cache.has(normalized)) {
      this.cache.delete(normalized);
      console.log(`[searchCache] Invalidated "${query}"`);
    }
  }

  /**
   * Invalidate queries matching pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern, "i");
    let count = 0;

    for (const query of this.cache.keys()) {
      if (regex.test(query)) {
        this.cache.delete(query);
        count++;
      }
    }

    if (count > 0) {
      console.log(`[searchCache] Invalidated ${count} queries matching "${pattern}"`);
    }
  }

  /**
   * Get hit rate
   */
  private getHitRate(): number {
    const total = this.hits + this.misses;
    if (total === 0) return 0;
    return (this.hits / total) * 100;
  }
}

// Export singleton
export const searchResultCache = new SearchResultCache();

// Make available globally for debugging
if (typeof window !== "undefined") {
  (window as any).__searchCache = searchResultCache;
  console.log("[searchCache] 🚀 Search cache available at __searchCache");
}

export default searchResultCache;
