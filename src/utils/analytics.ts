import { trackEvent } from "../firebase";
import { useTelemetryStore } from "../stores/telemetryStore";

/**
 * Analytics event categories
 */
export enum AnalyticsCategory {
  BLOCK = "block",
  PAGE = "page",
  SEARCH = "search",
  NAVIGATION = "navigation",
  EDITOR = "editor",
  WORKSPACE = "workspace",
  PERFORMANCE = "performance",
  ERROR = "error",
}

/**
 * Safe analytics tracking that respects user's telemetry preference
 */
export const analytics = {
  /**
   * Track a block creation event
   */
  blockCreated: () => {
    if (!useTelemetryStore.getState().isEnabled) return;
    trackEvent("block_created", {
      timestamp: Date.now(),
    });
  },

  /**
   * Track a block edit event
   */
  blockEdited: () => {
    if (!useTelemetryStore.getState().isEnabled) return;
    trackEvent("block_edited", {
      timestamp: Date.now(),
    });
  },

  /**
   * Track a block deletion event
   */
  blockDeleted: () => {
    if (!useTelemetryStore.getState().isEnabled) return;
    trackEvent("block_deleted", {
      timestamp: Date.now(),
    });
  },

  /**
   * Track a page creation event
   */
  pageCreated: () => {
    if (!useTelemetryStore.getState().isEnabled) return;
    trackEvent("page_created", {
      timestamp: Date.now(),
    });
  },

  /**
   * Track a page deletion event
   */
  pageDeleted: () => {
    if (!useTelemetryStore.getState().isEnabled) return;
    trackEvent("page_deleted", {
      timestamp: Date.now(),
    });
  },

  /**
   * Track a search event
   */
  searchExecuted: (queryLength: number) => {
    if (!useTelemetryStore.getState().isEnabled) return;
    trackEvent("search_executed", {
      queryLength,
      timestamp: Date.now(),
    });
  },

  /**
   * Track a page navigation event
   */
  pageNavigated: () => {
    if (!useTelemetryStore.getState().isEnabled) return;
    trackEvent("page_navigated", {
      timestamp: Date.now(),
    });
  },

  /**
   * Track workspace sync event
   */
  workspaceSynced: (pageCount: number, blockCount: number) => {
    if (!useTelemetryStore.getState().isEnabled) return;
    trackEvent("workspace_synced", {
      pageCount,
      blockCount,
      timestamp: Date.now(),
    });
  },

  /**
   * Track workspace reindex event
   */
  workspaceReindexed: (pageCount: number) => {
    if (!useTelemetryStore.getState().isEnabled) return;
    trackEvent("workspace_reindexed", {
      pageCount,
      timestamp: Date.now(),
    });
  },

  /**
   * Track performance metric
   */
  recordPerformance: (
    metricName: string,
    duration: number,
    metadata?: Record<string, unknown>,
  ) => {
    if (!useTelemetryStore.getState().isEnabled) return;
    trackEvent("performance_metric", {
      metricName,
      duration,
      ...metadata,
      timestamp: Date.now(),
    });
  },

  /**
   * Track an error event
   */
  recordError: (errorMessage: string, context?: string) => {
    if (!useTelemetryStore.getState().isEnabled) return;
    trackEvent("error_occurred", {
      errorMessage,
      context,
      timestamp: Date.now(),
    });
  },

  /**
   * Track session start
   */
  sessionStarted: () => {
    if (!useTelemetryStore.getState().isEnabled) return;
    trackEvent("session_started", {
      timestamp: Date.now(),
      appVersion: import.meta.env.VITE_APP_VERSION || "unknown",
    });
  },

  /**
   * Track session end
   */
  sessionEnded: (duration: number) => {
    if (!useTelemetryStore.getState().isEnabled) return;
    trackEvent("session_ended", {
      duration,
      timestamp: Date.now(),
    });
  },
};
