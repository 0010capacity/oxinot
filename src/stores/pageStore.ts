import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { invoke } from "@tauri-apps/api/core";

// ============ Types ============

export interface PageData {
  id: string;
  title: string;
  filePath?: string;
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
  loadPages: () => Promise<void>;

  // 페이지 CRUD
  createPage: (title: string) => Promise<string>;
  updatePageTitle: (id: string, title: string) => Promise<void>;
  deletePage: (id: string) => Promise<void>;

  // 페이지 선택
  selectPage: (id: string) => void;
  clearPages: () => void;

  // 셀렉터
  getPage: (id: string) => PageData | undefined;
}

type PageStore = PageState & PageActions;

// ============ Store Implementation ============

export const usePageStore = create<PageStore>()(
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
        const pages: PageData[] = await invoke("get_pages");

        set((state) => {
          const pagesById: Record<string, PageData> = {};
          const pageIds: string[] = [];

          for (const page of pages) {
            pagesById[page.id] = page;
            pageIds.push(page.id);
          }

          state.pagesById = pagesById;
          state.pageIds = pageIds;
          state.isLoading = false;

          // Auto-select first page if available and no page is currently selected
          if (pageIds.length > 0 && !state.currentPageId) {
            state.currentPageId = pageIds[0];
          }
        });
      } catch (error) {
        set((state) => {
          state.error =
            error instanceof Error ? error.message : "Failed to load pages";
          state.isLoading = false;
        });
      }
    },

    createPage: async (title: string) => {
      try {
        const newPage: PageData = await invoke("create_page", {
          request: { title },
        });

        set((state) => {
          state.pagesById[newPage.id] = newPage;
          state.pageIds.push(newPage.id);
          state.currentPageId = newPage.id;
        });

        return newPage.id;
      } catch (error) {
        throw error;
      }
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
        await invoke("update_page", {
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
        await invoke("delete_page", { pageId: id });
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

    clearPages: () => {
      set((state) => {
        state.pagesById = {};
        state.pageIds = [];
        state.currentPageId = null;
      });
    },

    // ============ Selectors ============

    getPage: (id: string) => get().pagesById[id],
  })),
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
