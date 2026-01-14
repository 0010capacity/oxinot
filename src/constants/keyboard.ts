/**
 * Keyboard shortcuts and key codes
 * Centralized keyboard constants for consistent keybinding across the app
 */

/**
 * Key codes for special keys
 */
export const KEY_CODES = {
  ENTER: "Enter",
  ESCAPE: "Escape",
  TAB: "Tab",
  SPACE: " ",
  BACKSPACE: "Backspace",
  DELETE: "Delete",
  ARROW_UP: "ArrowUp",
  ARROW_DOWN: "ArrowDown",
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT: "ArrowRight",
  HOME: "Home",
  END: "End",
  PAGE_UP: "PageUp",
  PAGE_DOWN: "PageDown",
} as const;

/**
 * Modifier key names
 */
export const MODIFIER_KEYS = {
  CTRL: "Control",
  ALT: "Alt",
  SHIFT: "Shift",
  META: "Meta", // Cmd on Mac, Windows key on Windows
} as const;

/**
 * Check if running on Mac
 */
export const IS_MAC =
  typeof window !== "undefined" &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform);

/**
 * Primary modifier key (Cmd on Mac, Ctrl on others)
 */
export const PRIMARY_MODIFIER = IS_MAC
  ? MODIFIER_KEYS.META
  : MODIFIER_KEYS.CTRL;

/**
 * Secondary modifier key (Ctrl on Mac, Alt on others)
 */
export const SECONDARY_MODIFIER = IS_MAC
  ? MODIFIER_KEYS.CTRL
  : MODIFIER_KEYS.ALT;

/**
 * Block editor keyboard shortcuts
 */
export const BLOCK_SHORTCUTS = {
  /** Create new block below */
  NEW_BLOCK: { key: KEY_CODES.ENTER },

  /** Delete current block */
  DELETE_BLOCK: { key: KEY_CODES.BACKSPACE, condition: "empty" },

  /** Indent block */
  INDENT: { key: KEY_CODES.TAB },

  /** Outdent block */
  OUTDENT: { key: KEY_CODES.TAB, shift: true },

  /** Move to previous block */
  MOVE_UP: { key: KEY_CODES.ARROW_UP },

  /** Move to next block */
  MOVE_DOWN: { key: KEY_CODES.ARROW_DOWN },

  /** Toggle collapse */
  TOGGLE_COLLAPSE: { key: KEY_CODES.ARROW_LEFT, condition: "atStart" },

  /** Expand block */
  EXPAND: { key: KEY_CODES.ARROW_RIGHT, condition: "atStartCollapsed" },

  /** Save current block */
  SAVE: { key: "s", [PRIMARY_MODIFIER]: true },

  /** Toggle bold */
  BOLD: { key: "b", [PRIMARY_MODIFIER]: true },

  /** Toggle italic */
  ITALIC: { key: "i", [PRIMARY_MODIFIER]: true },

  /** Toggle code */
  CODE: { key: "e", [PRIMARY_MODIFIER]: true },

  /** Insert link */
  LINK: { key: "k", [PRIMARY_MODIFIER]: true },
} as const;

/**
 * Global keyboard shortcuts
 */
export const GLOBAL_SHORTCUTS = {
  /** Open command palette */
  COMMAND_PALETTE: { key: "p", [PRIMARY_MODIFIER]: true, shift: true },

  /** Quick search */
  SEARCH: { key: "f", [PRIMARY_MODIFIER]: true },

  /** New page */
  NEW_PAGE: { key: "n", [PRIMARY_MODIFIER]: true },

  /** Toggle sidebar */
  TOGGLE_SIDEBAR: { key: "b", [PRIMARY_MODIFIER]: true, shift: true },

  /** Open settings */
  SETTINGS: { key: ",", [PRIMARY_MODIFIER]: true },

  /** Toggle theme */
  TOGGLE_THEME: { key: "d", [PRIMARY_MODIFIER]: true, shift: true },

  /** Close current view */
  CLOSE: { key: "w", [PRIMARY_MODIFIER]: true },

  /** Undo */
  UNDO: { key: "z", [PRIMARY_MODIFIER]: true },

  /** Redo */
  REDO: IS_MAC
    ? { key: "z", [PRIMARY_MODIFIER]: true, shift: true }
    : { key: "y", [PRIMARY_MODIFIER]: true },

  /** Select all */
  SELECT_ALL: { key: "a", [PRIMARY_MODIFIER]: true },

  /** Copy */
  COPY: { key: "c", [PRIMARY_MODIFIER]: true },

  /** Cut */
  CUT: { key: "x", [PRIMARY_MODIFIER]: true },

  /** Paste */
  PASTE: { key: "v", [PRIMARY_MODIFIER]: true },

  /** Find */
  FIND: { key: "f", [PRIMARY_MODIFIER]: true },

  /** Replace */
  REPLACE: { key: "h", [PRIMARY_MODIFIER]: true },
} as const;

/**
 * Editor keyboard shortcuts
 */
export const EDITOR_SHORTCUTS = {
  /** Toggle preview mode */
  TOGGLE_PREVIEW: { key: "e", [PRIMARY_MODIFIER]: true, shift: true },

  /** Format document */
  FORMAT: { key: "s", [PRIMARY_MODIFIER]: true, shift: true },

  /** Insert code block */
  CODE_BLOCK: { key: "k", [PRIMARY_MODIFIER]: true, shift: true },

  /** Insert heading */
  HEADING: { key: "h", [PRIMARY_MODIFIER]: true, alt: true },

  /** Insert list */
  LIST: { key: "l", [PRIMARY_MODIFIER]: true, alt: true },

  /** Insert quote */
  QUOTE: { key: "q", [PRIMARY_MODIFIER]: true, alt: true },
} as const;

/**
 * Helper function to check if a keyboard event matches a shortcut
 */
export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: {
    key: string;
    Control?: boolean;
    Alt?: boolean;
    Shift?: boolean;
    Meta?: boolean;
    shift?: boolean;
    alt?: boolean;
  // allow any for dynamic modifier keys
  [key: string]: boolean | string | undefined;
  },
): boolean {
  const key = event.key.toLowerCase();
  const shortcutKey = shortcut.key.toLowerCase();

  if (key !== shortcutKey) return false;

  // Check modifier keys
  const ctrlPressed = event.ctrlKey;
  const altPressed = event.altKey;
  const shiftPressed = event.shiftKey;
  const metaPressed = event.metaKey;

  const ctrlRequired =
    shortcut.Control === true ||
    (shortcut[PRIMARY_MODIFIER] === true &&
      PRIMARY_MODIFIER === MODIFIER_KEYS.CTRL);
  const altRequired = shortcut.Alt === true || shortcut.alt === true;
  const shiftRequired = shortcut.Shift === true || shortcut.shift === true;
  const metaRequired =
    shortcut.Meta === true ||
    (shortcut[PRIMARY_MODIFIER] === true &&
      PRIMARY_MODIFIER === MODIFIER_KEYS.META);

  // All modifiers must match
  if (ctrlRequired && !ctrlPressed) return false;
  if (!ctrlRequired && ctrlPressed && key.length === 1) return false;

  if (altRequired && !altPressed) return false;
  if (!altRequired && altPressed && key.length === 1) return false;

  if (shiftRequired && !shiftPressed) return false;
  if (!shiftRequired && shiftPressed && key.length === 1) return false;

  if (metaRequired && !metaPressed) return false;
  if (!metaRequired && metaPressed && key.length === 1) return false;

  return true;
}

/**
 * Format shortcut for display
 */
export function formatShortcut(shortcut: {
  key: string;
  // allow any for dynamic modifier keys
  [key: string]: boolean | string | undefined;
}): string {
  const parts: string[] = [];

  if (shortcut[PRIMARY_MODIFIER]) {
    parts.push(IS_MAC ? "⌘" : "Ctrl");
  }
  if (shortcut.Control && !shortcut[PRIMARY_MODIFIER]) {
    parts.push(IS_MAC ? "⌃" : "Ctrl");
  }
  if (shortcut.Alt || shortcut.alt) {
    parts.push(IS_MAC ? "⌥" : "Alt");
  }
  if (shortcut.Shift || shortcut.shift) {
    parts.push(IS_MAC ? "⇧" : "Shift");
  }

  parts.push(shortcut.key.toUpperCase());

  return parts.join(IS_MAC ? "" : "+");
}

/**
 * Common key combinations for quick reference
 */
export const KEY_COMBINATIONS = {
  MOD_ENTER: { key: KEY_CODES.ENTER, [PRIMARY_MODIFIER]: true },
  MOD_SHIFT_ENTER: {
    key: KEY_CODES.ENTER,
    [PRIMARY_MODIFIER]: true,
    shift: true,
  },
  SHIFT_ENTER: { key: KEY_CODES.ENTER, shift: true },
  MOD_BACKSPACE: { key: KEY_CODES.BACKSPACE, [PRIMARY_MODIFIER]: true },
  ALT_ARROW_UP: { key: KEY_CODES.ARROW_UP, alt: true },
  ALT_ARROW_DOWN: { key: KEY_CODES.ARROW_DOWN, alt: true },
  MOD_ALT_ARROW_UP: {
    key: KEY_CODES.ARROW_UP,
    [PRIMARY_MODIFIER]: true,
    alt: true,
  },
  MOD_ALT_ARROW_DOWN: {
    key: KEY_CODES.ARROW_DOWN,
    [PRIMARY_MODIFIER]: true,
    alt: true,
  },
} as const;
