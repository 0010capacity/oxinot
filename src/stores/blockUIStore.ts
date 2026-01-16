import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

// ============ Types ============

interface BlockUIState {
  // 선택/포커스 상태
  focusedBlockId: string | null;
  selectedBlockIds: string[];

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

  // 선택 관리
  setSelectedBlocks: (ids: string[]) => void;
  clearSelectedBlocks: () => void;

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
  mergingBlockId: null,
  mergingTargetBlockId: null,
  targetCursorPosition: null,
};

// ============ Store Implementation ============

export const useBlockUIStore = create<BlockUIStore>()(
  immer((set) => ({
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
      });
    },

    clearSelectedBlocks: () => {
      set((state) => {
        state.selectedBlockIds = [];
      });
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

export const useTargetCursorPosition = () =>
  useBlockUIStore((state) => state.targetCursorPosition);

export const useSelectedBlockIds = () =>
  useBlockUIStore((state) => state.selectedBlockIds);

export const useMergingBlockIds = () =>
  useBlockUIStore((state) => ({
    mergingBlockId: state.mergingBlockId,
    mergingTargetBlockId: state.mergingTargetBlockId,
  }));
