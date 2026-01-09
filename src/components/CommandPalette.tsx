import { Modal, TextInput, Stack, Text, Box, Kbd } from "@mantine/core";
import {
  IconSearch,
  IconFile,
  IconGitCommit,
  IconGitBranch,
  IconCalendar,
  IconSettings,
  IconHelp,
  IconFolderPlus,
} from "@tabler/icons-react";
import { useState, useEffect, useMemo } from "react";
import { useMantineColorScheme } from "@mantine/core";
import { usePageStore } from "../stores/pageStore";
import { useViewStore } from "../stores/viewStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useGitStore } from "../stores/gitStore";

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void | Promise<void>;
  keywords?: string[];
}

interface CommandPaletteProps {
  opened: boolean;
  onClose: () => void;
  onOpenSearch?: () => void;
  onOpenCalendar?: () => void;
  onOpenSettings?: () => void;
  onOpenHelp?: () => void;
}

export function CommandPalette({
  opened,
  onClose,
  onOpenSearch,
  onOpenCalendar,
  onOpenSettings,
  onOpenHelp,
}: CommandPaletteProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const createPage = usePageStore((state) => state.createPage);
  const loadPages = usePageStore((state) => state.loadPages);
  const showPage = useViewStore((state) => state.showPage);
  const showIndex = useViewStore((state) => state.showIndex);
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);

  const gitCommit = useGitStore((state) => state.commit);
  const gitPush = useGitStore((state) => state.push);
  const gitPull = useGitStore((state) => state.pull);
  const checkGitStatus = useGitStore((state) => state.checkStatus);
  const hasChanges = useGitStore((state) => state.hasChanges);
  const isRepo = useGitStore((state) => state.isRepo);

  const commands: Command[] = useMemo(
    () => [
      // Navigation
      {
        id: "search",
        label: "Search",
        description: "Search pages and blocks",
        icon: <IconSearch size={16} />,
        action: () => {
          onClose();
          onOpenSearch?.();
        },
        keywords: ["find", "search", "query"],
      },
      {
        id: "file-tree",
        label: "Go to File Tree",
        description: "Show workspace file tree",
        icon: <IconFolderPlus size={16} />,
        action: () => {
          onClose();
          showIndex();
        },
        keywords: ["tree", "files", "workspace", "home"],
      },
      {
        id: "calendar",
        label: "Open Calendar",
        description: "View daily notes calendar",
        icon: <IconCalendar size={16} />,
        action: () => {
          onClose();
          onOpenCalendar?.();
        },
        keywords: ["date", "daily", "journal"],
      },

      // Page actions
      {
        id: "new-page",
        label: "New Page",
        description: "Create a new page",
        icon: <IconFile size={16} />,
        action: async () => {
          onClose();
          try {
            const pageId = await createPage("Untitled");
            await loadPages();
            showPage(pageId);
          } catch (error) {
            console.error("Failed to create page:", error);
          }
        },
        keywords: ["create", "add", "note", "document"],
      },

      // Git actions (only if repo is initialized)
      ...(isRepo
        ? [
            {
              id: "git-commit",
              label: "Git: Commit Changes",
              description: hasChanges
                ? "Commit current changes"
                : "No changes to commit",
              icon: <IconGitCommit size={16} />,
              action: async () => {
                if (!workspacePath || !hasChanges) return;
                onClose();
                try {
                  const message = prompt("Commit message:");
                  if (message) {
                    await gitCommit(workspacePath, message);
                  }
                } catch (error) {
                  console.error("Failed to commit:", error);
                }
              },
              keywords: ["git", "commit", "save", "version"],
            },
            {
              id: "git-push",
              label: "Git: Push",
              description: "Push to remote repository",
              icon: <IconGitBranch size={16} />,
              action: async () => {
                if (!workspacePath) return;
                onClose();
                try {
                  await gitPush(workspacePath);
                } catch (error) {
                  console.error("Failed to push:", error);
                  alert(
                    "Failed to push. Make sure you have a remote configured.",
                  );
                }
              },
              keywords: ["git", "push", "upload", "sync"],
            },
            {
              id: "git-pull",
              label: "Git: Pull",
              description: "Pull from remote repository",
              icon: <IconGitBranch size={16} />,
              action: async () => {
                if (!workspacePath) return;
                onClose();
                try {
                  await gitPull(workspacePath);
                  await loadPages();
                } catch (error) {
                  console.error("Failed to pull:", error);
                  alert(
                    "Failed to pull. Make sure you have a remote configured.",
                  );
                }
              },
              keywords: ["git", "pull", "download", "sync", "fetch"],
            },
            {
              id: "git-status",
              label: "Git: Refresh Status",
              description: "Check git repository status",
              icon: <IconGitCommit size={16} />,
              action: async () => {
                if (!workspacePath) return;
                onClose();
                await checkGitStatus(workspacePath);
              },
              keywords: ["git", "status", "refresh", "check"],
            },
          ]
        : []),

      // Settings
      {
        id: "settings",
        label: "Settings",
        description: "Open settings",
        icon: <IconSettings size={16} />,
        action: () => {
          onClose();
          onOpenSettings?.();
        },
        keywords: ["preferences", "config", "options"],
      },
      {
        id: "help",
        label: "Help",
        description: "View help and documentation",
        icon: <IconHelp size={16} />,
        action: () => {
          onClose();
          onOpenHelp?.();
        },
        keywords: ["docs", "documentation", "guide"],
      },
    ],
    [
      isRepo,
      hasChanges,
      workspacePath,
      onClose,
      onOpenSearch,
      onOpenCalendar,
      onOpenSettings,
      onOpenHelp,
      createPage,
      loadPages,
      showPage,
      showIndex,
      gitCommit,
      gitPush,
      gitPull,
      checkGitStatus,
    ],
  );

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;

    const lowerQuery = query.toLowerCase();
    return commands.filter((cmd) => {
      const labelMatch = cmd.label.toLowerCase().includes(lowerQuery);
      const descMatch = cmd.description?.toLowerCase().includes(lowerQuery);
      const keywordMatch = cmd.keywords?.some((kw) =>
        kw.toLowerCase().includes(lowerQuery),
      );
      return labelMatch || descMatch || keywordMatch;
    });
  }, [commands, query]);

  useEffect(() => {
    if (opened) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [opened]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        Math.min(prev + 1, filteredCommands.length - 1),
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && filteredCommands.length > 0) {
      e.preventDefault();
      const command = filteredCommands[selectedIndex];
      if (command) {
        command.action();
      }
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Command Palette"
      size="lg"
      styles={{
        title: {
          fontSize: "1.1rem",
          fontWeight: 600,
        },
      }}
    >
      <Stack gap="md">
        <TextInput
          placeholder="Type a command or search..."
          leftSection={<IconSearch size={16} />}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          styles={{
            input: {
              fontSize: "0.95rem",
            },
          }}
          rightSection={
            <Box style={{ display: "flex", gap: "4px" }}>
              <Kbd size="xs">↑</Kbd>
              <Kbd size="xs">↓</Kbd>
              <Kbd size="xs">⏎</Kbd>
            </Box>
          }
        />

        {filteredCommands.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            No commands found
          </Text>
        ) : (
          <Box
            style={{
              maxHeight: "400px",
              overflowY: "auto",
            }}
          >
            <Stack gap={2}>
              {filteredCommands.map((command, index) => (
                <Box
                  key={command.id}
                  onClick={() => command.action()}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    backgroundColor:
                      selectedIndex === index
                        ? isDark
                          ? "rgba(255, 255, 255, 0.08)"
                          : "rgba(0, 0, 0, 0.05)"
                        : "transparent",
                    border: `1px solid ${
                      selectedIndex === index
                        ? isDark
                          ? "#373A40"
                          : "#dee2e6"
                        : "transparent"
                    }`,
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        color: isDark ? "#909296" : "#868e96",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {command.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <Text
                        size="sm"
                        style={{
                          color: isDark ? "#c1c2c5" : "#495057",
                          fontSize: "0.9rem",
                          marginBottom: command.description ? "2px" : 0,
                        }}
                      >
                        {command.label}
                      </Text>
                      {command.description && (
                        <Text
                          size="xs"
                          style={{
                            color: isDark ? "#909296" : "#868e96",
                            fontSize: "0.8rem",
                          }}
                        >
                          {command.description}
                        </Text>
                      )}
                    </div>
                  </div>
                </Box>
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </Modal>
  );
}
