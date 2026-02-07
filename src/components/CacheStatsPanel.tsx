import type React from "react";
import { useEffect, useState } from "react";
import { useCacheStatsStore } from "@/stores/cacheStatsStore";
import { cacheMonitor } from "@/utils/cacheMonitor";
import "./CacheStatsPanel.css";

/**
 * Cache Statistics Panel Component
 * Displays real-time cache performance metrics
 *
 * Usage:
 *   <CacheStatsPanel />
 */

export const CacheStatsPanel: React.FC<{ isOpen?: boolean }> = ({
  isOpen: initialOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const stats = useCacheStatsStore((state) => state.stats);
  const lastUpdated = useCacheStatsStore((state) => state.lastUpdated);

  // Start monitoring on mount
  useEffect(() => {
    if (!cacheMonitor.isEnabled()) {
      cacheMonitor.setEnabled(true);
    }
    if (autoRefresh && !cacheMonitor.getStatus().isMonitoring) {
      cacheMonitor.start(2000); // Refresh every 2 seconds
    }

    return () => {
      // Cleanup if needed
    };
  }, [autoRefresh]);

  const handleReset = () => {
    cacheMonitor.reset();
  };

  const handleClear = () => {
    if (window.confirm("Clear cache? This will remove all cached pages.")) {
      cacheMonitor.clear();
    }
  };

  const handleRefresh = () => {
    cacheMonitor.refresh();
  };

  if (!stats) {
    return (
      <div className="cache-stats-panel">
        <button
          type="button"
          className="cache-stats-toggle"
          onClick={() => setIsOpen(!isOpen)}
          title="Toggle cache statistics"
        >
          📊 Cache Stats
        </button>
        {isOpen && (
          <div className="cache-stats-content">
            <p className="cache-stats-empty">
              No statistics available. Starting monitor...
            </p>
            <button type="button" onClick={handleRefresh}>
              Refresh
            </button>
          </div>
        )}
      </div>
    );
  }

  const fullPercent = ((stats.size / stats.capacity) * 100).toFixed(1);
  const timeAgo = lastUpdated
    ? `${((Date.now() - lastUpdated) / 1000).toFixed(1)}s ago`
    : "unknown";

  return (
    <div className="cache-stats-panel">
      <button
        type="button"
        className="cache-stats-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title="Toggle cache statistics"
      >
        📊 Cache {stats.hitRate.toFixed(0)}% ({stats.size}/{stats.capacity})
      </button>

      {isOpen && (
        <div className="cache-stats-content">
          <div className="cache-stats-header">
            <h3>Cache Statistics</h3>
            <span className="cache-stats-time">Updated {timeAgo}</span>
          </div>

          <div className="cache-stats-grid">
            {/* Capacity Section */}
            <div className="cache-stats-section">
              <h4>📦 Capacity</h4>
              <div className="cache-stats-item">
                <span className="label">Entries</span>
                <span className="value">
                  {stats.size} / {stats.capacity} ({fullPercent}%)
                </span>
              </div>
              <div className="cache-stats-bar">
                <div
                  className="cache-stats-fill"
                  style={{
                    width: `${fullPercent}%`,
                  }}
                />
              </div>
              <div className="cache-stats-item">
                <span className="label">Memory</span>
                <span className="value">
                  {(stats.totalMemoryBytes / 1024).toFixed(2)}KB
                </span>
              </div>
            </div>

            {/* Performance Section */}
            <div className="cache-stats-section">
              <h4>⚡ Performance</h4>
              <div className="cache-stats-item">
                <span className="label">Hit Rate</span>
                <span className="value">{stats.hitRate.toFixed(1)}%</span>
              </div>
              <div className="cache-stats-item">
                <span className="label">Hits / Misses</span>
                <span className="value">
                  {stats.hits} / {stats.misses}
                </span>
              </div>
              <div className="cache-stats-item">
                <span className="label">Avg Load</span>
                <span className="value">{stats.avgLoadTime.toFixed(2)}ms</span>
              </div>
            </div>

            {/* Events Section */}
            <div className="cache-stats-section">
              <h4>🔄 Events</h4>
              <div className="cache-stats-item">
                <span className="label">Evictions</span>
                <span className="value">{stats.evictions}</span>
              </div>
              <div className="cache-stats-item">
                <span className="label">TTL Expiries</span>
                <span className="value">{stats.ttlExpirations}</span>
              </div>
              <div className="cache-stats-item">
                <span className="label">Invalidations</span>
                <span className="value">{stats.invalidations}</span>
              </div>
            </div>

            {/* Age Section */}
            <div className="cache-stats-section">
              <h4>⏱️ Entry Ages</h4>
              <div className="cache-stats-item">
                <span className="label">Oldest</span>
                <span className="value">
                  {(stats.oldestPageAge / 1000).toFixed(1)}s ago
                </span>
              </div>
              <div className="cache-stats-item">
                <span className="label">Newest</span>
                <span className="value">
                  {(stats.newestPageAge / 1000).toFixed(1)}s ago
                </span>
              </div>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="cache-stats-controls">
            <label className="cache-stats-checkbox">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => {
                  setAutoRefresh(e.target.checked);
                  cacheMonitor.setAutoUpdate(e.target.checked);
                }}
              />
              Auto-refresh
            </label>
            <button
              type="button"
              onClick={handleRefresh}
              className="btn-secondary"
            >
              🔄 Refresh
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="btn-secondary"
            >
              🔁 Reset Stats
            </button>
            <button type="button" onClick={handleClear} className="btn-danger">
              🗑️ Clear Cache
            </button>
          </div>

          <div className="cache-stats-footer">
            <p>
              💡 Tip: Access via console with <code>__cacheMonitor</code>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CacheStatsPanel;
