import { useEffect } from "react";
import {
  Stack,
  Text,
  Group,
  Loader,
  useMantineColorScheme,
} from "@mantine/core";
import { useViewStore } from "../stores/viewStore";
import { usePageStore } from "../stores/pageStore";
import { useBlockStore } from "../stores/blockStore";

export function FileTreeIndex() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";
  const { openNote } = useViewStore();
  const { loadPages, selectPage } = usePageStore();
  const pages = usePageStore((state) =>
    state.pageIds.map((id) => state.pagesById[id]),
  );
  const isLoading = usePageStore((state) => state.isLoading);
  const { loadPage } = useBlockStore();

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

  if (pages.length === 0) {
    return (
      <Stack align="center" justify="center" h="100%" p="xl">
        <Text size="sm" c="dimmed">
          No pages found in workspace
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap={0} p="md">
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
  );
}
