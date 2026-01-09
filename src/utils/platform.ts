/**
 * Platform detection utilities
 */

/**
 * Detects if the current platform is macOS
 */
export function isMacOS(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();
  return platform.includes("mac") || userAgent.includes("mac");
}

/**
 * Detects if the current platform is Windows
 */
export function isWindows(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();
  return platform.includes("win") || userAgent.includes("win");
}

/**
 * Detects if the current platform is Linux
 */
export function isLinux(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();
  return (
    platform.includes("linux") ||
    userAgent.includes("linux") ||
    platform.includes("x11")
  );
}

/**
 * Gets the current platform name
 */
export function getPlatform(): "macos" | "windows" | "linux" | "unknown" {
  if (isMacOS()) return "macos";
  if (isWindows()) return "windows";
  if (isLinux()) return "linux";
  return "unknown";
}
