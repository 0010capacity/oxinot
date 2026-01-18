import { invoke } from "@tauri-apps/api/core";
import { immer } from "zustand/middleware/immer";
import { createWithEqualityFn } from "zustand/traditional";
import { tauriAPI } from "../tauri-api";
import { createPageHierarchy, findPageByPath } from "../utils/pageUtils";
import { useWorkspaceStore } from "./workspaceStore";

// ============ Types ============

export interface PageData {
  id: string;
  title: string;
  parentId?: string;
  filePath?: string;
  isDirectory: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PageState {
  // 페이지 데이터
  pagesById: Record<string, PageData>;
  pageIds: string[];

  // 현재 상태
  currentPageId: string | null;
  isLoading: boolean;
  error: string | null;
}

interface PageActions {
  // 페이지 로드
  loadPages: () => Promise<{
    pageIds: string[];
    pagesById: Record<string, PageData>;
  }>;

  // 페이지 CRUD
  createPage: (title: string, parentId?: string) => Promise<string>;
  updatePageTitle: (id: string, title: string) => Promise<void>;
  deletePage: (id: string) => Promise<void>;
  movePage: (id: string, newParentId: string | null) => Promise<void>;
  convertToDirectory: (id: string) => Promise<void>;

  // 페이지 선택
  selectPage: (id: string) => void;
  setCurrentPageId: (id: string | null) => void;
  clearPages: () => void;

  // 경로 기반 페이지 네비게이션
  openPageByPath: (fullPath: string) => Promise<string>;
  openPageById: (pageId: string) => Promise<void>;

  // 셀렉터
  getPage: (id: string) => PageData | undefined;
}

type PageStore = PageState & PageActions;

// ============ Store Implementation ============

export const usePageStore = createWithEqualityFn<PageStore>()(
  immer((set, get) => ({
    // Initial State
    pagesById: {},
    pageIds: [],
    currentPageId: null,
    isLoading: false,
    error: null,

    // ============ Page Operations ============

    loadPages: async () => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const workspacePath = useWorkspaceStore.getState().workspacePath;
        if (!workspacePath) {
          throw new Error("No workspace selected");
        }

        const pages: PageData[] = await invoke("get_pages", { workspacePath });

        const pagesById: Record<string, PageData> = {};
        const pageIds: string[] = [];

        for (const page of pages) {
          pagesById[page.id] = page;
          pageIds.push(page.id);
        }

        console.log(
          "[pageStore.loadPages] Loaded pages from backend:",
          pages.map((p) => ({
            id: p.id,
            title: p.title,
            parentId: p.parentId,
          }))
        );

        set((state) => {
          state.pagesById = pagesById;
          state.pageIds = pageIds;
          state.isLoading = false;

          // Auto-select first page if available and no page is currently selected
          if (pageIds.length > 0 && !state.currentPageId) {
            state.currentPageId = pageIds[0];
          }
        });

        console.log("[pageStore.loadPages] Store updated with loaded pages");

        // Return the loaded data so callers can use it immediately
        return { pageIds, pagesById };
      } catch (error) {
        set((state) => {
          state.error =
            error instanceof Error ? error.message : "Failed to load pages";
          state.isLoading = false;
        });
        throw error;
      }
    },

    createPage: async (title: string, parentId?: string) => {
      const workspacePath = useWorkspaceStore.getState().workspacePath;
      if (!workspacePath) {
        throw new Error("No workspace selected");
      }

      const newPage = await invoke<PageData>("create_page", {
        workspacePath,
        request: { title, parentId: parentId || null },
      });

      // Incremental update: add new page directly to store
      set((state) => {
        state.pagesById[newPage.id] = newPage;
        state.pageIds.push(newPage.id);
      });

      return newPage.id;
    },

    updatePageTitle: async (id: string, title: string) => {
      const page = get().pagesById[id];
      if (!page) return;

      const backup = { ...page };

      try {
        const workspacePath = useWorkspaceStore.getState().workspacePath;
        if (!workspacePath) {
          throw new Error("No workspace selected");
        }

        // Incremental update: get updated page from backend
        const updatedPage = await invoke<PageData>("update_page_title", {
          workspacePath,
          request: { id, title },
        });

        // Update store with backend response
        set((state) => {
          state.pagesById[id] = updatedPage;
        });
      } catch (error) {
        // Rollback on error
        set((state) => {
          state.pagesById[id] = backup;
        });
        throw error;
      }
    },

    deletePage: async (id: string) => {
      console.log("[pageStore] deletePage called with id:", id);

      const page = get().pagesById[id];
      if (!page) {
        console.error("[pageStore] Page not found:", id);
        return;
      }

      console.log("[pageStore] Deleting page:", {
        id: page.id,
        title: page.title,
        parentId: page.parentId,
      });

      const backup = { ...page };
      const backupIndex = get().pageIds.indexOf(id);

      // Optimistic update: remove from store immediately
      set((state) => {
        delete state.pagesById[id];
        state.pageIds = state.pageIds.filter((pid) => pid !== id);
        if (state.currentPageId === id) {
          state.currentPageId = state.pageIds[0] ?? null;
        }
      });

      console.log("[pageStore] Optimistically removed page from store");

      try {
        const workspacePath = useWorkspaceStore.getState().workspacePath;
        if (!workspacePath) {
          throw new Error("No workspace selected");
        }

        console.log("[pageStore] Invoking Tauri delete_page command...");
        await invoke("delete_page", { workspacePath, pageId: id });
        console.log(
          "[pageStore] Tauri delete_page command completed successfully"
        );
      } catch (error) {
        console.error("[pageStore] Error deleting page, rolling back:", error);
        // Rollback on error
        set((state) => {
          state.pagesById[backup.id] = backup;
          state.pageIds.splice(backupIndex, 0, backup.id);
        });
        throw error;
      }
    },

    selectPage: (id: string) => {
      set((state) => {
        state.currentPageId = id;
      });
    },

    setCurrentPageId: (id: string | null) => {
      set((state) => {
        state.currentPageId = id;
      });
    },

    clearPages: () => {
      set((state) => {
        state.pagesById = {};
        state.pageIds = [];
        state.currentPageId = null;
      });
    },

    movePage: async (id: string, newParentId: string | null) => {
      console.log("[pageStore.movePage] Called with:", {
        id,
        newParentId,
      });

      const page = get().pagesById[id];
      if (!page) {
        console.error("[pageStore.movePage] Page not found:", id);
        return;
      }

      console.log("[pageStore.movePage] Moving page:", {
        id: page.id,
        title: page.title,
        currentParentId: page.parentId,
        newParentId,
        filePath: page.filePath,
      });

      const fromPath = page.filePath;
      const oldParentId = page.parentId;
      const backup = { ...page };

      try {
        const workspacePath = useWorkspaceStore.getState().workspacePath;
        if (!workspacePath) {
          throw new Error("No workspace selected");
        }

        // Incremental update: send request and update store with backend response
        const updatedPage = await invoke<PageData>("move_page", {
          workspacePath,
          request: { id, parentId: newParentId },
        });

        // Update store with complete page data from backend
        set((state) => {
          state.pagesById[id] = updatedPage;
        });

        // Refetch new parent if moving into a parent (to reflect directory conversion)
        if (newParentId) {
          console.log(
            "[pageStore.movePage] Refetching new parent:",
            newParentId
          );
          try {
            const newParent = await invoke<PageData | null>("get_page", {
              workspacePath,
              request: { page_id: newParentId },
            });
            console.log("[pageStore.movePage] New parent fetched:", newParent);
            if (newParent) {
              console.log(
                "[pageStore.movePage] New parent before update:",
                get().pagesById[newParentId]
              );
              set((state) => {
                state.pagesById[newParentId] = newParent;
              });
              console.log(
                "[pageStore.movePage] New parent after update:",
                get().pagesById[newParentId]
              );
            }
          } catch (error) {
            console.warn(
              "[pageStore.movePage] Failed to refresh new parent:",
              error
            );
          }
        }

        // If moved away from a parent, refetch the old parent to reflect potential directory conversion
        if (oldParentId && oldParentId !== newParentId) {
          console.log(
            "[pageStore.movePage] Refetching old parent:",
            oldParentId
          );
          try {
            const oldParent = await invoke<PageData | null>("get_page", {
              workspacePath,
              request: { page_id: oldParentId },
            });
            console.log("[pageStore.movePage] Old parent fetched:", oldParent);
            if (oldParent) {
              console.log(
                "[pageStore.movePage] Old parent before update:",
                get().pagesById[oldParentId]
              );
              set((state) => {
                state.pagesById[oldParentId] = oldParent;
              });
              console.log(
                "[pageStore.movePage] Old parent after update:",
                get().pagesById[oldParentId]
              );
              console.log("[pageStore.movePage] All pageIds:", get().pageIds);
            }
          } catch (error) {
            console.warn(
              "[pageStore.movePage] Failed to refresh old parent:",
              error
            );
          }
        }

        const toPath = updatedPage.filePath;

        // Reindex wiki links to update any references affected by the page move
        if (fromPath !== toPath && fromPath && toPath) {
          await tauriAPI.reindexWikiLinks(workspacePath);

          // Refresh current file if it's open
          const ws = useWorkspaceStore.getState();
          if (ws.currentFile) {
            await ws.openFile(ws.currentFile);
          }
        }
      } catch (error) {
        console.error(
          "[pageStore.movePage] Error during move, rolling back:",
          error
        );
        // Rollback on error
        set((state) => {
          state.pagesById[id] = backup;
        });
        throw error;
      }
    },

    convertToDirectory: async (id: string) => {
      const workspacePath = useWorkspaceStore.getState().workspacePath;
      if (!workspacePath) {
        console.error("No workspace path");
        return;
      }

      // Incremental update: get the updated page from backend
      const updatedPage = await invoke<PageData>("convert_page_to_directory", {
        workspacePath,
        pageId: id,
      });

      // Update store with the backend response
      set((state) => {
        state.pagesById[id] = updatedPage;
      });

      // Trigger file tree refresh
      window.dispatchEvent(new CustomEvent("oxinot:file-tree-refresh"));
    },

    // ============ Path-based Navigation ============

    openPageByPath: async (fullPath: string): Promise<string> => {
      const state = get();
      let freshPageIds = state.pageIds;
      let freshPagesById = state.pagesById;

      // Ensure pages are loaded before trying to find
      if (freshPageIds.length === 0) {
        console.log("[pageStore] Pages not loaded yet, loading now...");
        const loadedData = await state.loadPages();
        freshPageIds = loadedData.pageIds;
        freshPagesById = loadedData.pagesById;
      }

      let pageId = findPageByPath(fullPath, freshPageIds, freshPagesById);

      if (!pageId) {
        try {
          const createdPageId = await createPageHierarchy(
            fullPath,
            state.createPage,
            (path: string) => {
              const currentState = get();
              return findPageByPath(
                path,
                currentState.pageIds,
                currentState.pagesById
              );
            },
            async (id: string) => {
              await get().convertToDirectory(id);
            }
          );

          if (!createdPageId) {
            throw new Error("Failed to create page hierarchy");
          }

          pageId = createdPageId;

          const loadedData = await get().loadPages();
          freshPageIds = loadedData.pageIds;
          freshPagesById = loadedData.pagesById;

          // Refresh file tree after creating new page hierarchy
          const workspacePath = useWorkspaceStore.getState().workspacePath;
          if (workspacePath) {
            const { loadDirectory } = useWorkspaceStore.getState();
            await loadDirectory(workspacePath);
          }

          pageId = findPageByPath(fullPath, freshPageIds, freshPagesById);
          if (!pageId) {
            throw new Error("Page not found after creation");
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error occurred";
          console.error("[pageStore] Failed to create page hierarchy:", error);
          throw new Error(`Failed to create page hierarchy: ${errorMessage}`);
        }
      }

      // Ensure store state is updated before returning
      // This handles the case where page was already in the system
      if (get().pagesById[pageId] === undefined) {
        console.log(
          "[pageStore] Refreshing pages to ensure pageId is in store..."
        );
        const loadedData = await get().loadPages();
        freshPageIds = loadedData.pageIds;
        freshPagesById = loadedData.pagesById;
      }

      return pageId;
    },

    openPageById: async (pageId: string): Promise<void> => {
      const state = get();
      const page = state.pagesById[pageId];

      if (!page) {
        throw new Error("Page not found");
      }

      state.setCurrentPageId(pageId);
    },

    // ============ Selectors ============

    getPage: (id: string) => get().pagesById[id],
  }))
);

// ============ Selector Hooks ============

export const usePage = (id: string) =>
  usePageStore((state) => state.pagesById[id]);

export const usePageChildrenIds = (parentId: string | null) =>
  usePageStore((state) => {
    // This is expensive if we iterate all pages every time
    // But since we are inside a selector, it runs on every store update
    // We can optimize this by maintaining a parent->children map in store if needed
    // For now, let's just filter
    return state.pageIds.filter((id) => {
      const page = state.pagesById[id];
      return page && (page.parentId ?? null) === parentId;
    });
  });

export const usePageIds = () => usePageStore((state) => state.pageIds);

export const useCurrentPageId = () =>
  usePageStore((state) => state.currentPageId);

export const usePagesLoading = () => usePageStore((state) => state.isLoading);

export const usePages = () => {
  const pageIds = usePageStore((state) => state.pageIds);
  const pagesById = usePageStore((state) => state.pagesById);
  return pageIds.map((id) => pagesById[id]);
};
