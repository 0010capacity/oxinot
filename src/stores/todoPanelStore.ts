import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { SmartViewType } from "../types/todo";

interface TodoPanelState {
  isOpen: boolean;
  activeView: SmartViewType;
}

interface TodoPanelActions {
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setActiveView: (view: SmartViewType) => void;
}

type TodoPanelStore = TodoPanelState & TodoPanelActions;

export const useTodoPanelStore = create<TodoPanelStore>()(
  immer((set, get) => ({
    isOpen: false,
    activeView: "today",

    openPanel: () => {
      set((state) => {
        state.isOpen = true;
      });
    },

    closePanel: () => {
      set((state) => {
        state.isOpen = false;
      });
    },

    togglePanel: () => {
      const { isOpen, openPanel, closePanel } = get();
      if (isOpen) {
        closePanel();
      } else {
        openPanel();
      }
    },

    setActiveView: (view) => {
      set((state) => {
        state.activeView = view;
      });
    },
  })),
);

export const useIsTodoPanelOpen = () => useTodoPanelStore((s) => s.isOpen);
export const useTodoPanelActiveView = () =>
  useTodoPanelStore((s) => s.activeView);
