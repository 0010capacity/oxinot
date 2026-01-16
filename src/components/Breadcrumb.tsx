import { Group, Text } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useBlockStore } from "../stores/blockStore";
import { usePageStore } from "../stores/pageStore";
import { useBreadcrumb, useViewStore, useZoomPath } from "../stores/viewStore";
import "./breadcrumb.css";

interface BreadcrumbProps {
  workspaceName: string;
  pageName?: string;
  onNavigateHome: () => void;
}

export function Breadcrumb({
  workspaceName,

  onNavigateHome,
}: BreadcrumbProps) {
  const { t } = useTranslation();
  const zoomPath = useZoomPath();
  const breadcrumb = useBreadcrumb();
  const pagePathIds = useViewStore((state) => state.pagePathIds);
  const { zoomOutToNote, openNote } = useViewStore();
  const blocksById = useBlockStore((state) => state.blocksById);
  const loadPage = useBlockStore((state) => state.loadPage);
  const selectPage = usePageStore((state) => state.selectPage);
  const pagesById = usePageStore((state) => state.pagesById);

  const handleZoomToLevel = (index: number) => {
    if (index === -1) {
      // Clicked on page name - zoom out to note level
      zoomOutToNote();
    } else {
      // Clicked on a block in the path - zoom to that level
      const targetBlockId = zoomPath[index];
      if (targetBlockId) {
        // Update zoom path to only include blocks up to this level
        const newPath = zoomPath.slice(0, index + 1);
        // Set the view store state directly
        useViewStore.setState({
          focusedBlockId: targetBlockId,
          zoomPath: newPath,
        });
      }
    }
  };

  const truncateText = (text: string, maxLength = 30) => {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
  };

  // Use breadcrumb array from store which includes all parent pages
  const breadcrumbItems = breadcrumb.length > 0 ? breadcrumb : [workspaceName];
  // const isInPage = breadcrumbItems.length > 1;

  return (
    <Group gap="xs" wrap="nowrap">
      {breadcrumbItems.map((item, index) => {
        const isFirst = index === 0;
        const isLast = index === breadcrumbItems.length - 1;
        const isWorkspace = index === 0;

        return (
          <Group gap="xs" wrap="nowrap" key={item}>
            {!isFirst && <IconChevronRight size={16} opacity={0.3} />}
            {isWorkspace || !isLast ? (
              <button
                type="button"
                className="breadcrumb-item breadcrumb-button"
                onClick={
                  isWorkspace
                    ? onNavigateHome
                    : async () => {
                        // Navigate to intermediate page
                        // index 0 = workspace (skip)
                        // index 1 = first page, etc.
                        const pageIdIndex = index - 1; // Adjust for workspace at index 0
                        const pageId = pagePathIds[pageIdIndex];
                        if (pageId && pagesById[pageId]) {
                          const page = pagesById[pageId];
                          await selectPage(pageId);
                          await loadPage(pageId);

                          // Build parent path for this page
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
                        }
                      }
                }
              >
                <Text
                  size="xl"
                  fw={isLast ? 600 : 400}
                  c={isLast ? undefined : "dimmed"}
                >
                  {truncateText(item)}
                </Text>
              </button>
            ) : (
              <Text
                size="xl"
                fw={isLast ? 600 : 400}
                c={isLast ? undefined : "dimmed"}
              >
                {truncateText(item)}
              </Text>
            )}
          </Group>
        );
      })}

      {/* Display all blocks in zoom path */}
      {zoomPath.map((blockId, index) => {
        const block = blocksById[blockId];
        if (!block) return null;

        const isLast = index === zoomPath.length - 1;
        const displayText = truncateText(
          block.content || t("common.untitled_block")
        );

        return (
          <Group gap="xs" wrap="nowrap" key={blockId}>
            <IconChevronRight size={16} opacity={0.3} />
            {!isLast ? (
              <button
                type="button"
                className="breadcrumb-item breadcrumb-button"
                onClick={() => handleZoomToLevel(index)}
                title={block.content}
              >
                <Text
                  size="xl"
                  fw={isLast ? 600 : 400}
                  c={isLast ? undefined : "dimmed"}
                >
                  {displayText}
                </Text>
              </button>
            ) : (
              <Text
                size="xl"
                fw={isLast ? 600 : 400}
                c={isLast ? undefined : "dimmed"}
                title={block.content}
              >
                {displayText}
              </Text>
            )}
          </Group>
        );
      })}
    </Group>
  );
}
