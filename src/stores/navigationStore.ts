import { immer } from "zustand/middleware/immer";
import { createWithEqualityFn } from "zustand/traditional";

// ============ Types ============

export interface NavigationEntry {
  pageId: string;
  pageTitle: string;
  timestamp: number;
}

interface NavigationState {
  history: NavigationEntry[];
  currentIndex: number;
  maxHistorySize: number;
  isNavigating: boolean;
}

interface NavigationActions {
  pushHistory: (pageId: string, pageTitle: string) => void;
  goBack: () => NavigationEntry | null;
  goForward: () => NavigationEntry | null;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  clearHistory: () => void;
  getCurrentEntry: () => NavigationEntry | null;
}

type NavigationStore = NavigationState & NavigationActions;

// ============ Store Implementation ============

const MAX_HISTORY_SIZE = 50;

export const useNavigationStore = createWithEqualityFn<NavigationStore>()(
  immer((set, get) => ({
    // Initial State
    history: [],
    currentIndex: -1,
    maxHistorySize: MAX_HISTORY_SIZE,
    isNavigating: false,

    // ============ Navigation Operations ============

    pushHistory: (pageId: string, pageTitle: string) => {
      set((state) => {
        // Don't add to history if we're navigating through history
        if (state.isNavigating) {
          return;
        }

        const currentEntry = state.history[state.currentIndex];

        // Don't add duplicate consecutive entries
        if (currentEntry && currentEntry.pageId === pageId) {
          return;
        }

        // Remove any forward history when pushing new entry
        if (state.currentIndex < state.history.length - 1) {
          state.history = state.history.slice(0, state.currentIndex + 1);
        }

        // Add new entry
        state.history.push({
          pageId,
          pageTitle,
          timestamp: Date.now(),
        });

        // Limit history size
        if (state.history.length > state.maxHistorySize) {
          state.history = state.history.slice(-state.maxHistorySize);
        }

        state.currentIndex = state.history.length - 1;
      });
    },

    goBack: () => {
      const state = get();

      if (!state.canGoBack()) {
        return null;
      }

      const newIndex = state.currentIndex - 1;
      const entry = state.history[newIndex];

      set((draft) => {
        draft.currentIndex = newIndex;
        draft.isNavigating = true;
      });

      // Reset isNavigating after a short delay
      setTimeout(() => {
        set((draft) => {
          draft.isNavigating = false;
        });
      }, 100);

      return entry;
    },

    goForward: () => {
      const state = get();

      if (!state.canGoForward()) {
        return null;
      }

      const newIndex = state.currentIndex + 1;
      const entry = state.history[newIndex];

      set((draft) => {
        draft.currentIndex = newIndex;
        draft.isNavigating = true;
      });

      // Reset isNavigating after a short delay
      setTimeout(() => {
        set((draft) => {
          draft.isNavigating = false;
        });
      }, 100);

      return entry;
    },

    canGoBack: () => {
      const state = get();
      return state.currentIndex > 0;
    },

    canGoForward: () => {
      const state = get();
      return state.currentIndex < state.history.length - 1;
    },

    clearHistory: () => {
      set((state) => {
        state.history = [];
        state.currentIndex = -1;
        state.isNavigating = false;
      });
    },

    getCurrentEntry: () => {
      const state = get();
      if (
        state.currentIndex >= 0 &&
        state.currentIndex < state.history.length
      ) {
        return state.history[state.currentIndex];
      }
      return null;
    },
  })),
);

// ============ Selector Hooks ============

export const useCanGoBack = () =>
  useNavigationStore((state) => state.canGoBack());

export const useCanGoForward = () =>
  useNavigationStore((state) => state.canGoForward());

export const useNavigationHistory = () =>
  useNavigationStore((state) => state.history);

export const useCurrentNavigationIndex = () =>
  useNavigationStore((state) => state.currentIndex);
