import React, { useState } from "react";
import {
  Stack,
  Text,
  Button,
  Group,
  ActionIcon,
  Paper,
  ScrollArea,
  Divider,
  Tooltip,
  TextInput,
} from "@mantine/core";
import {
  IconFolder,
  IconPlus,
  IconTrash,
  IconFolderOpen,
  IconClock,
} from "@tabler/icons-react";
import { useWorkspaceStore, type WorkspaceInfo } from "../stores/workspaceStore";
import { useMantineColorScheme } from "@mantine/core";

interface WorkspacePickerProps {
  onWorkspaceSelected?: () => void;
}

export function WorkspacePicker({ onWorkspaceSelected }: WorkspacePickerProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";

  const workspaces = useWorkspaceStore((state) => state.getWorkspaces());
  const openWorkspace = useWorkspaceStore((state) => state.openWorkspace);
  const selectWorkspace = useWorkspaceStore((state) => state.selectWorkspace);
  const removeWorkspace = useWorkspaceStore((state) => state.removeWorkspace);

  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  const handleOpenWorkspace = async (path: string) => {
    await openWorkspace(path);
    onWorkspaceSelected?.();
  };

  const handleAddWorkspace = async () => {
    await selectWorkspace();
    onWorkspaceSelected?.();
  };

  const handleRemoveWorkspace = (
    e: React.MouseEvent,
    path: string,
  ) => {
    e.stopPropagation();
    removeWorkspace(path);
  };

  const formatLastAccessed = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <Stack gap="lg" style={{ height: "100%", padding: "24px" }}>
      {/* Header */}
      <div>
        <Text size="xl" fw={700} mb={4}>
          Workspaces
        </Text>
        <Text size="sm" c="dimmed">
          Select a workspace to open or add a new one
        </Text>
      </div>

      {/* Workspace List */}
      <ScrollArea style={{ flex: 1 }} offsetScrollbars>
        {workspaces.length === 0 ? (
          <Stack
            align="center"
            justify="center"
            gap="md"
            style={{
              height: "200px",
              opacity: 0.6,
            }}
          >
            <IconFolder size={48} stroke={1.5} />
            <Text size="sm" c="dimmed" ta="center">
              No workspaces yet
              <br />
              Add one to get started
            </Text>
          </Stack>
        ) : (
          <Stack gap="xs">
            {workspaces.map((workspace) => (
              <Paper
                key={workspace.path}
                p="md"
                radius="md"
                style={{
                  cursor: "pointer",
                  backgroundColor:
                    hoveredPath === workspace.path
                      ? isDark
                        ? "#2C2E33"
                        : "#F8F9FA"
                      : isDark
                        ? "#25262b"
                        : "#fff",
                  border: `1px solid ${isDark ? "#373A40" : "#e9ecef"}`,
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={() => setHoveredPath(workspace.path)}
                onMouseLeave={() => setHoveredPath(null)}
                onClick={() => handleOpenWorkspace(workspace.path)}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                    <IconFolderOpen
                      size={20}
                      style={{
                        flexShrink: 0,
                        color: isDark ? "#748ffc" : "#5c7cfa",
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text size="sm" fw={500} truncate>
                        {workspace.name}
                      </Text>
                      <Text
                        size="xs"
                        c="dimmed"
                        truncate
                        style={{ marginTop: 2 }}
                      >
                        {workspace.path}
                      </Text>
                    </div>
                  </Group>
                  <Group gap={4} wrap="nowrap">
                    <Tooltip label={`Last accessed: ${formatLastAccessed(workspace.lastAccessed)}`}>
                      <Group gap={4} style={{ flexShrink: 0 }}>
                        <IconClock size={14} opacity={0.5} />
                        <Text size="xs" c="dimmed">
                          {formatLastAccessed(workspace.lastAccessed)}
                        </Text>
                      </Group>
                    </Tooltip>
                    <Tooltip label="Remove workspace">
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="red"
                        onClick={(e) => handleRemoveWorkspace(e, workspace.path)}
                        style={{
                          opacity: hoveredPath === workspace.path ? 1 : 0,
                          transition: "opacity 0.15s ease",
                        }}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </ScrollArea>

      <Divider />

      {/* Add Workspace Button */}
      <Button
        leftSection={<IconPlus size={18} />}
        onClick={handleAddWorkspace}
        variant="light"
        fullWidth
        size="md"
      >
        Add Workspace
      </Button>
    </Stack>
  );
}
