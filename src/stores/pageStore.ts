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

        set((state) => {
          state.pagesById = pagesById;
          state.pageIds = pageIds;
          state.isLoading = false;

          // Auto-select first page if available and no page is currently selected
          if (pageIds.length > 0 && !state.currentPageId) {
            state.currentPageId = pageIds[0];
          }
        });

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

      // Don't manually update store - let loadPages handle it
      // This prevents race conditions and ensures consistency
      return newPage.id;
    },

    updatePageTitle: async (id: string, title: string) => {
      const page = get().pagesById[id];
      if (!page) return;

      const previousTitle = page.title;

      set((state) => {
        if (state.pagesById[id]) {
          state.pagesById[id].title = title;
          state.pagesById[id].updatedAt = new Date().toISOString();
        }
      });

      try {
        const workspacePath = useWorkspaceStore.getState().workspacePath;
        if (!workspacePath) {
          throw new Error("No workspace selected");
        }

        await invoke("update_page", {
          workspacePath,
          request: { id, title },
        });
      } catch (error) {
        set((state) => {
          if (state.pagesById[id]) {
            state.pagesById[id].title = previousTitle;
          }
        });
        throw error;
      }
    },

    deletePage: async (id: string) => {
      const page = get().pagesById[id];
      if (!page) return;

      const backup = { ...page };
      const backupIndex = get().pageIds.indexOf(id);

      set((state) => {
        delete state.pagesById[id];
        state.pageIds = state.pageIds.filter((pid) => pid !== id);
        if (state.currentPageId === id) {
          state.currentPageId = state.pageIds[0] ?? null;
        }
      });

      try {
        const workspacePath = useWorkspaceStore.getState().workspacePath;
        if (!workspacePath) {
          throw new Error("No workspace selected");
        }

        await invoke("delete_page", { workspacePath, pageId: id });
      } catch (error) {
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
      const page = get().pagesById[id];
      if (!page) return;

      const previousParentId = page.parentId;
      const fromPath = page.filePath;

      set((state) => {
        if (state.pagesById[id]) {
          state.pagesById[id].parentId = newParentId || undefined;
          state.pagesById[id].updatedAt = new Date().toISOString();
        }
      });

      try {
        const workspacePath = useWorkspaceStore.getState().workspacePath;
        if (!workspacePath) {
          throw new Error("No workspace selected");
        }

        const updatedPage = await invoke<PageData>("move_page", {
          workspacePath,
          request: { id, newParentId },
        });

        // Keep page store in sync with backend-returned filePath/updatedAt
        set((state) => {
          const current = state.pagesById[id];
          if (current) {
            state.pagesById[id] = {
              ...current,
              parentId: updatedPage.parentId,
              filePath: updatedPage.filePath,
              updatedAt: updatedPage.updatedAt,
            };
          }
        });

        const toPath = updatedPage.filePath;

        // Targeted rewrite in DB (blocks) using backlink/indexed lookup.
        // Convert "A/B/C.md" -> "A/B/C" because wikilinks use [[path/to/page]].
        const fromTarget = fromPath?.toLowerCase().endsWith(".md")
          ? fromPath.slice(0, -3)
          : fromPath;
        const toTarget = toPath?.toLowerCase().endsWith(".md")
          ? toPath.slice(0, -3)
          : toPath;

        if (fromTarget && toTarget && fromTarget !== toTarget) {
          await tauriAPI.rewriteWikiLinksForPagePathChange(
            workspacePath,
            fromTarget,
            toTarget
          );

          // If current editor buffer has old target, refresh by re-opening current file.
          // (Keeps UI consistent without scanning the whole workspace.)
          const ws = useWorkspaceStore.getState();
          if (ws.currentFile) {
            await ws.openFile(ws.currentFile);
          }
        }
      } catch (error) {
        set((state) => {
          if (state.pagesById[id]) {
            state.pagesById[id].parentId = previousParentId;
          }
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

      await invoke("convert_page_to_directory", {
        workspacePath,
        pageId: id,
      });

      // Reload pages to reflect the change (icon update etc)
      await get().loadPages();

      // Also update file tree if it's open
      // We can dispatch a custom event or rely on file system watcher if implemented
      // For now, let's trigger a refresh via window event that FileTreeView listens to
      window.dispatchEvent(new CustomEvent("oxinot:file-tree-refresh"));

      // Update the page object in store to reflect is_directory = true
      set((state) => {
        const page = state.pagesById[id];
        if (page) {
          state.pagesById[id] = { ...page, isDirectory: true };
        }
      });
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

export const usePageIds = () => usePageStore((state) => state.pageIds);

export const useCurrentPageId = () =>
  usePageStore((state) => state.currentPageId);

export const usePagesLoading = () => usePageStore((state) => state.isLoading);

export const usePages = () => {
  const pageIds = usePageStore((state) => state.pageIds);
  const pagesById = usePageStore((state) => state.pagesById);
  return pageIds.map((id) => pagesById[id]);
};
