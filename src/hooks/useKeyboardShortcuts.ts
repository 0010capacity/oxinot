import { useEffect } from "react";
import { useShortcutStore, type Shortcut } from "../stores/shortcutStore";

export interface KeyboardShortcutHandlers {
  onCommandPalette?: () => void;
  onSettings?: () => void;
  onHelp?: () => void;
  onSearch?: () => void;
  onNewPage?: () => void;
  onGoHome?: () => void;
  onGraphView?: () => void;
  onToggleIndex?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

const isShortcutMatch = (e: KeyboardEvent, shortcut: Shortcut | undefined) => {
  // Guard against undefined or missing key property
  if (!shortcut || !shortcut.key) {
    return false;
  }

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
      if (
        handlers.onCommandPalette &&
        isShortcutMatch(e, shortcuts.command_palette)
      ) {
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
      // New Page
      if (
        handlers.onNewPage &&
        (shortcuts.new_page
          ? isShortcutMatch(e, shortcuts.new_page)
          : isShortcutMatch(e, { id: "new_page", key: "n", modKey: true }))
      ) {
        e.preventDefault();
        handlers.onNewPage();
      }
      // Go Home
      if (
        handlers.onGoHome &&
        (shortcuts.go_home
          ? isShortcutMatch(e, shortcuts.go_home)
          : isShortcutMatch(e, {
              id: "go_home",
              key: "h",
              modKey: true,
              shiftKey: true,
            }))
      ) {
        e.preventDefault();
        handlers.onGoHome();
      }
      // Graph View
      if (
        handlers.onGraphView &&
        (shortcuts.graph_view
          ? isShortcutMatch(e, shortcuts.graph_view)
          : isShortcutMatch(e, { id: "graph_view", key: "g", modKey: true }))
      ) {
        e.preventDefault();
        handlers.onGraphView();
      }
      // Toggle Index
      if (
        handlers.onToggleIndex &&
        isShortcutMatch(e, shortcuts.toggle_index)
      ) {
        e.preventDefault();
        handlers.onToggleIndex();
      }
      // Undo
      if (handlers.onUndo && isShortcutMatch(e, shortcuts.undo)) {
        e.preventDefault();
        handlers.onUndo();
      }
      // Redo
      if (handlers.onRedo && isShortcutMatch(e, shortcuts.redo)) {
        e.preventDefault();
        handlers.onRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers, shortcuts]);
};
