import { useEffect } from "react";
import { useShortcutStore, type Shortcut } from "../stores/shortcutStore";

export interface KeyboardShortcutHandlers {
  onCommandPalette?: () => void;
  onSettings?: () => void;
  onHelp?: () => void;
  onSearch?: () => void;
  onToggleIndex?: () => void;
}

const isShortcutMatch = (e: KeyboardEvent, shortcut: Shortcut) => {
  const isMod = e.metaKey || e.ctrlKey;

  // Check key (case-insensitive)
  if (e.key.toLowerCase() !== shortcut.key.toLowerCase()) {
    // Special case for '?' and '/'
    if (
      (shortcut.key === "?" && e.key === "/") ||
      (shortcut.key === "/" && e.key === "?")
    ) {
      // Allow match if modifiers match
    } else {
      return false;
    }
  }

  // Check modifiers
  // 1. Mod key (Cmd/Ctrl)
  if (shortcut.modKey && !isMod) return false;
  if (!shortcut.modKey && isMod && !shortcut.ctrlKey && !shortcut.metaKey)
    return false; // Prevent accidental trigger if Mod is pressed but not required

  // 2. Shift
  if (!!shortcut.shiftKey !== e.shiftKey) return false;

  // 3. Alt/Option
  if (!!shortcut.altKey !== e.altKey) return false;

  return true;
};

/**
 * Custom hook to manage global keyboard shortcuts
 */
export const useKeyboardShortcuts = (handlers: KeyboardShortcutHandlers) => {
  const shortcuts = useShortcutStore((state) => state.shortcuts);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command Palette
      if (handlers.onCommandPalette && isShortcutMatch(e, shortcuts.command_palette)) {
        e.preventDefault();
        handlers.onCommandPalette();
      }
      // Settings
      if (handlers.onSettings && isShortcutMatch(e, shortcuts.settings)) {
        e.preventDefault();
        handlers.onSettings();
      }
      // Help
      if (handlers.onHelp && isShortcutMatch(e, shortcuts.help)) {
        e.preventDefault();
        handlers.onHelp();
      }
      // Search
      if (handlers.onSearch && isShortcutMatch(e, shortcuts.search)) {
        e.preventDefault();
        handlers.onSearch();
      }
      // Toggle Index
      if (handlers.onToggleIndex && isShortcutMatch(e, shortcuts.toggle_index)) {
        e.preventDefault();
        handlers.onToggleIndex();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers, shortcuts]);
};
