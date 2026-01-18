import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Shortcut {
  id: string;
  key: string;
  metaKey?: boolean; // Cmd on Mac, Windows key on Windows (usually not used for shortcuts)
  ctrlKey?: boolean; // Ctrl on Mac/Windows
  shiftKey?: boolean;
  altKey?: boolean; // Option on Mac, Alt on Windows
  modKey?: boolean; // Cmd on Mac, Ctrl on Windows (Special logical modifier)
}

export interface ShortcutStore {
  shortcuts: Record<string, Shortcut>;
  updateShortcut: (id: string, shortcut: Partial<Shortcut>) => void;
  resetShortcuts: () => void;
  getShortcut: (id: string) => Shortcut;
}

export const DEFAULT_SHORTCUTS: Record<string, Shortcut> = {
  command_palette: { id: "command_palette", key: "k", modKey: true },
  settings: { id: "settings", key: ",", modKey: true },
  help: { id: "help", key: "?", modKey: true },
  search: { id: "search", key: "p", modKey: true },
  toggle_index: { id: "toggle_index", key: "\\", modKey: true },
  undo: { id: "undo", key: "z", modKey: true },
  redo: { id: "redo", key: "z", modKey: true, shiftKey: true },
};

export const useShortcutStore = create<ShortcutStore>()(
  persist(
    (set, get) => ({
      shortcuts: DEFAULT_SHORTCUTS,
      updateShortcut: (id, newShortcut) =>
        set((state) => ({
          shortcuts: {
            ...state.shortcuts,
            [id]: { ...state.shortcuts[id], ...newShortcut },
          },
        })),
      resetShortcuts: () => set({ shortcuts: DEFAULT_SHORTCUTS }),
      getShortcut: (id) => get().shortcuts[id] || DEFAULT_SHORTCUTS[id],
    }),
    {
      name: "shortcut-storage",
    },
  ),
);
