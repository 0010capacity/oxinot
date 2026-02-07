import type React from "react";
import { useEffect, useState } from "react";
import { searchResultCache } from "@/utils/searchResultCache";
import "./SearchCachePanel.css";

/**
 * Search Cache Panel Component
 * Displays search caching statistics and controls
 */

export const SearchCachePanel: React.FC<{ isOpen?: boolean }> = ({
  isOpen: initialOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [stats, setStats] = useState(searchResultCache.getStats());
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        setStats(searchResultCache.getStats());
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const handleClear = () => {
    if (window.confirm("Clear all cached search results?")) {
      searchResultCache.clear();
      setStats(searchResultCache.getStats());
    }
  };

  const handleReset = () => {
    searchResultCache.resetStats();
    setStats(searchResultCache.getStats());
  };

  const hitRateColor =
    stats.hitRate > 70 ? "good" : stats.hitRate > 40 ? "ok" : "poor";

  return (
    <div className="search-cache-panel">
      <button
        type="button"
        className="search-cache-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title="Toggle search cache statistics"
      >
        🔍 Search Cache ({stats.hitRate.toFixed(0)}%)
      </button>

      {isOpen && (
        <div className="search-cache-content">
          <div className="cache-header">
            <h3>Search Cache</h3>
          </div>

          <div className="cache-grid">
            {/* Capacity Section */}
            <div className="cache-section">
              <h4>📦 Capacity</h4>
              <div className="cache-item">
                <span className="label">Cached Queries</span>
                <span className="value">
                  {stats.size} / {stats.capacity}
                </span>
              </div>
              <div className="cache-bar">
                <div
                  className="cache-fill"
                  style={{
                    width: `${(stats.size / stats.capacity) * 100}%`,
                  }}
                />
              </div>
              <div className="cache-item">
                <span className="label">Avg Results</span>
                <span className="value">
                  {stats.avgResultsPerQuery.toFixed(1)}
                </span>
              </div>
            </div>

            {/* Performance Section */}
            <div className="cache-section">
              <h4>⚡ Performance</h4>
              <div className="cache-item">
                <span className="label">Hit Rate</span>
                <span className={`value rate-${hitRateColor}`}>
                  {stats.hitRate.toFixed(1)}%
                </span>
              </div>
              <div className="cache-item">
                <span className="label">Total Queries</span>
                <span className="value">{stats.totalQueries}</span>
              </div>
              <div className="cache-item">
                <span className="label">Hits / Misses</span>
                <span className="value">
                  {stats.hits} / {stats.misses}
                </span>
              </div>
            </div>
          </div>

          {/* Recent Queries */}
          {stats.recentQueries.length > 0 && (
            <div className="cache-recent">
              <h4>🔎 Recent Queries</h4>
              <div className="query-list">
                {stats.recentQueries.map((query, idx) => (
                  <div key={query} className="query-item">
                    <span className="query-index">#{idx + 1}</span>
                    <span className="query-text">{query}</span>
                    <button
                      type="button"
                      className="query-invalidate"
                      onClick={() => {
                        searchResultCache.invalidate(query);
                        setStats(searchResultCache.getStats());
                      }}
                      title="Remove this query from cache"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="cache-controls">
            <label className="cache-checkbox">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh
            </label>
            <button
              type="button"
              onClick={handleReset}
              className="btn-secondary"
            >
              🔄 Reset Stats
            </button>
            <button type="button" onClick={handleClear} className="btn-danger">
              🗑️ Clear Cache
            </button>
          </div>

          <div className="cache-footer">
            <p>
              💡 Access via console with <code>__searchCache</code>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchCachePanel;
