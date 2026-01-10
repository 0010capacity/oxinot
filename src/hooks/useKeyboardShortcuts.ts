import { useEffect } from "react";

export interface KeyboardShortcutHandlers {
  onCommandPalette: () => void;
  onSettings: () => void;
  onHelp: () => void;
}

/**
 * Custom hook to manage global keyboard shortcuts
 * Handles:
 * - Cmd+K / Ctrl+K: Open command palette
 * - Cmd+, / Ctrl+,: Open settings
 * - Cmd+? / Ctrl+?: Open help
 */
export const useKeyboardShortcuts = (handlers: KeyboardShortcutHandlers) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command Palette (Cmd+K or Ctrl+K)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        handlers.onCommandPalette();
      }
      // Settings (Cmd+, or Ctrl+,)
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        handlers.onSettings();
      }
      // Help (Cmd+? or Ctrl+?)
      if ((e.metaKey || e.ctrlKey) && (e.key === "?" || e.key === "/")) {
        e.preventDefault();
        handlers.onHelp();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers]);
};
