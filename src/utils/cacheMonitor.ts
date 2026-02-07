/**
 * Cache Monitoring Utility (Deprecated)
 * This module is no longer used as page caching has been removed.
 * All pages are now loaded directly from the backend for consistency.
 */

export const cacheMonitor = {
  start: () => console.log("[cacheMonitor] Deprecated - caching removed"),
  stop: () => {},
  getReport: () => "Cache monitoring disabled",
  getStatus: () => ({ isMonitoring: false, hasStats: false, stats: null }),
  reset: () => {},
  clear: () => {},
  print: () => {},
  isEnabled: () => false,
  setEnabled: () => {},
  setAutoUpdate: () => {},
  getStats: () => null,
};

export default cacheMonitor;
