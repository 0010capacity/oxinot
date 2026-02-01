/**
 * React Hook for Search Result Caching
 * Provides a convenient way to use cached search in React components
 */

import { useCallback, useEffect, useState } from "react";
import { searchResultCache } from "@/utils/searchResultCache";

interface SearchResult {
  id: string;
  page_id: string;
  page_title: string;
  result_type: "page" | "block";
  content: string;
  snippet: string;
}

interface UseSearchCacheOptions {
  enableCache?: boolean; // Enable caching (default: true)
}

export function useSearchCache(options: UseSearchCacheOptions = {}) {
  const { enableCache = true } = options;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performSearch = useCallback(
    async (searchQuery: string, workspacePath: string) => {
      if (!searchQuery.trim() || !workspacePath) {
        setResults([]);
        return;
      }

      setIsSearching(true);
      setError(null);

      try {
        const searchResults = enableCache
          ? await searchResultCache.search(workspacePath, searchQuery)
          : await searchResultCache.search(workspacePath, searchQuery); // Still cached for now

        setResults(searchResults);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Search failed";
        setError(errorMessage);
        setResults([]);
        console.error("[useSearchCache] Error:", err);
      } finally {
        setIsSearching(false);
      }
    },
    [enableCache],
  );

  return {
    query,
    setQuery,
    results,
    isSearching,
    error,
    performSearch,
    clearResults: () => setResults([]),
  };
}

/**
 * Hook for managing search cache statistics
 */
export function useSearchCacheStats() {
  const [stats, setStats] = useState(searchResultCache.getStats());
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setStats(searchResultCache.getStats());
    }, 2000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  return {
    stats,
    autoRefresh,
    setAutoRefresh,
    refreshStats: () => setStats(searchResultCache.getStats()),
    clearCache: () => {
      searchResultCache.clear();
      setStats(searchResultCache.getStats());
    },
    resetStats: () => {
      searchResultCache.resetStats();
      setStats(searchResultCache.getStats());
    },
  };
}

export default useSearchCache;
