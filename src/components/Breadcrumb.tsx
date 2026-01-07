import { Group, Text, ActionIcon } from "@mantine/core";
import { IconHome, IconChevronRight } from "@tabler/icons-react";
import { useViewStore, useZoomPath } from "../stores/viewStore";
import { useBlockStore } from "../stores/blockStore";

interface BreadcrumbProps {
  workspaceName: string;
  pageName?: string;
  onNavigateHome: () => void;
}

export function Breadcrumb({
  workspaceName,
  pageName,
  onNavigateHome,
}: BreadcrumbProps) {
  const zoomPath = useZoomPath();
  const { zoomOutToNote } = useViewStore();
  const blocksById = useBlockStore((state) => state.blocksById);

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

  const truncateText = (text: string, maxLength: number = 30) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
  };

  return (
    <Group gap="xs" wrap="nowrap">
      <ActionIcon
        size="sm"
        variant="subtle"
        onClick={onNavigateHome}
        title="Back to workspace"
      >
        <IconHome size={16} />
      </ActionIcon>

      <Text
        size="sm"
        c="dimmed"
        style={{ cursor: "pointer" }}
        onClick={onNavigateHome}
      >
        {workspaceName}
      </Text>

      {pageName && (
        <>
          <IconChevronRight size={14} opacity={0.5} />
          <Text
            size="sm"
            fw={zoomPath.length === 0 ? 500 : 400}
            c={zoomPath.length > 0 ? "dimmed" : undefined}
            style={{ cursor: zoomPath.length > 0 ? "pointer" : "default" }}
            onClick={
              zoomPath.length > 0 ? () => handleZoomToLevel(-1) : undefined
            }
          >
            {pageName}
          </Text>
        </>
      )}

      {/* Display all blocks in zoom path */}
      {zoomPath.map((blockId, index) => {
        const block = blocksById[blockId];
        if (!block) return null;

        const isLast = index === zoomPath.length - 1;
        const displayText = truncateText(block.content || "Untitled Block");

        return (
          <Group gap="xs" wrap="nowrap" key={blockId}>
            <IconChevronRight size={14} opacity={0.5} />
            <Text
              size="sm"
              fw={isLast ? 500 : 400}
              c={isLast ? undefined : "dimmed"}
              style={{
                cursor: isLast ? "default" : "pointer",
                whiteSpace: "nowrap",
              }}
              onClick={!isLast ? () => handleZoomToLevel(index) : undefined}
              title={block.content}
            >
              {displayText}
            </Text>
          </Group>
        );
      })}
    </Group>
  );
}
