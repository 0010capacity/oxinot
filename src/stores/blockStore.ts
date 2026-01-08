import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspaceStore } from "./workspaceStore";

// ============ Types ============

export interface BlockData {
  id: string;
  pageId: string;
  parentId: string | null;
  content: string;
  orderWeight: number;
  isCollapsed: boolean;
  blockType: "bullet" | "code" | "fence";
  language?: string;
  createdAt: string;
  updatedAt: string;
}

interface BlockState {
  // 정규화된 데이터
  blocksById: Record<string, BlockData>;
  childrenMap: Record<string, string[]>;

  // 현재 상태
  currentPageId: string | null;
  isLoading: boolean;
  error: string | null;

  // 선택/포커스 상태
  focusedBlockId: string | null;
  selectedBlockIds: string[];

  // 커서 위치 추적 (블록 간 이동 시)
  targetCursorPosition: number | null;
}

interface BlockActions {
  // 페이지 로드
  loadPage: (pageId: string) => Promise<void>;
  clearPage: () => void;

  // 블록 CRUD
  createBlock: (
    afterBlockId: string | null,
    content?: string,
  ) => Promise<string>;
  updateBlockContent: (id: string, content: string) => Promise<void>;
  deleteBlock: (id: string) => Promise<void>;

  // 블록 조작
  indentBlock: (id: string) => Promise<void>;
  outdentBlock: (id: string) => Promise<void>;
  moveBlock: (
    id: string,
    newParentId: string | null,
    afterBlockId: string | null,
  ) => Promise<void>;
  toggleCollapse: (id: string) => Promise<void>;

  // 선택/포커스
  setFocusedBlock: (id: string | null, cursorPos?: number) => void;
  setSelectedBlocks: (ids: string[]) => void;
  clearTargetCursorPosition: () => void;

  // 키보드 네비게이션
  getPreviousBlock: (id: string) => string | null;
  getNextBlock: (id: string) => string | null;

  // 셀렉터
  getBlock: (id: string) => BlockData | undefined;
  getChildren: (parentId: string | null) => string[];
  getRootBlockIds: () => string[];
}

type BlockStore = BlockState & BlockActions;

// ============ Store Implementation ============

export const useBlockStore = create<BlockStore>()(
  immer((set, get) => ({
    // Initial State
    blocksById: {},
    childrenMap: {},
    currentPageId: null,
    isLoading: false,
    error: null,
    focusedBlockId: null,
    selectedBlockIds: [],
    targetCursorPosition: null,

    // ============ Page Operations ============

    loadPage: async (pageId: string) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const workspacePath = useWorkspaceStore.getState().workspacePath;
        if (!workspacePath) {
          throw new Error("No workspace selected");
        }

        const blocks: BlockData[] = await invoke("get_page_blocks", {
          workspacePath,
          pageId,
        });

        // 정규화
        const blocksById: Record<string, BlockData> = {};
        const childrenMap: Record<string, string[]> = { root: [] };

        for (const block of blocks) {
          blocksById[block.id] = block;

          const parentKey = block.parentId ?? "root";
          if (!childrenMap[parentKey]) {
            childrenMap[parentKey] = [];
          }
          childrenMap[parentKey].push(block.id);
        }

        // orderWeight로 정렬
        for (const key of Object.keys(childrenMap)) {
          childrenMap[key].sort((a, b) => {
            return blocksById[a].orderWeight - blocksById[b].orderWeight;
          });
        }

        set((state) => {
          state.blocksById = blocksById;
          state.childrenMap = childrenMap;
          state.currentPageId = pageId;
          state.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.error =
            error instanceof Error ? error.message : "Failed to load page";
          state.isLoading = false;
        });
      }
    },

    clearPage: () => {
      set((state) => {
        state.blocksById = {};
        state.childrenMap = {};
        state.currentPageId = null;
        state.focusedBlockId = null;
        state.selectedBlockIds = [];
      });
    },

    // ============ Block CRUD ============

    createBlock: async (afterBlockId: string | null, content?: string) => {
      const { currentPageId, blocksById } = get();
      if (!currentPageId) throw new Error("No page loaded");

      // 부모 결정
      let parentId: string | null = null;
      if (afterBlockId) {
        parentId = blocksById[afterBlockId]?.parentId ?? null;
      }

      // Optimistic: 임시 ID로 즉시 추가
      const tempId = `temp-${Date.now()}`;
      const tempBlock: BlockData = {
        id: tempId,
        pageId: currentPageId,
        parentId,
        content: content ?? "",
        orderWeight: Date.now(),
        isCollapsed: false,
        blockType: "bullet",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      set((state) => {
        state.blocksById[tempId] = tempBlock;
        const parentKey = parentId ?? "root";
        if (!state.childrenMap[parentKey]) {
          state.childrenMap[parentKey] = [];
        }

        if (afterBlockId) {
          const afterIndex = state.childrenMap[parentKey].indexOf(afterBlockId);
          state.childrenMap[parentKey].splice(afterIndex + 1, 0, tempId);
        } else {
          state.childrenMap[parentKey].push(tempId);
        }

        state.focusedBlockId = tempId;
      });

      try {
        // 실제 생성
        const workspacePath = useWorkspaceStore.getState().workspacePath;
        if (!workspacePath) {
          throw new Error("No workspace selected");
        }

        const newBlock: BlockData = await invoke("create_block", {
          workspacePath,
          request: {
            pageId: currentPageId,
            parentId,
            afterBlockId,
            content,
          },
        });

        // 임시 블록을 실제 블록으로 교체
        set((state) => {
          delete state.blocksById[tempId];
          state.blocksById[newBlock.id] = newBlock;

          const parentKey = parentId ?? "root";
          const tempIndex = state.childrenMap[parentKey].indexOf(tempId);
          if (tempIndex !== -1) {
            state.childrenMap[parentKey][tempIndex] = newBlock.id;
          }

          state.focusedBlockId = newBlock.id;
        });

        return newBlock.id;
      } catch (error) {
        // 롤백
        set((state) => {
          delete state.blocksById[tempId];
          const parentKey = parentId ?? "root";
          state.childrenMap[parentKey] = state.childrenMap[parentKey].filter(
            (id) => id !== tempId,
          );
        });
        throw error;
      }
    },

    updateBlockContent: async (id: string, content: string) => {
      const block = get().blocksById[id];
      if (!block) return;

      const previousContent = block.content;

      // Optimistic Update
      set((state) => {
        if (state.blocksById[id]) {
          state.blocksById[id].content = content;
          state.blocksById[id].updatedAt = new Date().toISOString();
        }
      });

      try {
        const workspacePath = useWorkspaceStore.getState().workspacePath;
        if (!workspacePath) {
          throw new Error("No workspace selected");
        }

        await invoke("update_block", {
          workspacePath,
          request: { id, content },
        });
      } catch (error) {
        // 롤백
        set((state) => {
          if (state.blocksById[id]) {
            state.blocksById[id].content = previousContent;
          }
        });
        throw error;
      }
    },

    deleteBlock: async (id: string) => {
      const { blocksById, childrenMap } = get();
      const block = blocksById[id];
      if (!block) return;

      // 백업 (롤백용)
      const backup = {
        block: { ...block },
        parentKey: block.parentId ?? "root",
        index: childrenMap[block.parentId ?? "root"]?.indexOf(id) ?? -1,
      };

      // Optimistic Delete
      set((state) => {
        delete state.blocksById[id];
        const parentKey = block.parentId ?? "root";
        state.childrenMap[parentKey] =
          state.childrenMap[parentKey]?.filter((childId) => childId !== id) ??
          [];
      });

      try {
        const workspacePath = useWorkspaceStore.getState().workspacePath;
        if (!workspacePath) {
          throw new Error("No workspace selected");
        }

        await invoke("delete_block", { workspacePath, blockId: id });
      } catch (error) {
        // 롤백
        set((state) => {
          state.blocksById[backup.block.id] = backup.block;
          if (!state.childrenMap[backup.parentKey]) {
            state.childrenMap[backup.parentKey] = [];
          }
          state.childrenMap[backup.parentKey].splice(
            backup.index,
            0,
            backup.block.id,
          );
        });
        throw error;
      }
    },

    // ============ Block Manipulation ============

    indentBlock: async (id: string) => {
      const { blocksById, childrenMap } = get();
      const block = blocksById[id];
      if (!block) return;

      const parentKey = block.parentId ?? "root";
      const siblings = childrenMap[parentKey] ?? [];
      const index = siblings.indexOf(id);

      if (index <= 0) return;

      const prevSiblingId = siblings[index - 1];

      // Optimistic
      set((state) => {
        state.childrenMap[parentKey] = state.childrenMap[parentKey].filter(
          (childId) => childId !== id,
        );

        if (!state.childrenMap[prevSiblingId]) {
          state.childrenMap[prevSiblingId] = [];
        }
        state.childrenMap[prevSiblingId].push(id);
        state.blocksById[id].parentId = prevSiblingId;
      });

      try {
        const workspacePath = useWorkspaceStore.getState().workspacePath;
        if (!workspacePath) {
          throw new Error("No workspace selected");
        }

        const updatedBlock: BlockData = await invoke("indent_block", {
          workspacePath,
          blockId: id,
        });
        set((state) => {
          state.blocksById[id] = updatedBlock;
        });
      } catch (error) {
        const pageId = get().currentPageId;
        if (pageId) await get().loadPage(pageId);
        throw error;
      }
    },

    outdentBlock: async (id: string) => {
      const { blocksById } = get();
      const block = blocksById[id];
      if (!block || !block.parentId) return;

      const parent = blocksById[block.parentId];
      if (!parent) return;

      set((state) => {
        state.childrenMap[block.parentId!] =
          state.childrenMap[block.parentId!]?.filter(
            (childId) => childId !== id,
          ) ?? [];

        const grandparentKey = parent.parentId ?? "root";
        const parentIndex =
          state.childrenMap[grandparentKey]?.indexOf(block.parentId!) ?? -1;

        if (!state.childrenMap[grandparentKey]) {
          state.childrenMap[grandparentKey] = [];
        }
        state.childrenMap[grandparentKey].splice(parentIndex + 1, 0, id);
        state.blocksById[id].parentId = parent.parentId;
      });

      try {
        const workspacePath = useWorkspaceStore.getState().workspacePath;
        if (!workspacePath) {
          throw new Error("No workspace selected");
        }

        const updatedBlock: BlockData = await invoke("outdent_block", {
          workspacePath,
          blockId: id,
        });
        set((state) => {
          state.blocksById[id] = updatedBlock;
        });
      } catch (error) {
        const pageId = get().currentPageId;
        if (pageId) await get().loadPage(pageId);
        throw error;
      }
    },

    moveBlock: async (
      id: string,
      newParentId: string | null,
      afterBlockId: string | null,
    ) => {
      try {
        const workspacePath = useWorkspaceStore.getState().workspacePath;
        if (!workspacePath) {
          throw new Error("No workspace selected");
        }

        await invoke("move_block", {
          workspacePath,
          request: { id, newParentId, afterBlockId },
        });

        const pageId = get().currentPageId;
        if (pageId) await get().loadPage(pageId);
      } catch (error) {
        throw error;
      }
    },

    toggleCollapse: async (id: string) => {
      const block = get().blocksById[id];
      if (!block) return;

      set((state) => {
        if (state.blocksById[id]) {
          state.blocksById[id].isCollapsed = !state.blocksById[id].isCollapsed;
        }
      });

      try {
        const workspacePath = useWorkspaceStore.getState().workspacePath;
        if (!workspacePath) {
          throw new Error("No workspace selected");
        }

        await invoke("toggle_collapse", { workspacePath, blockId: id });
      } catch (error) {
        set((state) => {
          if (state.blocksById[id]) {
            state.blocksById[id].isCollapsed =
              !state.blocksById[id].isCollapsed;
          }
        });
        throw error;
      }
    },

    // ============ Focus/Selection ============

    setFocusedBlock: (id: string | null, cursorPos?: number) => {
      set((state) => {
        state.focusedBlockId = id;
        state.targetCursorPosition = cursorPos ?? null;
      });
    },

    setSelectedBlocks: (ids: string[]) => {
      set((state) => {
        state.selectedBlockIds = ids;
      });
    },

    clearTargetCursorPosition: () => {
      set((state) => {
        state.targetCursorPosition = null;
      });
    },

    // ============ Selectors ============

    getBlock: (id: string) => get().blocksById[id],

    getChildren: (parentId: string | null) => {
      const key = parentId ?? "root";
      return get().childrenMap[key] ?? [];
    },

    getRootBlockIds: () => get().childrenMap["root"] ?? [],

    // ============ Keyboard Navigation ============

    getPreviousBlock: (id: string) => {
      const { blocksById, childrenMap } = get();
      const block = blocksById[id];
      if (!block) return null;

      const parentKey = block.parentId ?? "root";
      const siblings = childrenMap[parentKey] ?? [];
      const index = siblings.indexOf(id);

      if (index > 0) {
        // 이전 형제가 있으면, 그 형제의 마지막 보이는 자손으로 이동
        const prevSibling = siblings[index - 1];
        const prevBlock = blocksById[prevSibling];

        if (!prevBlock) return null;

        // 접혀있지 않고 자식이 있으면 마지막 자식의 마지막 자손으로
        let lastVisibleId = prevSibling;
        let currentChildren = childrenMap[lastVisibleId] ?? [];

        while (
          currentChildren.length > 0 &&
          !blocksById[lastVisibleId]?.isCollapsed
        ) {
          lastVisibleId = currentChildren[currentChildren.length - 1];
          currentChildren = childrenMap[lastVisibleId] ?? [];
        }

        return lastVisibleId;
      } else if (block.parentId) {
        // 첫 번째 형제면 부모로
        return block.parentId;
      }

      return null;
    },

    getNextBlock: (id: string) => {
      const { blocksById, childrenMap } = get();
      const block = blocksById[id];
      if (!block) return null;

      // 접혀있지 않고 자식이 있으면 첫 번째 자식으로
      const children = childrenMap[id] ?? [];
      if (children.length > 0 && !block.isCollapsed) {
        return children[0];
      }

      // 자식이 없으면 다음 형제 찾기
      let currentId: string | null = id;
      let currentBlock = block;

      while (currentId) {
        const parentKey = currentBlock.parentId ?? "root";
        const siblings = childrenMap[parentKey] ?? [];
        const index = siblings.indexOf(currentId);

        if (index < siblings.length - 1) {
          // 다음 형제가 있으면 반환
          return siblings[index + 1];
        }

        // 부모의 다음 형제 찾기
        currentId = currentBlock.parentId;
        if (!currentId) break;
        currentBlock = blocksById[currentId];
        if (!currentBlock) break;
      }

      return null;
    },
  })),
);

// ============ Selector Hooks ============

export const useBlock = (id: string) =>
  useBlockStore((state) => state.blocksById[id]);

export const useChildrenIds = (parentId: string | null) =>
  useBlockStore((state) => state.childrenMap[parentId ?? "root"] ?? []);

export const useFocusedBlockId = () =>
  useBlockStore((state) => state.focusedBlockId);

export const useBlocksLoading = () => useBlockStore((state) => state.isLoading);
