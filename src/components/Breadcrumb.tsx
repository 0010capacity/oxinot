import { Group, Text, ActionIcon } from "@mantine/core";
import { IconChevronRight, IconHome } from "@tabler/icons-react";

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

      <Text size="sm" c="dimmed">
        {workspaceName}
      </Text>

      {pageName && (
        <>
          <IconChevronRight size={14} opacity={0.5} />
          <Text size="sm" fw={500}>
            {pageName}
          </Text>
        </>
      )}
    </Group>
  );
}
