import type React from "react";
import { useEffect, useState } from "react";
import { cachePrefetcher } from "@/utils/cachePrefetcher";
import "./CachePrefetcherPanel.css";

/**
 * Cache Prefetcher Panel Component
 * Displays prefetching statistics and controls
 */

export const CachePrefetcherPanel: React.FC<{ isOpen?: boolean }> = ({
  isOpen: initialOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [stats, setStats] = useState(cachePrefetcher.getStats());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [config, setConfig] = useState(cachePrefetcher.getConfig());

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        setStats(cachePrefetcher.getStats());
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const handleStart = () => {
    cachePrefetcher.start();
    setStats(cachePrefetcher.getStats());
  };

  const handleStop = () => {
    cachePrefetcher.stop();
    setStats(cachePrefetcher.getStats());
  };

  const handleReset = () => {
    cachePrefetcher.resetStats();
    setStats(cachePrefetcher.getStats());
  };

  const handleConfigChange = (key: string, value: number) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    cachePrefetcher.setConfig(newConfig);
  };

  return (
    <div className="cache-prefetcher-panel">
      <button
        type="button"
        className="cache-prefetcher-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title="Toggle prefetcher statistics"
      >
        📥 Prefetcher ({stats.frequentPages})
      </button>

      {isOpen && (
        <div className="cache-prefetcher-content">
          <div className="prefetcher-header">
            <h3>Cache Prefetcher</h3>
            <span
              className={`status-badge ${
                stats.isMonitoring ? "active" : "inactive"
              }`}
            >
              {stats.isMonitoring ? "🟢 Active" : "🔴 Inactive"}
            </span>
          </div>

          <div className="prefetcher-grid">
            {/* Overview Section */}
            <div className="prefetcher-section">
              <h4>📊 Overview</h4>
              <div className="prefetcher-item">
                <span className="label">Total Pages Tracked</span>
                <span className="value">{stats.totalPages}</span>
              </div>
              <div className="prefetcher-item">
                <span className="label">Frequent Pages</span>
                <span className="value">{stats.frequentPages}</span>
              </div>
            </div>

            {/* Prefetch Stats */}
            <div className="prefetcher-section">
              <h4>📈 Prefetch Stats</h4>
              <div className="prefetcher-item">
                <span className="label">Total Prefetched</span>
                <span className="value">{stats.totalPrefetched}</span>
              </div>
              <div className="prefetcher-item">
                <span className="label">Success Rate</span>
                <span className="value">{stats.successRate.toFixed(1)}%</span>
              </div>
              <div className="prefetcher-item">
                <span className="label">Errors</span>
                <span
                  className={`value ${stats.prefetchErrors > 0 ? "error" : ""}`}
                >
                  {stats.prefetchErrors}
                </span>
              </div>
            </div>
          </div>

          {/* Top Pages */}
          {stats.topPages.length > 0 && (
            <div className="prefetcher-top-pages">
              <h4>🏆 Top Visited Pages</h4>
              <div className="pages-list">
                {stats.topPages.map((page, idx) => (
                  <div key={page.pageId} className="page-entry">
                    <span className="page-rank">#{idx + 1}</span>
                    <span className="page-id" title={page.pageId}>
                      {page.pageId.substring(0, 25)}
                      {page.pageId.length > 25 ? "..." : ""}
                    </span>
                    <span className="page-visits">{page.visits}×</span>
                    {page.prefetched && (
                      <span className="prefetched-badge">📥</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Configuration */}
          <div className="prefetcher-config">
            <h4>⚙️ Configuration</h4>
            <div className="config-item">
              <label htmlFor="min-visits">Min visits to prefetch</label>
              <input
                id="min-visits"
                type="number"
                min={1}
                max={10}
                value={config.minVisitsToPreload}
                onChange={(e) =>
                  handleConfigChange(
                    "minVisitsToPreload",
                    Number.parseInt(e.target.value)
                  )
                }
              />
            </div>
            <div className="config-item">
              <label htmlFor="idle-time">Idle time (ms)</label>
              <input
                id="idle-time"
                type="number"
                min={1000}
                step={500}
                value={config.idleTimeMs}
                onChange={(e) =>
                  handleConfigChange(
                    "idleTimeMs",
                    Number.parseInt(e.target.value)
                  )
                }
              />
            </div>
            <div className="config-item">
              <label htmlFor="max-queue">Max prefetch queue</label>
              <input
                id="max-queue"
                type="number"
                min={1}
                max={10}
                value={config.maxPrefetchQueue}
                onChange={(e) =>
                  handleConfigChange(
                    "maxPrefetchQueue",
                    Number.parseInt(e.target.value)
                  )
                }
              />
            </div>
          </div>

          {/* Controls */}
          <div className="prefetcher-controls">
            <label className="prefetcher-checkbox">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh
            </label>
            {!stats.isMonitoring ? (
              <button
                type="button"
                onClick={handleStart}
                className="btn-primary"
              >
                ▶️ Start
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStop}
                className="btn-secondary"
              >
                ⏹️ Stop
              </button>
            )}
            <button
              type="button"
              onClick={handleReset}
              className="btn-secondary"
            >
              🔄 Reset
            </button>
          </div>

          <div className="prefetcher-footer">
            <p>
              💡 Access via console with <code>__cachePrefetcher</code>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CachePrefetcherPanel;
