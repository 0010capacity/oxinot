import { invoke } from "@tauri-apps/api/core";
import { immer } from "zustand/middleware/immer";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn as create } from "zustand/traditional";
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
  updatePartialBlocks: (
    blocks: BlockData[],
    deletedBlockIds?: string[]
  ) => void;

  // 블록 CRUD
  createBlock: (
    afterBlockId: string | null,
    content?: string
  ) => Promise<string>;
  updateBlockContent: (id: string, content: string) => Promise<void>;
  deleteBlock: (id: string) => Promise<void>;
  splitBlockAtOffset: (id: string, offset: number) => Promise<void>;

  // 블록 조작
  indentBlock: (id: string) => Promise<void>;
  outdentBlock: (id: string) => Promise<void>;
  moveBlock: (
    id: string,
    newParentId: string | null,
    afterBlockId: string | null
  ) => Promise<void>;
  mergeBlock: (id: string, currentContent?: string) => Promise<void>;
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
        state.childrenMap = { root: [] };
        state.currentPageId = null;
        state.focusedBlockId = null;
        state.selectedBlockIds = [];
      });
    },

    updatePartialBlocks: (blocks: BlockData[], deletedBlockIds?: string[]) => {
      set((state) => {
        // Update or add blocks
        for (const block of blocks) {
          state.blocksById[block.id] = block;
        }

        // Delete blocks
        if (deletedBlockIds) {
          for (const id of deletedBlockIds) {
            delete state.blocksById[id];
          }
        }

        // Rebuild childrenMap for affected blocks
        const affectedParentIds = new Set<string>();
        for (const block of blocks) {
          affectedParentIds.add(block.parentId ?? "root");
        }
        if (deletedBlockIds) {
          for (const id of deletedBlockIds) {
            const block = state.blocksById[id];
            if (block) {
              affectedParentIds.add(block.parentId ?? "root");
            }
          }
        }

        // Rebuild childrenMap for affected parents
        for (const parentId of affectedParentIds) {
          const parentKey = parentId === "root" ? "root" : parentId;
          state.childrenMap[parentKey] = Object.values(state.blocksById)
            .filter((b) => (b.parentId ?? "root") === parentKey)
            .sort((a, b) => a.orderWeight - b.orderWeight)
            .map((b) => b.id);
        }

        // Clean up childrenMap for deleted blocks
        if (deletedBlockIds) {
          for (const id of deletedBlockIds) {
            delete state.childrenMap[id];
          }
        }
      });
    },

    // ============ Block CRUD ============

    createBlock: async (afterBlockId: string | null, content?: string) => {
      const { currentPageId, blocksById, childrenMap } = get();
      if (!currentPageId) throw new Error("No page loaded");

      // Determine where to place the new block:
      // If afterBlock has children, new block becomes first child
      // Otherwise, new block becomes next sibling
      let parentId: string | null = null;
      let afterBlockIdForBackend: string | null = null;

      if (afterBlockId) {
        const afterBlock = blocksById[afterBlockId];
        const hasChildren = (childrenMap[afterBlockId] ?? []).length > 0;

        if (hasChildren) {
          // Create as first child of afterBlock
          parentId = afterBlockId;
          afterBlockIdForBackend = null; // null means first child
        } else {
          // Create as next sibling of afterBlock
          parentId = afterBlock?.parentId ?? null;
          afterBlockIdForBackend = afterBlockId;
        }
      }

      // Use optimistic update only for root block creation (initial empty page)
      // to avoid flicker. For user-initiated creates, reload for accuracy.
      const isRootBlockCreation = afterBlockId === null && content === "";

      if (isRootBlockCreation) {
        // Optimistic: 임시 ID로 즉시 추가
        // NOTE: This must happen synchronously before any async work so the editor
        // can render a root block immediately (avoids "empty-state" flicker/races on
        // first open of a new, empty page).
        const tempId = `temp-${Date.now()}`;
        const nowIso = new Date().toISOString();
        const tempBlock: BlockData = {
          id: tempId,
          pageId: currentPageId,
          parentId,
          content: content ?? "",
          orderWeight: Date.now(),
          isCollapsed: false,
          blockType: "bullet",
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        set((state) => {
          state.blocksById[tempId] = tempBlock;
          const parentKey = parentId ?? "root";
          if (!state.childrenMap[parentKey]) {
            state.childrenMap[parentKey] = [];
          }
          state.childrenMap[parentKey].push(tempId);
          state.focusedBlockId = tempId;
        });

        // Kick off the backend create after the optimistic state is committed.
        // Yield one tick to ensure React/Zustand subscribers can render the temp block.
        await Promise.resolve();

        try {
          const workspacePath = useWorkspaceStore.getState().workspacePath;
          if (!workspacePath) {
            throw new Error("No workspace selected");
          }

          const newBlock: BlockData = await invoke("create_block", {
            workspacePath,
            request: {
              pageId: currentPageId,
              parentId,
              afterBlockId: afterBlockIdForBackend,
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
              (id) => id !== tempId
            );
          });
          throw error;
        }
      } else {
        // User-initiated block creation: no optimistic update, reload for accuracy
        try {
          const workspacePath = useWorkspaceStore.getState().workspacePath;
          if (!workspacePath) {
            throw new Error("No workspace selected");
          }

          const newBlock: BlockData = await invoke("create_block", {
            workspacePath,
            request: {
              pageId: currentPageId,
              parentId,
              afterBlockId: afterBlockIdForBackend,
              content,
            },
          });

          // Update only the new block
          get().updatePartialBlocks([newBlock]);

          // Set focus
          set((state) => {
            state.focusedBlockId = newBlock.id;
            state.targetCursorPosition = 0;
          });

          return newBlock.id;
        } catch (error) {
          console.error("Failed to create block:", error);
          // Reload to restore correct state
          const pageId = get().currentPageId;
          if (pageId) await get().loadPage(pageId);
          throw error;
        }
      }
    },

    updateBlockContent: async (id: string, content: string) => {
      const block = get().blocksById[id];
      if (!block) return;

      try {
        const workspacePath = useWorkspaceStore.getState().workspacePath;
        if (!workspacePath) {
          throw new Error("No workspace selected");
        }

        await invoke("update_block", {
          workspacePath,
          request: { id, content },
        });

        // Update state with backend result
        set((state) => {
          if (state.blocksById[id]) {
            state.blocksById[id].content = content;
            state.blocksById[id].updatedAt = new Date().toISOString();
          }
        });
      } catch (error) {
        console.error("Failed to update block content:", error);
        // Reload to restore correct state
        const pageId = get().currentPageId;
        if (pageId) await get().loadPage(pageId);
        throw error;
      }
    },

    splitBlockAtOffset: async (id: string, offset: number) => {
      const { currentPageId, blocksById, childrenMap } = get();
      if (!currentPageId) throw new Error("No page loaded");

      const block = blocksById[id];
      if (!block) throw new Error("Block not found");

      const beforeContent = block.content.slice(0, offset);
      const afterContent = block.content.slice(offset);

      // Determine where to place the new block:
      // If current block has children, new block becomes first child
      // Otherwise, new block becomes next sibling
      const hasChildren = (childrenMap[id] ?? []).length > 0;
      const newParentId = hasChildren ? id : block.parentId;
      const afterBlockIdForBackend = hasChildren ? null : id;

      // Update current block content first (this also updates state)
      try {
        await get().updateBlockContent(id, beforeContent);

        const workspacePath = useWorkspaceStore.getState().workspacePath;
        if (!workspacePath) {
          throw new Error("No workspace selected");
        }

        // Create new block at appropriate position
        const newBlock: BlockData = await invoke("create_block", {
          workspacePath,
          request: {
            pageId: currentPageId,
            parentId: newParentId,
            afterBlockId: afterBlockIdForBackend,
            content: afterContent,
          },
        });

        // Update only the new block (current block already updated by updateBlockContent)
        get().updatePartialBlocks([newBlock]);

        // Set focus
        set((state) => {
          state.focusedBlockId = newBlock.id;
          state.targetCursorPosition = 0;
        });
      } catch (error) {
        console.error("Failed to split block:", error);
        // Reload to restore correct state
        const pageId = get().currentPageId;
        if (pageId) await get().loadPage(pageId);
        throw error;
      }
    },

    deleteBlock: async (id: string) => {
      const { blocksById } = get();
      const block = blocksById[id];
      if (!block) return;

      try {
        const workspacePath = useWorkspaceStore.getState().workspacePath;
        if (!workspacePath) {
          throw new Error("No workspace selected");
        }

        // Backend returns all deleted IDs (block + descendants)
        const deletedIds: string[] = await invoke("delete_block", {
          workspacePath,
          blockId: id,
        });

        // Update only the affected blocks (remove deleted ones)
        get().updatePartialBlocks([], deletedIds);
      } catch (error) {
        console.error("Failed to delete block:", error);
        // Reload to restore correct state
        const pageId = get().currentPageId;
        if (pageId) await get().loadPage(pageId);
        throw error;
      }
    },

    // ============ Block Manipulation ============

    indentBlock: async (id: string) => {
      const { blocksById } = get();
      const block = blocksById[id];
      if (!block) return;

      try {
        const workspacePath = useWorkspaceStore.getState().workspacePath;
        if (!workspacePath) {
          throw new Error("No workspace selected");
        }

        // Backend returns the updated block
        const updatedBlock: BlockData = await invoke("indent_block", {
          workspacePath,
          blockId: id,
        });

        // Update only the changed block
        get().updatePartialBlocks([updatedBlock]);
      } catch (error) {
        console.error("Failed to indent block:", error);
        const pageId = get().currentPageId;
        if (pageId) await get().loadPage(pageId);
        throw error;
      }
    },

    outdentBlock: async (id: string) => {
      const { blocksById } = get();
      const block = blocksById[id];
      if (!block || !block.parentId) return;

      try {
        const workspacePath = useWorkspaceStore.getState().workspacePath;
        if (!workspacePath) {
          throw new Error("No workspace selected");
        }

        // Backend returns the updated block
        const updatedBlock: BlockData = await invoke("outdent_block", {
          workspacePath,
          blockId: id,
        });

        // Update only the changed block
        get().updatePartialBlocks([updatedBlock]);
      } catch (error) {
        console.error("Failed to outdent block:", error);
        const pageId = get().currentPageId;
        if (pageId) await get().loadPage(pageId);
        throw error;
      }
    },

    moveBlock: async (
      id: string,
      targetParentId: string | null,
      afterBlockId: string | null
    ) => {
      const workspacePath = useWorkspaceStore.getState().workspacePath;
      if (!workspacePath) {
        throw new Error("No workspace path");
      }

      // Backend returns the updated block
      const updatedBlock: BlockData = await invoke("move_block", {
        workspacePath,
        blockId: id,
        newParentId: targetParentId,
        afterBlockId,
      });

      // Update only the changed block
      get().updatePartialBlocks([updatedBlock]);
    },

    mergeBlock: async (id: string, currentContent?: string) => {
      const { blocksById, getPreviousBlock } = get();
      const currentBlock = blocksById[id];
      if (!currentBlock) return;

      const prevBlockId = getPreviousBlock(id);
      if (!prevBlockId) return;

      const prevBlock = blocksById[prevBlockId];
      if (!prevBlock) return;

      const workspacePath = useWorkspaceStore.getState().workspacePath;
      if (!workspacePath) throw new Error("No workspace selected");

      // Calculate cursor position for focus after merge
      const cursorPosition = prevBlock.content.length;

      try {
        // If currentContent is provided (draft), update the block content first
        // This ensures the backend merge operation works with the latest content
        if (
          currentContent !== undefined &&
          currentContent !== currentBlock.content
        ) {
          await get().updateBlockContent(id, currentContent);
        }

        // Backend handles the merge atomically and returns changed blocks
        const changedBlocks: BlockData[] = await invoke("merge_blocks", {
          workspacePath,
          blockId: id,
        });

        // Update only the changed blocks (merged block + moved children)
        get().updatePartialBlocks(changedBlocks, [id]);

        // Set focus and cursor position
        set((state) => {
          state.focusedBlockId = prevBlockId;
          state.targetCursorPosition = cursorPosition;
        });
      } catch (error) {
        console.error("Failed to merge blocks:", error);
        // Force reload to restore correct state
        const pageId = get().currentPageId;
        if (pageId) await get().loadPage(pageId);
      }
    },

    toggleCollapse: async (id: string) => {
      const block = get().blocksById[id];
      if (!block) return;

      try {
        const workspacePath = useWorkspaceStore.getState().workspacePath;
        if (!workspacePath) {
          throw new Error("No workspace selected");
        }

        // Backend returns the updated block
        const updatedBlock: BlockData = await invoke("toggle_collapse", {
          workspacePath,
          blockId: id,
        });

        // Update only the changed block
        get().updatePartialBlocks([updatedBlock]);
      } catch (error) {
        console.error("Failed to toggle collapse:", error);
        const pageId = get().currentPageId;
        if (pageId) await get().loadPage(pageId);
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

    getRootBlockIds: () => get().childrenMap.root ?? [],

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
      }

      if (block.parentId) {
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
  }))
);

// ============ Selector Hooks ============

export const useBlock = (id: string) =>
  useBlockStore((state) => state.blocksById[id]);

export const useChildrenIds = (parentId: string | null) =>
  useBlockStore(
    (state) => state.childrenMap[parentId ?? "root"] ?? [],
    shallow
  );

export const useFocusedBlockId = () =>
  useBlockStore((state) => state.focusedBlockId);

export const useBlocksLoading = () => useBlockStore((state) => state.isLoading);
