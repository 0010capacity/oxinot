import {
  ActionIcon,
  Button,
  Divider,
  Group,
  Menu,
  Modal,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { useMantineColorScheme } from "@mantine/core";
import {
  IconCheck,
  IconChevronDown,
  IconFolder,
  IconPlus,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";
import { useSyncStore } from "../stores/syncStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { tauriAPI } from "../tauri-api";
import { showNotification, showToast } from "../utils/toast";

interface WorkspacePickerProps {
  currentWorkspacePath: string | null;
}

export function WorkspacePicker({
  currentWorkspacePath,
}: WorkspacePickerProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<string | null>(
    null,
  );

  const workspaces = useWorkspaceStore((state) => state.getWorkspaces());
  const openWorkspace = useWorkspaceStore((state) => state.openWorkspace);
  const selectWorkspace = useWorkspaceStore((state) => state.selectWorkspace);
  const removeWorkspace = useWorkspaceStore((state) => state.removeWorkspace);
  const { startReindex, updateProgress, finishReindex, cancelReindex } =
    useSyncStore();

  const handleReindex = async () => {
    if (!currentWorkspacePath) {
      showNotification({
        title: "Error",
        message: "No workspace selected",
        type: "error",
      });
      return;
    }

    try {
      startReindex();
      updateProgress(10, "Scanning workspace files...");

      const result = await tauriAPI.reindexWorkspace(currentWorkspacePath);

      updateProgress(90, "Finalizing...");

      setTimeout(() => {
        finishReindex();
        showToast({
          message: `Re-indexed ${result.pages} pages`,
          type: "success",
        });

        // Reload pages after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }, 200);
    } catch (error) {
      cancelReindex();
      showToast({
        message: "Re-index failed",
        type: "error",
        duration: 2000,
      });
    }
  };

  const currentWorkspace = workspaces.find(
    (w) => w.path === currentWorkspacePath,
  );

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

  const handleDeleteWorkspace = (path: string) => {
    setWorkspaceToDelete(path);
    setDeleteModalOpened(true);
  };

  const confirmDeleteWorkspace = () => {
    if (workspaceToDelete) {
      removeWorkspace(workspaceToDelete);
      setDeleteModalOpened(false);
      setWorkspaceToDelete(null);
      showToast({
        message: "Workspace removed from recent list",
        type: "success",
      });
    }
  };

  return (
    <>
      <Menu
        shadow="md"
        width={320}
        position="bottom"
        offset={8}
        styles={{ dropdown: { padding: "8px 4px" } }}
      >
        <Menu.Target>
          <UnstyledButton
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              transition: "background-color 0.15s ease",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDark
                ? "rgba(255, 255, 255, 0.08)"
                : "rgba(0, 0, 0, 0.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <IconFolder size={16} style={{ flexShrink: 0 }} />
            <Text size="sm" fw={500} style={{ maxWidth: "200px" }} truncate>
              {currentWorkspace?.name || "Select Workspace"}
            </Text>
            <IconChevronDown
              size={14}
              style={{ flexShrink: 0, opacity: 0.6 }}
            />
          </UnstyledButton>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>Recent Workspaces</Menu.Label>

          {workspaces.length === 0 ? (
            <Menu.Item
              disabled
              style={{ textAlign: "center", padding: "20px" }}
            >
              <Text size="xs" c="dimmed">
                No workspaces yet
              </Text>
            </Menu.Item>
          ) : (
            <div
              style={{
                maxHeight: "400px",
                overflowY: "auto",
                paddingRight: "0px",
              }}
            >
              {workspaces.map((workspace) => (
                <div
                  key={workspace.path}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "6px 4px",
                    cursor: "pointer",
                    backgroundColor: undefined,
                    borderRadius: "0px",
                    marginBottom: "0px",
                    transition: "background-color 0.15s ease",
                    borderBottom: `1px solid ${isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)"}`,
                  }}
                  onClick={() => openWorkspace(workspace.path)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDark
                      ? "rgba(255, 255, 255, 0.04)"
                      : "rgba(0, 0, 0, 0.02)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "";
                  }}
                >
                  <div style={{ marginRight: "12px", flexShrink: 0 }}>
                    {currentWorkspacePath === workspace.path ? (
                      <IconCheck size={16} />
                    ) : (
                      <IconFolder size={16} style={{ opacity: 0.6 }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={500}>
                      {workspace.name}
                    </Text>
                    <Group gap={8} mt={2}>
                      <Text
                        size="xs"
                        c="dimmed"
                        style={{
                          maxWidth: "200px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {workspace.path}
                      </Text>
                      <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                        • {formatLastAccessed(workspace.lastAccessed)}
                      </Text>
                    </Group>
                  </div>
                  <ActionIcon
                    size="xs"
                    color="red"
                    radius="md"
                    variant="subtle"
                    style={{ marginLeft: "12px", flexShrink: 0 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteWorkspace(workspace.path);
                    }}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </div>
              ))}
            </div>
          )}

          <Divider my={4} />

          <Menu.Item
            leftSection={<IconPlus size={16} />}
            onClick={selectWorkspace}
          >
            <Text size="sm" fw={500}>
              Add Workspace...
            </Text>
          </Menu.Item>

          {currentWorkspacePath && (
            <Menu.Item
              leftSection={<IconRefresh size={16} />}
              onClick={handleReindex}
            >
              <Text size="sm" fw={500}>
                Re-index Workspace
              </Text>
            </Menu.Item>
          )}
        </Menu.Dropdown>
      </Menu>

      <Modal
        opened={deleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
        title="Remove Workspace"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to remove "
            {workspaceToDelete &&
              workspaces.find((w) => w.path === workspaceToDelete)?.name}
            " from your recent workspaces?
          </Text>
          <Group justify="flex-end" gap="md">
            <Button
              variant="default"
              onClick={() => setDeleteModalOpened(false)}
            >
              Cancel
            </Button>
            <Button color="red" onClick={confirmDeleteWorkspace}>
              Remove
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
