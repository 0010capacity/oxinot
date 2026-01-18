import { Accordion, Box, Loader, Stack, Text } from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { usePageStore } from "../stores/pageStore";
import { useViewStore } from "../stores/viewStore";
import { useWorkspaceStore } from "../stores/workspaceStore";

interface BacklinkBlock {
  block_id: string;
  content: string;
  created_at: string;
}

interface BacklinkGroup {
  page_id: string;
  page_title: string;
  blocks: BacklinkBlock[];
}

interface LinkedReferencesProps {
  pageId: string;
}

export function LinkedReferences({ pageId }: LinkedReferencesProps) {
  const [backlinks, setBacklinks] = useState<BacklinkGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const pagesById = usePageStore((state) => state.pagesById);
  const setCurrentPageId = usePageStore((state) => state.setCurrentPageId);
  const openNote = useViewStore((state) => state.openNote);

  useEffect(() => {
    if (!pageId || !workspacePath) return;

    const fetchBacklinks = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await invoke<BacklinkGroup[]>("get_page_backlinks", {
          workspacePath,
          pageId,
        });
        setBacklinks(result);
      } catch (err) {
        console.error("[LinkedReferences] Failed to fetch backlinks:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load backlinks",
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchBacklinks();
  }, [pageId, workspacePath]);

  const handlePageClick = (backlinkPageId: string) => {
    const page = pagesById[backlinkPageId];
    if (!page) return;

    setCurrentPageId(backlinkPageId);

    // Build breadcrumb path
    const parentNames: string[] = [];
    const pagePathIds: string[] = [];
    let currentId: string | undefined = page.parentId;

    while (currentId) {
      const parentPage = pagesById[currentId];
      if (!parentPage) break;
      parentNames.unshift(parentPage.title);
      pagePathIds.unshift(currentId);
      currentId = parentPage.parentId;
    }

    pagePathIds.push(backlinkPageId);
    openNote(backlinkPageId, page.title, parentNames, pagePathIds);
  };

  // Convert to grouped format for accordion
  const groupedBacklinks: Record<string, BacklinkGroup> = {};
  for (const group of backlinks) {
    groupedBacklinks[group.page_id] = group;
  }

  const backlinkCount = backlinks.reduce(
    (sum, group) => sum + group.blocks.length,
    0,
  );
  const pageCount = backlinks.length;

  if (isLoading) {
    return (
      <Box
        style={{
          padding: "24px 0",
          borderTop: "1px solid var(--color-border-primary)",
          marginTop: "40px",
        }}
      >
        <Stack align="center" gap="md">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            Loading linked references...
          </Text>
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        style={{
          padding: "24px 0",
          borderTop: "1px solid var(--color-border-primary)",
          marginTop: "40px",
        }}
      >
        <Text size="sm" c="red">
          Failed to load linked references: {error}
        </Text>
      </Box>
    );
  }

  if (backlinkCount === 0) {
    return (
      <Box
        style={{
          padding: "24px 0",
          borderTop: "1px solid var(--color-border-primary)",
          marginTop: "40px",
        }}
      >
        <Text size="sm" fw={600} mb="sm">
          Linked References
        </Text>
        <Text size="sm" c="dimmed">
          No pages link to this page yet.
        </Text>
      </Box>
    );
  }

  return (
    <Box
      style={{
        padding: "24px 0",
        borderTop: "1px solid var(--color-border-primary)",
        marginTop: "40px",
      }}
    >
      <Text size="sm" fw={600} mb="md">
        {pageCount} Linked Reference{pageCount !== 1 ? "s" : ""}
      </Text>

      <Accordion
        variant="separated"
        defaultValue={Object.keys(groupedBacklinks)}
        multiple
        styles={{
          item: {
            backgroundColor: "var(--color-bg-secondary)",
            border: "1px solid var(--color-border-secondary)",
            borderRadius: "var(--radius-md)",
          },
          control: {
            padding: "12px 16px",
          },
          label: {
            fontSize: "14px",
            fontWeight: 500,
          },
          content: {
            padding: "0 16px 12px 16px",
          },
        }}
      >
        {Object.entries(groupedBacklinks).map(([backlinkPageId, data]) => (
          <Accordion.Item key={backlinkPageId} value={backlinkPageId}>
            <Accordion.Control>
              <Box
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Text
                  size="sm"
                  style={{
                    cursor: "pointer",
                    color: "var(--color-text-link)",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePageClick(backlinkPageId);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textDecoration = "underline";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textDecoration = "none";
                  }}
                >
                  {data.page_title}
                </Text>
                <Text size="xs" c="dimmed">
                  ({data.blocks.length} reference
                  {data.blocks.length !== 1 ? "s" : ""})
                </Text>
              </Box>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="xs">
                {data.blocks.map((block) => (
                  <Box
                    key={block.block_id}
                    style={{
                      padding: "8px 12px",
                      backgroundColor: "var(--color-bg-tertiary)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "13px",
                      lineHeight: "1.6",
                      color: "var(--color-text-secondary)",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      // TODO: Navigate to specific block
                      handlePageClick(backlinkPageId);
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--color-bg-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--color-bg-tertiary)";
                    }}
                  >
                    <Text
                      size="xs"
                      style={{
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {block.content}
                    </Text>
                  </Box>
                ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Box>
  );
}
