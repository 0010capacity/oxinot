import { Text } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useBlockStore } from "../stores/blockStore";
import { usePageStore } from "../stores/pageStore";
import { useBreadcrumb, useViewStore, useZoomPath } from "../stores/viewStore";
import "./breadcrumb.css";

const BREADCRUMB_MAX_LENGTH = 30;
const CHEVRON_SIZE = 16;
const CHEVRON_OPACITY = 0.3;

interface BreadcrumbProps {
  workspaceName: string;
  onNavigateHome: () => void;
}

interface BreadcrumbItemProps {
  text: string;
  isLast: boolean;
  onClick?: () => void | Promise<void>;
  title?: string;
  ariaLabel?: string;
  ariaCurrentPage?: boolean;
}

function BreadcrumbItem({
  text,
  isLast,
  onClick,
  title,
  ariaLabel,
  ariaCurrentPage,
}: BreadcrumbItemProps) {
  const isButton = !isLast && onClick;

  const textElement = (
    <Text
      size="xl"
      fw={isLast ? 600 : 400}
      c={isLast ? undefined : "dimmed"}
      title={title}
      className="breadcrumb-text"
    >
      {text}
    </Text>
  );

  if (isButton) {
    return (
      <button
        type="button"
        className="breadcrumb-item breadcrumb-button"
        onClick={onClick}
        aria-label={ariaLabel}
        aria-current={ariaCurrentPage ? "page" : undefined}
      >
        {textElement}
      </button>
    );
  }

  return (
    <div
      className="breadcrumb-item breadcrumb-text-wrapper"
      role="presentation"
      aria-label={ariaLabel}
      aria-current={ariaCurrentPage ? "page" : undefined}
    >
      {textElement}
    </div>
  );
}

function truncateText(
  text: string,
  maxLength: number = BREADCRUMB_MAX_LENGTH,
): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

export function Breadcrumb({ workspaceName, onNavigateHome }: BreadcrumbProps) {
  const { t } = useTranslation();
  const zoomPath = useZoomPath();
  const breadcrumb = useBreadcrumb();
  const pagePathIds = useViewStore((state) => state.pagePathIds);
  const { openNote, zoomIntoBlock, updateZoomPath } = useViewStore();
  const blocksById = useBlockStore((state) => state.blocksById);
  const loadPage = useBlockStore((state) => state.loadPage);
  const selectPage = usePageStore((state) => state.selectPage);
  const pagesById = usePageStore((state) => state.pagesById);

  const [isLoading, setIsLoading] = useState(false);

  const handleZoomToLevel = useCallback(
    (index: number) => {
      const targetBlockId = zoomPath[index];
      if (targetBlockId) {
        const newPath = zoomPath.slice(0, index + 1);
        zoomIntoBlock(targetBlockId);
        updateZoomPath(newPath);
      }
    },
    [zoomPath, zoomIntoBlock, updateZoomPath],
  );

  const handleZoomOutToPage = useCallback(() => {
    const { zoomOutToNote } = useViewStore.getState();
    zoomOutToNote();
  }, []);

  const handleNavigateToPage = useCallback(
    async (pageIdIndex: number) => {
      try {
        setIsLoading(true);
        const pageId = pagePathIds[pageIdIndex];
        const page = pagesById[pageId];

        if (!pageId || !page) {
          console.error(
            "[Breadcrumb] Invalid page navigation: pageId or page not found",
          );
          return;
        }

        await selectPage(pageId);
        await loadPage(pageId);

        const parentNames: string[] = [];
        const parentIds: string[] = [];

        for (let i = 0; i < pageIdIndex; i++) {
          const parentId = pagePathIds[i];
          const parentPage = pagesById[parentId];
          if (parentPage) {
            parentNames.push(parentPage.title);
            parentIds.push(parentId);
          }
        }
        parentIds.push(pageId);

        openNote(pageId, page.title, parentNames, parentIds);
        handleZoomOutToPage();
      } catch (error) {
        console.error("[Breadcrumb] Failed to navigate to page:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [
      pagePathIds,
      pagesById,
      selectPage,
      loadPage,
      openNote,
      handleZoomOutToPage,
    ],
  );
  const breadcrumbItems = breadcrumb.length > 0 ? breadcrumb : [workspaceName];

  const hasZoom = zoomPath.length > 0;

  return (
    <nav className="breadcrumb-nav" aria-label="Breadcrumb">
      <ol className="breadcrumb-list">
        {breadcrumbItems.map((item, index) => {
          const isFirst = index === 0;
          const isPageLast = index === breadcrumbItems.length - 1;
          const isWorkspace = index === 0;
          const isCurrentPage = isPageLast && !hasZoom;
          const displayText = truncateText(item);

          return (
            <li key={`${index}-${item}`} className="breadcrumb-list-item">
              {!isFirst && (
                <IconChevronRight
                  size={CHEVRON_SIZE}
                  opacity={CHEVRON_OPACITY}
                  className="breadcrumb-chevron"
                  aria-hidden="true"
                />
              )}
              <BreadcrumbItem
                text={displayText}
                isLast={isCurrentPage}
                title={item}
                ariaLabel={isWorkspace ? t("common.workspace") : item}
                ariaCurrentPage={isCurrentPage}
                onClick={
                  isWorkspace
                    ? onNavigateHome
                    : isLoading
                      ? undefined
                      : () => {
                          const pageIdIndex = index - 1;
                          handleNavigateToPage(pageIdIndex);
                        }
                }
              />
            </li>
          );
        })}

        {zoomPath.map((blockId, index) => {
          const block = blocksById[blockId];
          if (!block) return null;

          const isZoomLast = index === zoomPath.length - 1;
          const displayText = truncateText(
            block.content || t("common.untitled_block"),
          );

          return (
            <li
              key={`block-${index}-${blockId}`}
              className="breadcrumb-list-item"
            >
              <IconChevronRight
                size={CHEVRON_SIZE}
                opacity={CHEVRON_OPACITY}
                className="breadcrumb-chevron"
                aria-hidden="true"
              />
              <BreadcrumbItem
                text={displayText}
                isLast={isZoomLast}
                title={block.content}
                ariaLabel={displayText}
                ariaCurrentPage={isZoomLast}
                onClick={
                  isZoomLast || isLoading
                    ? undefined
                    : () => handleZoomToLevel(index)
                }
              />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
