/**
 * Debug utility for conditional logging
 */

/**
 * Enable debug mode by setting this to true or via localStorage
 */
const DEBUG_KEY = "md-editor:debug";

/**
 * Check if debug mode is enabled
 */
export function isDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return localStorage.getItem(DEBUG_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Enable debug mode
 */
export function enableDebug(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(DEBUG_KEY, "true");
    console.log("[Debug] Debug mode enabled");
  } catch {
    console.warn("[Debug] Could not enable debug mode");
  }
}

/**
 * Disable debug mode
 */
export function disableDebug(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(DEBUG_KEY);
    console.log("[Debug] Debug mode disabled");
  } catch {
    console.warn("[Debug] Could not disable debug mode");
  }
}

/**
 * Debug logger that only logs when debug mode is enabled
 */
export const debug = {
  log: (...args: unknown[]) => {
    if (isDebugEnabled()) {
      console.log("[Debug]", ...args);
    }
  },

  warn: (...args: unknown[]) => {
    if (isDebugEnabled()) {
      console.warn("[Debug]", ...args);
    }
  },

  error: (...args: unknown[]) => {
    if (isDebugEnabled()) {
      console.error("[Debug]", ...args);
    }
  },

  group: (label: string) => {
    if (isDebugEnabled()) {
      console.group(`[Debug] ${label}`);
    }
  },

  groupEnd: () => {
    if (isDebugEnabled()) {
      console.groupEnd();
    }
  },
};

// Expose debug controls to window for easy access in console
if (typeof window !== "undefined") {
  (window as Window & { mdEditorDebug?: unknown }).mdEditorDebug = {
    enable: enableDebug,
    disable: disableDebug,
    isEnabled: isDebugEnabled,
  };
}
