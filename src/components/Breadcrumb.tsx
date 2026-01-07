import { Group, Text, ActionIcon } from "@mantine/core";
import { IconHome, IconChevronRight } from "@tabler/icons-react";
import { useViewStore, useFocusedBlockId } from "../stores/viewStore";
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
  const focusedBlockId = useFocusedBlockId();
  const { zoomOutToNote } = useViewStore();
  const block = useBlockStore((state) =>
    focusedBlockId ? state.blocksById[focusedBlockId] : null,
  );

  const handleZoomOut = () => {
    if (focusedBlockId) {
      zoomOutToNote();
    }
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
            fw={focusedBlockId ? 400 : 500}
            c={focusedBlockId ? "dimmed" : undefined}
            style={{ cursor: focusedBlockId ? "pointer" : "default" }}
            onClick={focusedBlockId ? handleZoomOut : undefined}
          >
            {pageName}
          </Text>
        </>
      )}

      {focusedBlockId && block && (
        <>
          <IconChevronRight size={14} opacity={0.5} />
          <Text size="sm" fw={500}>
            {block.content.slice(0, 50) || "Block"}
            {block.content.length > 50 ? "..." : ""}
          </Text>
        </>
      )}
    </Group>
  );
}
