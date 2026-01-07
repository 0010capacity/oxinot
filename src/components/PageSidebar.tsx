import { useState } from "react";
import {
  Stack,
  Group,
  Text,
  ActionIcon,
  Menu,
  Input,
  useMantineColorScheme,
  ScrollArea,
} from "@mantine/core";
import {
  IconPlus,
  IconTrash,
  IconPencil,
  IconDots,
  IconCheck,
  IconX,
} from "@tabler/icons-react";
import { usePages, useCurrentPageId, usePageStore } from "../stores/pageStore";
import { useBlockStore } from "../stores/blockStore";

export function PageSidebar() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";

  const pages = usePages();
  const currentPageId = useCurrentPageId();
  const { selectPage, createPage, updatePageTitle, deletePage } =
    usePageStore();
  const { loadPage, clearPage } = useBlockStore();

  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [newPageTitle, setNewPageTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleSelectPage = async (pageId: string) => {
    selectPage(pageId);
    await loadPage(pageId);
  };

  const handleCreatePage = async () => {
    if (!newPageTitle.trim()) return;

    try {
      const newPageId = await createPage(newPageTitle);
      await loadPage(newPageId);
      setNewPageTitle("");
      setIsCreating(false);
    } catch (error) {
      console.error("Failed to create page:", error);
    }
  };

  const startEditingPage = (pageId: string, title: string) => {
    setEditingPageId(pageId);
    setEditingTitle(title);
  };

  const handleSaveEdit = async (pageId: string) => {
    if (!editingTitle.trim()) return;

    try {
      await updatePageTitle(pageId, editingTitle);
      setEditingPageId(null);
      setEditingTitle("");
    } catch (error) {
      console.error("Failed to update page:", error);
    }
  };

  const handleDeletePage = async (pageId: string) => {
    try {
      await deletePage(pageId);
      clearPage();
    } catch (error) {
      console.error("Failed to delete page:", error);
    }
  };

  return (
    <Stack
      gap={0}
      style={{
        height: "100%",
        backgroundColor: isDark ? "#1a1b1e" : "#f8f9fa",
        borderRight: `1px solid ${isDark ? "#373A40" : "#e9ecef"}`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <Group
        p="md"
        justify="space-between"
        style={{
          borderBottom: `1px solid ${isDark ? "#373A40" : "#e9ecef"}`,
        }}
      >
        <Text fw={600} size="sm">
          Pages
        </Text>
        <ActionIcon
          size="sm"
          variant="subtle"
          onClick={() => setIsCreating(true)}
          title="Create new page"
        >
          <IconPlus size={16} />
        </ActionIcon>
      </Group>

      {/* Pages List */}
      <ScrollArea style={{ flex: 1 }} p="sm">
        <Stack gap="xs">
          {/* Create New Page Input */}
          {isCreating && (
            <Group
              gap="xs"
              style={{
                borderBottom: `1px solid ${isDark ? "#373A40" : "#e9ecef"}`,
                paddingBottom: "8px",
              }}
            >
              <Input
                placeholder="Page name..."
                value={newPageTitle}
                onChange={(e) => setNewPageTitle(e.currentTarget.value)}
                size="xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreatePage();
                  } else if (e.key === "Escape") {
                    setIsCreating(false);
                    setNewPageTitle("");
                  }
                }}
                autoFocus
                style={{ flex: 1 }}
              />
              <ActionIcon size="xs" color="green" onClick={handleCreatePage}>
                <IconCheck size={14} />
              </ActionIcon>
              <ActionIcon
                size="xs"
                color="gray"
                onClick={() => {
                  setIsCreating(false);
                  setNewPageTitle("");
                }}
              >
                <IconX size={14} />
              </ActionIcon>
            </Group>
          )}

          {/* Pages */}
          {pages.length === 0 ? (
            <Text
              size="sm"
              c="dimmed"
              style={{ textAlign: "center", padding: "16px" }}
            >
              No pages yet. Create one to get started!
            </Text>
          ) : (
            pages.map((page) => (
              <Group
                key={page.id}
                p="xs"
                style={{
                  backgroundColor:
                    currentPageId === page.id
                      ? isDark
                        ? "#373A40"
                        : "#e7f5ff"
                      : "transparent",
                  borderRadius: "6px",
                  cursor: "pointer",
                  transition: "background-color 0.2s ease",
                }}
                onClick={() => handleSelectPage(page.id)}
                justify="space-between"
              >
                {editingPageId === page.id ? (
                  <Input
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.currentTarget.value)}
                    size="xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSaveEdit(page.id);
                      } else if (e.key === "Escape") {
                        setEditingPageId(null);
                        setEditingTitle("");
                      }
                    }}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    style={{ flex: 1 }}
                  />
                ) : (
                  <div style={{ flex: 1 }}>
                    <Text size="sm" fw={currentPageId === page.id ? 600 : 400}>
                      {page.title}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {new Date(page.updatedAt).toLocaleDateString()}
                    </Text>
                  </div>
                )}

                {editingPageId === page.id ? (
                  <Group gap="xs">
                    <ActionIcon
                      size="xs"
                      color="green"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveEdit(page.id);
                      }}
                    >
                      <IconCheck size={14} />
                    </ActionIcon>
                    <ActionIcon
                      size="xs"
                      color="gray"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingPageId(null);
                        setEditingTitle("");
                      }}
                    >
                      <IconX size={14} />
                    </ActionIcon>
                  </Group>
                ) : (
                  <Menu position="bottom-end" shadow="md">
                    <Menu.Target>
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <IconDots size={14} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<IconPencil size={14} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditingPage(page.id, page.title);
                        }}
                      >
                        Rename
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item
                        leftSection={<IconTrash size={14} />}
                        color="red"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePage(page.id);
                        }}
                      >
                        Delete
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                )}
              </Group>
            ))
          )}
        </Stack>
      </ScrollArea>

      {/* Footer */}
      <Group
        p="sm"
        style={{
          borderTop: `1px solid ${isDark ? "#373A40" : "#e9ecef"}`,
          fontSize: "12px",
          color: isDark ? "#909296" : "#868e96",
        }}
      >
        <Text size="xs">
          {pages.length} page{pages.length !== 1 ? "s" : ""}
        </Text>
      </Group>
    </Stack>
  );
}
