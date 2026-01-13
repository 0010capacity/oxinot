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
  zoomPath: string[]; // Array of block IDs from root to current zoom level
  breadcrumb: string[];
  pagePathIds: string[]; // Array of page IDs from workspace to current page
}

interface ViewState extends NavigationState {
  // Actions
  showIndex: () => void;
  showPage: (pageId: string) => void;
  openNote: (
    notePath: string,
    noteName: string,
    parentNames?: string[],
    pagePathIds?: string[],
  ) => void;
  zoomIntoBlock: (blockId: string) => void;
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
};

export const useViewStore = createWithEqualityFn<ViewState>()(
  immer((set) => ({
    ...initialState,

    showIndex: () => {
      set((state) => {
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
        state.zoomPath = [];
      });

      // Add to navigation history
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
        state.zoomPath = [];

        // Build breadcrumb: workspace > parent pages > current page
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

      // Add to navigation history
      useNavigationStore.getState().pushHistory(notePath, noteName);
    },

    zoomIntoBlock: (blockId: string) => {
      set((state) => {
        state.focusedBlockId = blockId;
        // Add to zoom path if not already there
        if (!state.zoomPath.includes(blockId)) {
          state.zoomPath.push(blockId);
        }
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
export const useZoomPath = () => useViewStore((state) => state.zoomPath);
