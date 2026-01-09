import {
  Menu,
  Text,
  Group,
  UnstyledButton,
  Divider,
  ScrollArea,
} from "@mantine/core";
import {
  IconFolder,
  IconPlus,
  IconCheck,
  IconChevronDown,
} from "@tabler/icons-react";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useMantineColorScheme } from "@mantine/core";

interface WorkspacePickerProps {
  currentWorkspacePath: string | null;
}

export function WorkspacePicker({
  currentWorkspacePath,
}: WorkspacePickerProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";

  const workspaces = useWorkspaceStore((state) => state.getWorkspaces());
  const openWorkspace = useWorkspaceStore((state) => state.openWorkspace);
  const selectWorkspace = useWorkspaceStore((state) => state.selectWorkspace);

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

  return (
    <Menu shadow="md" width={320} position="bottom-start" offset={8}>
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
          <IconChevronDown size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Recent Workspaces</Menu.Label>

        {workspaces.length === 0 ? (
          <Menu.Item disabled style={{ textAlign: "center", padding: "20px" }}>
            <Text size="xs" c="dimmed">
              No workspaces yet
            </Text>
          </Menu.Item>
        ) : (
          <ScrollArea.Autosize mah={400} offsetScrollbars>
            {workspaces.map((workspace) => (
              <Menu.Item
                key={workspace.path}
                onClick={() => openWorkspace(workspace.path)}
                leftSection={
                  currentWorkspacePath === workspace.path ? (
                    <IconCheck size={16} />
                  ) : (
                    <IconFolder size={16} style={{ opacity: 0.6 }} />
                  )
                }
                style={{
                  backgroundColor:
                    currentWorkspacePath === workspace.path
                      ? isDark
                        ? "rgba(99, 102, 241, 0.15)"
                        : "rgba(99, 102, 241, 0.1)"
                      : undefined,
                }}
              >
                <div>
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
              </Menu.Item>
            ))}
          </ScrollArea.Autosize>
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
      </Menu.Dropdown>
    </Menu>
  );
}
