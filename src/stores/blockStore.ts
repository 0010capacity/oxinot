import { invoke } from "@tauri-apps/api/core";
import { immer } from "zustand/middleware/immer";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn as create } from "zustand/traditional";
import { useWorkspaceStore } from "./workspaceStore";
import { useBlockUIStore } from "./blockUIStore";
import {
  getInsertBelowTarget,
  updateChildrenMap,
  normalizeBlocks,
} from "./blockGraphHelpers";

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
  metadata?: Record<string, string>;
}

export type BlockStatus = "synced" | "optimistic" | "syncing" | "error";

interface BlockState {
  // 정규화된 데이터
  blocksById: Record<string, BlockData>;
  childrenMap: Record<string, string[]>;
  blockStatus: Record<string, BlockStatus>;

  // 현재 상태
  currentPageId: string | null;
  isLoading: boolean;
  error: string | null;

  // tempId 추적 및 pending updates 큐
  tempIdMap: Record<string, string>; // tempId -> realId 매핑
  pendingUpdates: Array<{
    tempId: string;
    content: string;
  }>;
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
  updateBlock: (id: string, updates: Partial<BlockData>) => Promise<void>;
  updateBlockContent: (id: string, content: string) => Promise<void>;
  deleteBlock: (id: string) => Promise<void>;
  splitBlockAtCursor: (
    id: string,
    offset: number,
    draftContent?: string
  ) => Promise<void>;

  // 블록 조작
  indentBlock: (id: string) => Promise<void>;
  outdentBlock: (id: string) => Promise<void>;
  moveBlock: (
    id: string,
    newParentId: string | null,
    afterBlockId: string | null
  ) => Promise<void>;
  mergeWithPrevious: (id: string, draftContent?: string) => Promise<void>;
  toggleCollapse: (id: string) => Promise<void>;

  // 키보드 네비게이션
  getBlock: (id: string) => BlockData | undefined;
  getChildren: (parentId: string | null) => string[];
  getRootBlockIds: () => string[];
  getPreviousVisibleBlock: (id: string) => string | null;
  /**
   * Alias for getPreviousVisibleBlock (deprecated)
   */
  getPreviousBlock: (id: string) => string | null;
  getNextBlock: (id: string) => string | null;

  // Page Lifecycle
  openPage: (pageId: string) => Promise<void>;
}

type BlockStore = BlockState & BlockActions;

// ============ Store Implementation ============

export const useBlockStore = create<BlockStore>()(
  immer((set, get) => ({
    // Initial State
    blocksById: {},
    childrenMap: {},
    blockStatus: {},
    currentPageId: null,
    isLoading: false,
    error: null,
    tempIdMap: {},
    pendingUpdates: [],

    // ============ Page Operations ============

    openPage: async (pageId: string) => {
      // Prevent duplicate loads
      if (get().currentPageId === pageId && get().isLoading) return;

      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const workspacePath = useWorkspaceStore.getState().workspacePath;
        if (!workspacePath) {
          throw new Error("No workspace selected");
        }

        console.log(`[blockStore] Loading blocks for page ${pageId}...`);
        const blocks: BlockData[] = await invoke("get_page_blocks", {
          workspacePath,
          pageId,
        });
        console.log(
          `[blockStore] Loaded ${blocks.length} blocks for page ${pageId}`
        );

        // Normalize
        const { blocksById, childrenMap } = normalizeBlocks(blocks);

        // Check for empty page and handle initial block
        const isRootEmpty = (childrenMap.root ?? []).length === 0;

        set((state) => {
          state.blocksById = blocksById;
          state.childrenMap = childrenMap;
          state.currentPageId = pageId;
          // Keep isLoading = true if we are about to create an initial block
          if (!isRootEmpty) {
            state.isLoading = false;
          }
        });

        if (isRootEmpty) {
          console.log(
            `[blockStore] Creating initial block for page ${pageId}...`
          );
          try {
            // Create initial block optimistically
            await get().createBlock(null, "");
            console.log(
              `[blockStore] Initial block created successfully for page ${pageId}`
            );
          } catch (blockError) {
            console.error(
              `[blockStore] Failed to create initial block for page ${pageId}:`,
              blockError
            );
            throw new Error(
              `Failed to create initial block: ${
                blockError instanceof Error
                  ? blockError.message
                  : String(blockError)
              }`
            );
          }

          set((state) => {
            state.isLoading = false;
          });
        }
      } catch (error) {
        console.error(
          `[blockStore] Failed to load page ${pageId}:`,
          error,
          "Workspace:",
          useWorkspaceStore.getState().workspacePath
        );
        set((state) => {
          state.error =
            typeof error === "string"
              ? error
              : error instanceof Error
              ? error.message
              : "Failed to load page";
          state.isLoading = false;
        });
      }
    },

    loadPage: async (pageId: string) => {
      // Legacy wrapper: use openPage
      return get().openPage(pageId);
    },

    clearPage: () => {
      set((state) => {
        state.blocksById = {};
        state.childrenMap = { root: [] };
        state.currentPageId = null;
      });
      useBlockUIStore.setState({
        focusedBlockId: null,
        selectedBlockIds: [],
        mergingBlockId: null,
        mergingTargetBlockId: null,
        targetCursorPosition: null,
      });
    },

    updatePartialBlocks: (blocks: BlockData[], deletedBlockIds?: string[]) => {
      set((state) => {
        // 1. Update childrenMap incrementally (O(M*K + K log K))
        // Pass state.blocksById BEFORE updating it so the helper can find old parents
        updateChildrenMap(
          state.childrenMap,
          state.blocksById,
          blocks,
          deletedBlockIds ?? []
        );

        // 2. Update blocksById
        for (const block of blocks) {
          state.blocksById[block.id] = block;
        }

        // 3. Remove deleted blocks from blocksById
        if (deletedBlockIds) {
          for (const id of deletedBlockIds) {
            delete state.blocksById[id];
          }
        }
      });
    },

    // ============ Block CRUD ============

    createBlock: async (afterBlockId: string | null, content?: string) => {
      const { currentPageId, blocksById, childrenMap } = get();
      if (!currentPageId) throw new Error("No page loaded");

      // Determine where to place the new block:
      let parentId: string | null = null;
      let afterBlockIdForBackend: string | null = null;

      if (afterBlockId) {
        // Use canonical rule for "insert below"
        const target = getInsertBelowTarget(
          afterBlockId,
          blocksById,
          childrenMap
        );
        parentId = target.parentId;
        afterBlockIdForBackend = target.afterBlockId;
      }

      // Use optimistic update only for root block creation (initial empty page)
      // to avoid flicker. For user-initiated creates, reload for accuracy.
      const isRootBlockCreation = afterBlockId === null && content === "";

      if (isRootBlockCreation) {
        // Optimistic: 임시 ID로 즉시 추가
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
          state.blockStatus[tempId] = "optimistic";
          const parentKey = parentId ?? "root";
          if (!state.childrenMap[parentKey]) {
            state.childrenMap[parentKey] = [];
          }
          state.childrenMap[parentKey].push(tempId);
        });
        useBlockUIStore.setState({ focusedBlockId: tempId });

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

          // Capture pending updates before clearing them
          const pendingUpdates = get().pendingUpdates.filter(
            (u) => u.tempId === tempId
          );
          const latestContent =
            pendingUpdates.length > 0
              ? pendingUpdates[pendingUpdates.length - 1].content
              : null;

          // 임시 블록을 실제 블록으로 교체
          set((state) => {
            delete state.blocksById[tempId];
            delete state.blockStatus[tempId];
            
            // Add new block
            state.blocksById[newBlock.id] = newBlock;
            state.blockStatus[newBlock.id] = "synced";

            const parentKey = parentId ?? "root";
            const tempIndex = state.childrenMap[parentKey].indexOf(tempId);
            if (tempIndex !== -1) {
              state.childrenMap[parentKey][tempIndex] = newBlock.id;
            }

            // tempIdMap에 매핑 기록
            state.tempIdMap[tempId] = newBlock.id;

            // Apply latest content from pending updates
            if (latestContent !== null) {
              if (state.blocksById[newBlock.id]) {
                state.blocksById[newBlock.id].content = latestContent;
                state.blocksById[newBlock.id].updatedAt =
                  new Date().toISOString();
              }
              // pending updates 제거
              state.pendingUpdates = state.pendingUpdates.filter(
                (u) => u.tempId !== tempId
              );
            }
          });
          
          if (useBlockUIStore.getState().focusedBlockId === tempId) {
            useBlockUIStore.setState({ focusedBlockId: newBlock.id });
          }

          // 백엔드에 pending updates 동기화
          if (latestContent !== null) {
            try {
              const workspacePath = useWorkspaceStore.getState().workspacePath;
              if (workspacePath) {
                await invoke("update_block", {
                  workspacePath,
                  request: { id: newBlock.id, content: latestContent },
                });
              }
            } catch (error) {
              console.error(
                "Failed to sync pending updates for new block:",
                error
              );
            }
          }

          return newBlock.id;
        } catch (error) {
          // 롤백
          set((state) => {
            delete state.blocksById[tempId];
            delete state.blockStatus[tempId];
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
          useBlockUIStore.setState({
            focusedBlockId: newBlock.id,
            targetCursorPosition: 0,
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

    updateBlock: async (id: string, updates: Partial<BlockData>) => {
      const { blocksById } = get();
      const block = blocksById[id];
      if (!block) return;

      // Optimistic update
      set((state) => {
        if (state.blocksById[id]) {
          state.blocksById[id] = { ...state.blocksById[id], ...updates };
        }
      });

      try {
        const workspacePath = useWorkspaceStore.getState().workspacePath;
        if (!workspacePath) throw new Error("No workspace selected");

        if (updates.metadata) {
          await invoke("update_block", {
            workspacePath,
            request: {
              id,
              metadata: updates.metadata,
            },
          });
        }
      } catch (error) {
        console.error("Failed to update block:", error);
        // Revert
        set((state) => {
          if (state.blocksById[id]) {
            state.blocksById[id] = block;
          }
        });
        throw error;
      }
    },

    updateBlockContent: async (id: string, content: string) => {
      const { blocksById, blockStatus } = get();
      const { mergingBlockId, mergingTargetBlockId } =
        useBlockUIStore.getState();

      // Prevent UI from overwriting blocks involved in an active merge operation.
      if (id === mergingBlockId || id === mergingTargetBlockId) {
        return;
      }

      const block = blocksById[id];
      if (!block) return;

      // Check if this is a tempId or optimistic/syncing status
      const status = blockStatus[id];
      const isOptimistic =
        status === "optimistic" || status === "syncing" || id.startsWith("temp-");

      if (isOptimistic) {
        // 큐에 추가하고 실제 ID로 교체될 때까지 대기
        set((state) => {
          state.pendingUpdates.push({ tempId: id, content });
          // 블록 UI는 즉시 업데이트
          if (state.blocksById[id]) {
            state.blocksById[id].content = content;
            state.blocksById[id].updatedAt = new Date().toISOString();
          }
        });
        return;
      }

      // 실제 ID인 경우 일반 업데이트 진행
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

    splitBlockAtCursor: async (
      id: string,
      offset: number,
      draftContent?: string
    ) => {
      const { currentPageId, blocksById, childrenMap } = get();
      if (!currentPageId) throw new Error("No page loaded");

      const block = blocksById[id];
      if (!block) throw new Error("Block not found");

      const contentToSplit = draftContent ?? block.content;
      const beforeContent = contentToSplit.slice(0, offset);
      const afterContent = contentToSplit.slice(offset);

      // Determine where to place the new block using canonical rule
      const { parentId: newParentId, afterBlockId: afterBlockIdForBackend } =
        getInsertBelowTarget(id, blocksById, childrenMap);

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
        useBlockUIStore.setState({
          focusedBlockId: newBlock.id,
          targetCursorPosition: 0,
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
      const { blocksById, getPreviousVisibleBlock } = get();
      const block = blocksById[id];
      if (!block) return;

      // Prevent deleting the last block of a page to ensure the editor always has a place to type.
      const totalBlocks = Object.keys(blocksById).length;
      if (totalBlocks <= 1) {
        return;
      }

      // Check if we need to move focus BEFORE deletion (so we know where to go)
      const { focusedBlockId } = useBlockUIStore.getState();
      let nextFocusId: string | null = null;

      if (focusedBlockId === id) {
        // If deleting the focused block, move focus to previous visible block
        nextFocusId = getPreviousVisibleBlock(id);
      }

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

        // Cleanup UI state if needed
        const currentUI = useBlockUIStore.getState();

        // 1. Handle Focus
        if (
          currentUI.focusedBlockId &&
          deletedIds.includes(currentUI.focusedBlockId)
        ) {
          if (nextFocusId) {
            useBlockUIStore.setState({ focusedBlockId: nextFocusId });
          } else {
            useBlockUIStore.setState({ focusedBlockId: null });
          }
        }

        // 2. Handle Merge State
        if (
          (currentUI.mergingBlockId &&
            deletedIds.includes(currentUI.mergingBlockId)) ||
          (currentUI.mergingTargetBlockId &&
            deletedIds.includes(currentUI.mergingTargetBlockId))
        ) {
          useBlockUIStore.setState({
            mergingBlockId: null,
            mergingTargetBlockId: null,
          });
        }
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
      const { blocksById, childrenMap } = get();
      const block = blocksById[id];
      if (!block) return;

      // Check if we can indent (must have a previous sibling)
      const parentId = block.parentId ?? "root";
      const siblings = childrenMap[parentId] ?? [];
      const index = siblings.indexOf(id);

      if (index <= 0) {
        // No previous sibling, cannot indent. Fail silently.
        return;
      }

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

    mergeWithPrevious: async (id: string, draftContent?: string) => {
      const { blocksById, getPreviousVisibleBlock, deleteBlock } = get();

      // Prevent concurrent merges on the same block
      const { mergingBlockId } = useBlockUIStore.getState();
      if (mergingBlockId === id) {
        return;
      }

      useBlockUIStore.setState({
        mergingBlockId: id,
        mergingTargetBlockId: null,
      });

      try {
        const currentBlock = blocksById[id];
        if (!currentBlock) return;

        const contentToMerge = draftContent ?? currentBlock.content;

        // Case 1: If current block is empty, delete it and move focus to previous
        if (contentToMerge === "") {
          const prevBlockId = getPreviousVisibleBlock(id);
          await deleteBlock(id);

          if (prevBlockId) {
            const prevBlock = get().blocksById[prevBlockId];
            if (prevBlock) {
              useBlockUIStore.setState({
                focusedBlockId: prevBlockId,
                targetCursorPosition: prevBlock.content.length,
              });
            } else {
              useBlockUIStore.setState({ focusedBlockId: prevBlockId });
            }
          }
          return;
        }

        // Case 2: Non-empty block, merge into previous
        const prevBlockId = getPreviousVisibleBlock(id);
        if (!prevBlockId) {
          return;
        }

        // Lock the target block to prevent stale UI updates from overwriting the merge result
        useBlockUIStore.setState({ mergingTargetBlockId: prevBlockId });

        const prevBlock = blocksById[prevBlockId];
        if (!prevBlock) return;

        const workspacePath = useWorkspaceStore.getState().workspacePath;
        if (!workspacePath) throw new Error("No workspace selected");

        // Paranoid sync: Ensure target block content in DB matches Store before merge
        if (prevBlock) {
          await invoke("update_block", {
            workspacePath,
            request: { id: prevBlockId, content: prevBlock.content },
          });
        }

        // Calculate cursor position for focus after merge
        const cursorPosition = prevBlock.content.length;

        // If draftContent is provided, update the block content first
        if (
          draftContent !== undefined &&
          draftContent !== currentBlock.content
        ) {
          await invoke("update_block", {
            workspacePath,
            request: { id, content: draftContent },
          });

          set((state) => {
            if (state.blocksById[id]) {
              state.blocksById[id].content = draftContent;
              state.blocksById[id].updatedAt = new Date().toISOString();
            }
          });
        }

        // Backend handles the merge atomically and returns changed blocks
        const changedBlocks: BlockData[] = await invoke("merge_blocks", {
          workspacePath,
          blockId: id,
          targetId: prevBlockId,
        });

        // Update only the changed blocks (merged block + moved children)
        get().updatePartialBlocks(changedBlocks, [id]);

        // Set focus and cursor position
        useBlockUIStore.setState({
          focusedBlockId: prevBlockId,
          targetCursorPosition: cursorPosition,
        });
      } catch (error) {
        console.error("Failed to merge blocks:", error);

        // Error recovery: Clear focus to ensure Editor components re-initialize with fresh data on reload
        useBlockUIStore.setState({ focusedBlockId: null });

        const pageId = get().currentPageId;
        if (pageId) await get().loadPage(pageId);

        // Restore focus
        const state = get();
        if (state.blocksById[id]) {
          // If the block still exists (merge failed), focus it so user can retry or see state
          useBlockUIStore.setState({ focusedBlockId: id });
        } else {
          // Block is gone (maybe deleted by race?), focus previous or root
          const prev =
            getPreviousVisibleBlock(id) ?? state.childrenMap.root?.[0];
          useBlockUIStore.setState({ focusedBlockId: prev ?? null });
        }
      } finally {
        useBlockUIStore.setState({
          mergingBlockId: null,
          mergingTargetBlockId: null,
        });
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

    // ============ Selectors ============

    getBlock: (id: string) => get().blocksById[id],

    getChildren: (parentId: string | null) => {
      const key = parentId ?? "root";
      return get().childrenMap[key] ?? [];
    },

    getRootBlockIds: () => get().childrenMap.root ?? [],

    // ============ Keyboard Navigation ============

    getPreviousVisibleBlock: (id: string) => {
      const { blocksById, childrenMap } = get();
      const block = blocksById[id];
      if (!block) return null;

      const parentKey = block.parentId ?? "root";
      const siblings = childrenMap[parentKey] ?? [];
      const index = siblings.indexOf(id);

      if (index > 0) {
        // Previous sibling exists
        const prevSiblingId = siblings[index - 1];
        const prevSibling = blocksById[prevSiblingId];
        if (!prevSibling) return null;

        // If expanded and has children, find the last visible descendant
        let currentId = prevSiblingId;
        while (true) {
          const currentBlock = blocksById[currentId];
          const children = childrenMap[currentId];

          if (
            currentBlock &&
            !currentBlock.isCollapsed &&
            children &&
            children.length > 0
          ) {
            // Go to last child
            currentId = children[children.length - 1];
          } else {
            // No more visible children
            return currentId;
          }
        }
      }

      if (block.parentId) {
        // First sibling -> go to parent
        return block.parentId;
      }

      return null;
    },

    getPreviousBlock: (id: string) => get().getPreviousVisibleBlock(id),

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

export const useBlocksLoading = () => useBlockStore((state) => state.isLoading);
