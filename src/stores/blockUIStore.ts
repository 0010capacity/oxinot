import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

// ============ Types ============

interface BlockUIState {
  // 선택/포커스 상태
  focusedBlockId: string | null;
  selectedBlockIds: string[];
  lastSelectedBlockId: string | null; // Shift+Click 범위 선택용
  selectionAnchorId: string | null; // Fixed anchor for Shift+Arrow range selection

  // 작업 상태 (병합 중)
  mergingBlockId: string | null;
  mergingTargetBlockId: string | null;

  // 커서 위치 추적
  targetCursorPosition: number | null;
}

interface BlockUIActions {
  // 포커스 관리
  setFocusedBlock: (id: string | null, cursorPos?: number) => void;
  clearFocusedBlock: () => void;

  // 단일 선택 관리
  setSelectedBlocks: (ids: string[]) => void;
  clearSelectedBlocks: () => void;

  // 선택 앵커 관리
  setSelectionAnchor: (id: string | null) => void;
  clearSelectionAnchor: () => void;

  // 다중 선택 관리
  toggleBlockSelection: (id: string) => void;
  addBlockToSelection: (id: string) => void;
  removeBlockFromSelection: (id: string) => void;
  selectBlockRange: (
    fromId: string,
    toId: string,
    visibleBlockIds: string[],
  ) => void;
  selectAllBlocks: (allBlockIds: string[]) => void;

  // 선택 상태 쿼리
  isBlockSelected: (id: string) => boolean;
  hasSelection: () => boolean;

  // 병합 상태 관리
  setMergingBlocks: (
    mergingBlockId: string | null,
    mergingTargetBlockId: string | null,
  ) => void;
  clearMergingBlocks: () => void;

  // 커서 위치 관리
  setTargetCursorPosition: (position: number | null) => void;
  clearTargetCursorPosition: () => void;

  // 전체 UI 상태 초기화
  reset: () => void;
}

type BlockUIStore = BlockUIState & BlockUIActions;

// ============ Initial State ============

const initialState: BlockUIState = {
  focusedBlockId: null,
  selectedBlockIds: [],
  lastSelectedBlockId: null,
  selectionAnchorId: null,
  mergingBlockId: null,
  mergingTargetBlockId: null,
  targetCursorPosition: null,
};

// ============ Store Implementation ============

export const useBlockUIStore = create<BlockUIStore>()(
  immer((set, get) => ({
    ...initialState,

    setFocusedBlock: (id: string | null, cursorPos?: number) => {
      set((state) => {
        state.focusedBlockId = id;
        state.targetCursorPosition = cursorPos ?? null;
      });
    },

    clearFocusedBlock: () => {
      set((state) => {
        state.focusedBlockId = null;
        state.targetCursorPosition = null;
      });
    },

    setSelectedBlocks: (ids: string[]) => {
      set((state) => {
        state.selectedBlockIds = ids;
        state.lastSelectedBlockId = ids.length > 0 ? ids[ids.length - 1] : null;
      });
    },

    clearSelectedBlocks: () => {
      set((state) => {
        state.selectedBlockIds = [];
        state.lastSelectedBlockId = null;
        state.selectionAnchorId = null;
      });
    },

    setSelectionAnchor: (id: string | null) => {
      set((state) => {
        state.selectionAnchorId = id;
      });
    },

    clearSelectionAnchor: () => {
      set((state) => {
        state.selectionAnchorId = null;
      });
    },

    toggleBlockSelection: (id: string) => {
      set((state) => {
        const index = state.selectedBlockIds.indexOf(id);
        if (index >= 0) {
          state.selectedBlockIds.splice(index, 1);
        } else {
          state.selectedBlockIds.push(id);
        }
        state.lastSelectedBlockId = id;
      });
    },

    addBlockToSelection: (id: string) => {
      set((state) => {
        if (!state.selectedBlockIds.includes(id)) {
          state.selectedBlockIds.push(id);
        }
        state.lastSelectedBlockId = id;
      });
    },

    removeBlockFromSelection: (id: string) => {
      set((state) => {
        const index = state.selectedBlockIds.indexOf(id);
        if (index >= 0) {
          state.selectedBlockIds.splice(index, 1);
        }
        if (state.lastSelectedBlockId === id) {
          state.lastSelectedBlockId =
            state.selectedBlockIds.length > 0
              ? state.selectedBlockIds[state.selectedBlockIds.length - 1]
              : null;
        }
      });
    },

    selectBlockRange: (
      fromId: string,
      toId: string,
      visibleBlockIds: string[],
    ) => {
      set((state) => {
        const fromIndex = visibleBlockIds.indexOf(fromId);
        const toIndex = visibleBlockIds.indexOf(toId);

        if (fromIndex < 0 || toIndex < 0) {
          return; // Invalid range
        }

        const start = Math.min(fromIndex, toIndex);
        const end = Math.max(fromIndex, toIndex);
        const rangeIds = visibleBlockIds.slice(start, end + 1);

        state.selectedBlockIds = rangeIds;
        state.lastSelectedBlockId = toId;
      });
    },

    selectAllBlocks: (allBlockIds: string[]) => {
      set((state) => {
        state.selectedBlockIds = [...allBlockIds];
        state.lastSelectedBlockId =
          allBlockIds.length > 0 ? allBlockIds[allBlockIds.length - 1] : null;
      });
    },

    isBlockSelected: (id: string) => {
      return get().selectedBlockIds.includes(id);
    },

    hasSelection: () => {
      return get().selectedBlockIds.length > 0;
    },

    setMergingBlocks: (
      mergingBlockId: string | null,
      mergingTargetBlockId: string | null,
    ) => {
      set((state) => {
        state.mergingBlockId = mergingBlockId;
        state.mergingTargetBlockId = mergingTargetBlockId;
      });
    },

    clearMergingBlocks: () => {
      set((state) => {
        state.mergingBlockId = null;
        state.mergingTargetBlockId = null;
      });
    },

    setTargetCursorPosition: (position: number | null) => {
      set((state) => {
        state.targetCursorPosition = position;
      });
    },

    clearTargetCursorPosition: () => {
      set((state) => {
        state.targetCursorPosition = null;
      });
    },

    reset: () => {
      set(initialState);
    },
  })),
);

// ============ Selector Hooks ============

export const useFocusedBlockId = () =>
  useBlockUIStore((state) => state.focusedBlockId);

/**
 * Check if a specific block is focused (boolean only).
 * Re-renders only when THIS block's focus status changes.
 * Much better for performance than useFocusedBlockId() + comparing in render.
 */
export const useIsBlockFocused = (blockId: string) =>
  useBlockUIStore((state) => state.focusedBlockId === blockId);

export const useTargetCursorPosition = () =>
  useBlockUIStore((state) => state.targetCursorPosition);

export const useSelectedBlockIds = () =>
  useBlockUIStore((state) => state.selectedBlockIds);

export const useMergingBlockIds = () =>
  useBlockUIStore((state) => ({
    mergingBlockId: state.mergingBlockId,
    mergingTargetBlockId: state.mergingTargetBlockId,
  }));

export const useHasSelection = () =>
  useBlockUIStore((state) => state.selectedBlockIds.length > 0);

export const useSelectionCount = () =>
  useBlockUIStore((state) => state.selectedBlockIds.length);
