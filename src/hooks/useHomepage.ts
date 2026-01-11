import { useCallback } from "react";
import { usePageStore } from "@/stores/pageStore";
import { useViewStore } from "@/stores/viewStore";
import { useAppSettingsStore } from "@/stores/appSettingsStore";
import { useErrorStore } from "@/stores/errorStore";
import {
  buildPageBreadcrumb,
  findPageByPath,
  createPageHierarchy,
} from "@/utils/pageUtils";

export interface UseHomepageReturn {
  openHomepage: () => Promise<void>;
}

export const useHomepage = (): UseHomepageReturn => {
  const { loadPages, createPage, pageIds, pagesById, setCurrentPageId } =
    usePageStore();
  const { showIndex, openNote } = useViewStore();
  const homepageType = useAppSettingsStore((state) => state.homepageType);
  const customHomepageId = useAppSettingsStore(
    (state) => state.customHomepageId,
  );
  const getDailyNotePath = useAppSettingsStore(
    (state) => state.getDailyNotePath,
  );

  const addError = useErrorStore((state) => state.addError);

  const openPageByPath = useCallback(
    async (fullPath: string): Promise<void> => {
      try {
        // Ensure pages are loaded before trying to find
        let freshPageIds = pageIds;
        let freshPagesById = pagesById;

        if (pageIds.length === 0) {
          console.log("[useHomepage] Pages not loaded yet, loading now...");
          const loadedData = await loadPages();
          freshPageIds = loadedData.pageIds;
          freshPagesById = loadedData.pagesById;
        }

        let pageId = findPageByPath(fullPath, freshPageIds, freshPagesById);

        if (!pageId) {
          try {
            const createdPageId = await createPageHierarchy(
              fullPath,
              createPage,
              (path: string) => {
                const state = usePageStore.getState();
                return findPageByPath(path, state.pageIds, state.pagesById);
              },
              async (pageId: string) => {
                const { convertToDirectory } = usePageStore.getState();
                await convertToDirectory(pageId);
              },
            );

            if (!createdPageId) {
              console.error("[useHomepage] Failed to create page hierarchy");
              addError("Failed to create page hierarchy", {
                type: "error",
              });
              showIndex();
              return;
            }

            pageId = createdPageId;

            const loadedData = await loadPages();
            freshPageIds = loadedData.pageIds;
            freshPagesById = loadedData.pagesById;

            pageId = findPageByPath(fullPath, freshPageIds, freshPagesById);
            if (!pageId) {
              console.error(
                "[useHomepage] Created page not found after reload",
              );
              addError("Page creation failed: Page not found after reload", {
                type: "error",
              });
              showIndex();
              return;
            }

            const { names, ids } = buildPageBreadcrumb(pageId, freshPagesById);
            const page = freshPagesById[pageId];

            setCurrentPageId(pageId);
            openNote(pageId, page.title, names, ids);
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error occurred";
            console.error("[useHomepage] Failed to create page:", error);
            addError(`Failed to create page: ${errorMessage}`, {
              type: "error",
              details: String(error),
            });
            showIndex();
          }
        } else {
          const page = freshPagesById[pageId];
          if (!page) {
            console.error("[useHomepage] Page data not found");
            addError("Page data not found", {
              type: "error",
            });
            showIndex();
            return;
          }

          const { names, ids } = buildPageBreadcrumb(pageId, freshPagesById);

          setCurrentPageId(pageId);
          openNote(pageId, page.title, names, ids);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        console.error("[useHomepage] Unexpected error opening page:", error);
        addError(`Unexpected error: ${errorMessage}`, {
          type: "error",
          details: String(error),
        });
        showIndex();
      }
    },
    [
      pageIds,
      pagesById,
      createPage,
      loadPages,
      setCurrentPageId,
      openNote,
      showIndex,
      addError,
    ],
  );

  const openCustomPage = useCallback(
    (pageId: string): void => {
      try {
        const page = pagesById[pageId];
        if (!page) {
          console.error("[useHomepage] Custom page not found");
          addError("Custom homepage page not found", {
            type: "error",
          });
          showIndex();
          return;
        }

        const { names, ids } = buildPageBreadcrumb(pageId, pagesById);
        setCurrentPageId(pageId);
        openNote(pageId, page.title, names, ids);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        console.error("[useHomepage] Failed to open custom page:", error);
        addError(`Failed to open custom page: ${errorMessage}`, {
          type: "error",
          details: String(error),
        });
        showIndex();
      }
    },
    [
      pageIds,
      pagesById,
      loadPages,
      createPage,
      setCurrentPageId,
      openNote,
      showIndex,
      addError,
    ],
  );

  const openHomepage = useCallback(async (): Promise<void> => {
    try {
      if (homepageType === "index") {
        showIndex();
      } else if (homepageType === "daily-note") {
        const today = new Date();
        const fullPath = getDailyNotePath(today);
        await openPageByPath(fullPath);
      } else if (
        homepageType === "custom-page" &&
        customHomepageId !== null &&
        customHomepageId !== undefined
      ) {
        openCustomPage(customHomepageId);
      } else {
        showIndex();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("[useHomepage] Failed to open homepage:", error);
      addError(`Failed to open homepage: ${errorMessage}`, {
        type: "error",
        details: String(error),
      });
      showIndex();
    }
  }, [
    homepageType,
    customHomepageId,
    getDailyNotePath,
    showIndex,
    openPageByPath,
    openCustomPage,
    addError,
  ]);

  return { openHomepage };
};
