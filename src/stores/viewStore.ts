import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

// View modes
type ViewMode = "index" | "note";

// Navigation state
interface NavigationState {
  mode: ViewMode;
  currentNotePath: string | null;
  workspaceName: string | null;
  focusedBlockId: string | null;
  breadcrumb: string[];
}

interface ViewState extends NavigationState {
  // Actions
  showIndex: () => void;
  openNote: (notePath: string, noteName: string) => void;
  zoomIntoBlock: (blockId: string) => void;
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
  breadcrumb: [],
};

export const useViewStore = create<ViewState>()(
  immer((set) => ({
    ...initialState,

    showIndex: () => {
      set((state) => {
        state.mode = "index";
        state.currentNotePath = null;
        state.focusedBlockId = null;
        state.breadcrumb = state.workspaceName ? [state.workspaceName] : [];
      });
    },

    openNote: (notePath: string, noteName: string) => {
      set((state) => {
        state.mode = "note";
        state.currentNotePath = notePath;
        state.focusedBlockId = null;
        state.breadcrumb = state.workspaceName
          ? [state.workspaceName, noteName]
          : [noteName];
      });
    },

    zoomIntoBlock: (blockId: string) => {
      set((state) => {
        state.focusedBlockId = blockId;
      });
    },

    zoomOutToNote: () => {
      set((state) => {
        state.focusedBlockId = null;
      });
    },

    goBack: () => {
      set((state) => {
        if (state.focusedBlockId) {
          state.focusedBlockId = null;
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
