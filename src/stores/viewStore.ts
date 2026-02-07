import { immer } from "zustand/middleware/immer";
import { createWithEqualityFn } from "zustand/traditional";
import { useNavigationStore } from "./navigationStore";
import { usePageStore } from "./pageStore";

// View modes
type ViewMode = "index" | "note";

// Navigation state
interface NavigationState {
  mode: ViewMode;
  currentNotePath: string | null;
  workspaceName: string | null;
  focusedBlockId: string | null;
  zoomPath: string[];
  breadcrumb: string[];
  pagePathIds: string[];
  zoomByPageId: Record<string, string[]>;
}

interface ViewState extends NavigationState {
  showIndex: () => void;
  showPage: (pageId: string) => void;
  openNote: (
    notePath: string,
    noteName: string,
    parentNames?: string[],
    pagePathIds?: string[],
  ) => void;
  zoomToBlock: (blockId: string) => void;
  zoomOutToIndex: (index: number) => void;
  clearZoom: () => void;
  setFocusedBlockId: (blockId: string | null) => void;
  zoomOut: () => void;
  zoomOutToNote: () => void;
  goBack: () => void;
  setWorkspaceName: (name: string) => void;
  reset: () => void;
}

const initialState: NavigationState = {
  mode: "index",
  currentNotePath: null,
  workspaceName: null,
  focusedBlockId: null,
  zoomPath: [],
  breadcrumb: [],
  pagePathIds: [],
  zoomByPageId: {},
};

export const useViewStore = createWithEqualityFn<ViewState>()(
  immer((set) => ({
    ...initialState,

    showIndex: () => {
      set((state) => {
        if (state.currentNotePath && state.zoomPath.length > 0) {
          state.zoomByPageId[state.currentNotePath] = state.zoomPath;
        }
        state.mode = "index";
        state.currentNotePath = null;
        state.focusedBlockId = null;
        state.zoomPath = [];
        state.breadcrumb = state.workspaceName ? [state.workspaceName] : [];
        state.pagePathIds = [];
      });
    },

    showPage: (pageId: string) => {
      set((state) => {
        state.mode = "note";
        state.currentNotePath = pageId;
        state.focusedBlockId = null;
        const savedZoom = state.zoomByPageId[pageId] || [];
        state.zoomPath = savedZoom;
      });

      const page = usePageStore.getState().pagesById[pageId];
      if (page) {
        useNavigationStore.getState().pushHistory(pageId, page.title);
      }
    },

    openNote: (
      notePath: string,
      noteName: string,
      parentNames?: string[],
      pagePathIds?: string[],
    ) => {
      set((state) => {
        state.mode = "note";
        state.currentNotePath = notePath;
        state.focusedBlockId = null;
        const savedZoom = state.zoomByPageId[notePath] || [];
        state.zoomPath = savedZoom;

        const crumbs: string[] = [];
        if (state.workspaceName) {
          crumbs.push(state.workspaceName);
        }
        if (parentNames && parentNames.length > 0) {
          crumbs.push(...parentNames);
        }
        crumbs.push(noteName);

        state.breadcrumb = crumbs;
        state.pagePathIds = pagePathIds || [];
      });

      useNavigationStore.getState().pushHistory(notePath, noteName);
    },

    zoomToBlock: (blockId: string) => {
      set((state) => {
        state.focusedBlockId = blockId;
        if (!state.zoomPath.includes(blockId)) {
          state.zoomPath.push(blockId);
        }
        if (state.currentNotePath) {
          state.zoomByPageId[state.currentNotePath] = state.zoomPath;
        }
      });
    },

    zoomOutToIndex: (index: number) => {
      set((state) => {
        const newPath = state.zoomPath.slice(0, index + 1);
        state.zoomPath = newPath;
        state.focusedBlockId =
          newPath.length > 0 ? newPath[newPath.length - 1] : null;
        if (state.currentNotePath) {
          state.zoomByPageId[state.currentNotePath] = state.zoomPath;
        }
      });
    },

    clearZoom: () => {
      set((state) => {
        if (state.currentNotePath) {
          state.zoomByPageId[state.currentNotePath] = [];
        }
        state.zoomPath = [];
        state.focusedBlockId = null;
      });
    },

    setFocusedBlockId: (blockId: string | null) => {
      set((state) => {
        state.focusedBlockId = blockId;
      });
    },

    zoomOut: () => {
      set((state) => {
        if (state.zoomPath.length > 0) {
          // Remove last block from zoom path
          state.zoomPath.pop();
          // Set focused block to the new last item (or null if empty)
          state.focusedBlockId =
            state.zoomPath.length > 0
              ? state.zoomPath[state.zoomPath.length - 1]
              : null;
        }
      });
    },

    zoomOutToNote: () => {
      set((state) => {
        if (state.currentNotePath && state.zoomPath.length > 0) {
          state.zoomByPageId[state.currentNotePath] = [];
        }
        state.focusedBlockId = null;
        state.zoomPath = [];
      });
    },

    goBack: () => {
      set((state) => {
        if (state.zoomPath.length > 0) {
          // Zoom out one level
          state.zoomPath.pop();
          state.focusedBlockId =
            state.zoomPath.length > 0
              ? state.zoomPath[state.zoomPath.length - 1]
              : null;
        } else if (state.mode === "note") {
          state.mode = "index";
          state.currentNotePath = null;
          state.breadcrumb = state.workspaceName ? [state.workspaceName] : [];
        }
      });
    },

    setWorkspaceName: (name: string) => {
      set((state) => {
        state.workspaceName = name;
        if (state.mode === "index") {
          state.breadcrumb = [name];
        }
      });
    },

    reset: () => {
      set(initialState);
    },
  })),
);

// Selector hooks
export const useViewMode = () => useViewStore((state) => state.mode);
export const useCurrentNotePath = () =>
  useViewStore((state) => state.currentNotePath);
export const useBreadcrumb = () => useViewStore((state) => state.breadcrumb);
export const useFocusedBlockId = () =>
  useViewStore((state) => state.focusedBlockId);

/**
 * Check if a specific block is currently focused.
 * Re-renders only when focus state for THIS block changes.
 * Use this instead of useFocusedBlockId() in BlockComponent to prevent
 * all blocks from re-rendering on focus changes.
 */
export const useIsBlockFocused = (blockId: string) =>
  useViewStore((state) => state.focusedBlockId === blockId);

export const useZoomPath = () => useViewStore((state) => state.zoomPath);
