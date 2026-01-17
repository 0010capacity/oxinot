import { useAppSettingsStore } from "@/stores/appSettingsStore";
import { useErrorStore } from "@/stores/errorStore";
import { usePageStore } from "@/stores/pageStore";
import { useViewStore } from "@/stores/viewStore";
import { buildPageBreadcrumb } from "@/utils/pageUtils";
import { useCallback } from "react";

export interface UseHomepageReturn {
  openHomepage: () => Promise<void>;
}

export const useHomepage = (): UseHomepageReturn => {
  const { openPageByPath, openPageById, pagesById } = usePageStore();
  const { showIndex, openNote } = useViewStore();
  const homepageType = useAppSettingsStore((state) => state.homepageType);
  const customHomepageId = useAppSettingsStore(
    (state) => state.customHomepageId
  );
  const getDailyNotePath = useAppSettingsStore(
    (state) => state.getDailyNotePath
  );

  const addError = useErrorStore((state) => state.addError);

  const openHomepage = useCallback(async (): Promise<void> => {
    try {
      if (homepageType === "index") {
        showIndex();
      } else if (homepageType === "daily-note") {
        try {
          const today = new Date();
          const fullPath = getDailyNotePath(today);
          const pageId = await openPageByPath(fullPath);
          const page = pagesById[pageId];

          if (!page) {
            throw new Error("Page not found after opening");
          }

          const { names, ids } = buildPageBreadcrumb(pageId, pagesById);
          openNote(pageId, page.title, names, ids);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error occurred";
          console.error("[useHomepage] Failed to open daily note:", error);
          addError(`Failed to open daily note: ${errorMessage}`, {
            type: "error",
            details: String(error),
          });
          showIndex();
        }
      } else if (
        homepageType === "custom-page" &&
        customHomepageId !== null &&
        customHomepageId !== undefined
      ) {
        try {
          await openPageById(customHomepageId);
          const page = pagesById[customHomepageId];

          if (!page) {
            throw new Error("Custom page not found");
          }

          const { names, ids } = buildPageBreadcrumb(
            customHomepageId,
            pagesById
          );
          openNote(customHomepageId, page.title, names, ids);
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
    openPageById,
    pagesById,
    openNote,
    addError,
  ]);

  return { openHomepage };
};
