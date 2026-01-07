import { useEffect, useState } from "react";
import {
  Stack,
  Text,
  Group,
  Loader,
  useMantineColorScheme,
  Button,
  TextInput,
  ActionIcon,
} from "@mantine/core";
import { IconPlus, IconCheck, IconX } from "@tabler/icons-react";
import { useViewStore } from "../stores/viewStore";
import { usePageStore } from "../stores/pageStore";
import { useBlockStore } from "../stores/blockStore";

export function FileTreeIndex() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";
  const { openNote } = useViewStore();
  const { loadPages, selectPage, createPage } = usePageStore();
  const pages = usePageStore((state) =>
    state.pageIds.map((id) => state.pagesById[id]),
  );
  const isLoading = usePageStore((state) => state.isLoading);
  const { loadPage } = useBlockStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  const handlePageClick = async (pageId: string, pageTitle: string) => {
    try {
      selectPage(pageId);
      await loadPage(pageId);
      openNote(pageId, pageTitle);
    } catch (error) {
      console.error("Failed to open page:", error);
    }
  };

  const handleCreatePage = async () => {
    if (!newPageTitle.trim()) return;

    setIsSubmitting(true);
    try {
      const newPageId = await createPage(newPageTitle.trim());
      await loadPage(newPageId);
      openNote(newPageId, newPageTitle.trim());
      setNewPageTitle("");
      setIsCreating(false);
    } catch (error) {
      console.error("Failed to create page:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelCreate = () => {
    setNewPageTitle("");
    setIsCreating(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCreatePage();
    } else if (e.key === "Escape") {
      handleCancelCreate();
    }
  };

  if (isLoading) {
    return (
      <Stack align="center" justify="center" h="100%" p="xl">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          Loading pages...
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md" p="md">
      {/* New Page Button */}
      <Group justify="space-between">
        <Text size="lg" fw={600}>
          Pages
        </Text>
        {!isCreating && (
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            onClick={() => setIsCreating(true)}
          >
            New Page
          </Button>
        )}
      </Group>

      {/* New Page Input */}
      {isCreating && (
        <Group gap="xs" wrap="nowrap">
          <TextInput
            placeholder="Page title..."
            value={newPageTitle}
            onChange={(e) => setNewPageTitle(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            disabled={isSubmitting}
            autoFocus
            style={{ flex: 1 }}
            size="sm"
          />
          <ActionIcon
            color="green"
            variant="light"
            onClick={handleCreatePage}
            disabled={!newPageTitle.trim() || isSubmitting}
            loading={isSubmitting}
            size="lg"
          >
            <IconCheck size={16} />
          </ActionIcon>
          <ActionIcon
            color="red"
            variant="light"
            onClick={handleCancelCreate}
            disabled={isSubmitting}
            size="lg"
          >
            <IconX size={16} />
          </ActionIcon>
        </Group>
      )}

      {/* Pages List */}
      {pages.length === 0 ? (
        <Stack align="center" justify="center" h="200px">
          <Text size="sm" c="dimmed">
            No pages found. Create your first page to get started!
          </Text>
        </Stack>
      ) : (
        <Stack gap={0}>
          {pages.map((page) => (
            <Group
              key={page.id}
              gap="xs"
              wrap="nowrap"
              style={{
                paddingLeft: "0px",
                paddingTop: "6px",
                paddingBottom: "6px",
                cursor: "pointer",
                borderRadius: "4px",
                transition: "background-color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDark
                  ? "rgba(255, 255, 255, 0.05)"
                  : "rgba(0, 0, 0, 0.03)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
              onClick={() => handlePageClick(page.id, page.title)}
            >
              <Text
                size="sm"
                style={{
                  fontFamily: "monospace",
                  fontSize: "18px",
                  opacity: 0.4,
                  userSelect: "none",
                  width: "20px",
                  textAlign: "center",
                }}
              >
                •
              </Text>
              <Text
                size="sm"
                style={{
                  flex: 1,
                  color: isDark ? "#4dabf7" : "#1c7ed6",
                }}
              >
                {page.title}
              </Text>
            </Group>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
