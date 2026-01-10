import { ActionIcon, Tooltip } from "@mantine/core";
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import { useNavigationStore } from "../stores/navigationStore";
import { usePageStore } from "../stores/pageStore";
import { useViewStore } from "../stores/viewStore";

interface NavigationButtonsProps {
  compact?: boolean;
}

export function NavigationButtons({ compact = false }: NavigationButtonsProps) {
  const canGoBack = useNavigationStore((state) => state.canGoBack());
  const canGoForward = useNavigationStore((state) => state.canGoForward());
  const goBack = useNavigationStore((state) => state.goBack);
  const goForward = useNavigationStore((state) => state.goForward);
  const setCurrentPageId = usePageStore((state) => state.setCurrentPageId);
  const openNote = useViewStore((state) => state.openNote);
  const pagesById = usePageStore((state) => state.pagesById);

  const handleGoBack = () => {
    const entry = goBack();
    if (entry) {
      setCurrentPageId(entry.pageId);
      const page = pagesById[entry.pageId];
      if (page) {
        // Build breadcrumb path
        const parentNames: string[] = [];
        const pagePathIds: string[] = [];
        let currentId: string | undefined = page.parentId;

        while (currentId) {
          const parentPage = pagesById[currentId];
          if (!parentPage) break;
          parentNames.unshift(parentPage.title);
          pagePathIds.unshift(currentId);
          currentId = parentPage.parentId;
        }

        pagePathIds.push(entry.pageId);
        openNote(entry.pageId, page.title, parentNames, pagePathIds);
      }
    }
  };

  const handleGoForward = () => {
    const entry = goForward();
    if (entry) {
      setCurrentPageId(entry.pageId);
      const page = pagesById[entry.pageId];
      if (page) {
        // Build breadcrumb path
        const parentNames: string[] = [];
        const pagePathIds: string[] = [];
        let currentId: string | undefined = page.parentId;

        while (currentId) {
          const parentPage = pagesById[currentId];
          if (!parentPage) break;
          parentNames.unshift(parentPage.title);
          pagePathIds.unshift(currentId);
          currentId = parentPage.parentId;
        }

        pagePathIds.push(entry.pageId);
        openNote(entry.pageId, page.title, parentNames, pagePathIds);
      }
    }
  };

  return (
    <div
      style={{
        display: "flex",
        gap: "2px",
        alignItems: "center",
        marginLeft: compact ? "16px" : "0px",
      }}
    >
      <Tooltip label="뒤로가기" position="bottom" withArrow>
        <ActionIcon
          variant={compact ? "transparent" : "subtle"}
          size={compact ? "md" : "md"}
          onClick={handleGoBack}
          disabled={!canGoBack}
          style={{
            opacity: canGoBack ? 1 : 0.3,
            backgroundColor: "transparent",
            color: "var(--color-text-secondary)",
            padding: compact ? "6px" : undefined,
          }}
        >
          <IconArrowLeft size={compact ? 28 : 22} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label="앞으로가기" position="bottom" withArrow>
        <ActionIcon
          variant={compact ? "transparent" : "subtle"}
          size={compact ? "md" : "md"}
          onClick={handleGoForward}
          disabled={!canGoForward}
          style={{
            opacity: canGoForward ? 1 : 0.3,
            backgroundColor: "transparent",
            color: "var(--color-text-secondary)",
            padding: compact ? "6px" : undefined,
          }}
        >
          <IconArrowRight size={compact ? 28 : 22} />
        </ActionIcon>
      </Tooltip>
    </div>
  );
}
