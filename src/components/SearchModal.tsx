import { Box, Loader, Modal, Stack, Text, TextInput } from "@mantine/core";
import { IconFile, IconFolder, IconSearch } from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type PageData, usePageStore } from "../stores/pageStore";
import { useViewStore } from "../stores/viewStore";
import { useWorkspaceStore } from "../stores/workspaceStore";

interface SearchResult {
  id: string;
  page_id: string;
  page_title: string;
  result_type: "page" | "block";
  content: string;
  snippet: string;
}

interface SearchModalProps {
  opened: boolean;
  onClose: () => void;
}

interface FlatPageItem {
  page: PageData;
  depth: number;
  hasChildren: boolean;
}

export function SearchModal({ opened, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const setCurrentPageId = usePageStore((state) => state.setCurrentPageId);
  const showPage = useViewStore((state) => state.showPage);
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const pageIds = usePageStore((state) => state.pageIds);
  const pagesById = usePageStore((state) => state.pagesById);
  const pages = pageIds.map((id) => pagesById[id]);

  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.trim().length === 0) {
        setResults([]);
        return;
      }

      if (!workspacePath) {
        setResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const searchResults = await invoke<SearchResult[]>("search_content", {
          workspacePath,
          query: searchQuery,
        });
        setResults(searchResults);
        setSelectedIndex(0);
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [workspacePath]
  );

  useEffect(() => {
    if (opened) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setCollapsed(new Set());
      // Focus input field after modal renders
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [opened]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, performSearch]);

  // Build flat list of pages for keyboard navigation
  const flatPageList = useMemo(() => {
    const buildTree = (parentId: string | null): PageData[] => {
      return pages
        .filter((page: PageData) => {
          const pageParentId = page.parentId ?? null;
          return pageParentId === parentId;
        })
        .sort((a: PageData, b: PageData) => a.title.localeCompare(b.title));
    };

    const flattenTree = (
      parentId: string | null,
      depth: number,
      result: FlatPageItem[] = []
    ): FlatPageItem[] => {
      const children = buildTree(parentId);
      for (const page of children) {
        const hasChildren = pages.some((p: PageData) => p.parentId === page.id);
        result.push({ page, depth, hasChildren });

        // Only add children if not collapsed
        if (hasChildren && !collapsed.has(page.id)) {
          flattenTree(page.id, depth + 1, result);
        }
      }
      return result;
    };

    return flattenTree(null, 0);
  }, [pages, collapsed]);

  const handleResultClick = (result: SearchResult) => {
    setCurrentPageId(result.page_id);
    showPage(result.page_id);
    onClose();
  };

  const handlePageClick = (pageId: string) => {
    setCurrentPageId(pageId);
    showPage(pageId);
    onClose();
  };

  const handleToggleCollapse = (pageId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Determine if we're showing file tree or search results
    const showingFileTree = query.trim().length === 0;
    const items = showingFileTree ? flatPageList : results;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && items.length > 0) {
      e.preventDefault();
      if (showingFileTree) {
        const selectedItem = flatPageList[selectedIndex];
        if (selectedItem) {
          handlePageClick(selectedItem.page.id);
        }
      } else {
        handleResultClick(results[selectedIndex]);
      }
    } else if (e.key === "ArrowRight" && showingFileTree) {
      e.preventDefault();
      const selectedItem = flatPageList[selectedIndex];
      if (selectedItem?.hasChildren && collapsed.has(selectedItem.page.id)) {
        handleToggleCollapse(selectedItem.page.id);
      }
    } else if (e.key === "ArrowLeft" && showingFileTree) {
      e.preventDefault();
      const selectedItem = flatPageList[selectedIndex];
      if (selectedItem?.hasChildren && !collapsed.has(selectedItem.page.id)) {
        handleToggleCollapse(selectedItem.page.id);
      }
    }
  };

  const renderSnippet = (snippet: string, pageId: string) => {
    // Parse the snippet and highlight the **matched** text
    const parts = snippet.split(/(\*\*.*?\*\*)/g);
    let partCounter = 0;
    return (
      <span>
        {parts.map((part) => {
          if (part.length === 0) return null;
          partCounter += 1;
          if (part.startsWith("**") && part.endsWith("**")) {
            const text = part.slice(2, -2);
            return (
              <span
                key={`${pageId}-highlight-${partCounter}`}
                style={{
                  backgroundColor: "var(--color-interactive-selected)",
                  color: "inherit",
                  fontWeight: 600,
                }}
              >
                {text}
              </span>
            );
          }
          return <span key={`${pageId}-snippet-${partCounter}`}>{part}</span>;
        })}
      </span>
    );
  };

  const renderFileTree = () => {
    if (pages.length === 0) {
      return (
        <Text size="sm" c="dimmed" ta="center" py="xl">
          No pages in workspace
        </Text>
      );
    }

    return (
      <Box
        style={{
          maxHeight: "400px",
          overflowY: "auto",
        }}
      >
        <Stack gap={2}>
          {flatPageList.map((item, index) => {
            const { page, depth, hasChildren } = item;
            const isSelected = selectedIndex === index;
            const isCollapsed = collapsed.has(page.id);

            return (
              <Box
                key={page.id}
                onClick={() => handlePageClick(page.id)}
                style={{
                  padding: "6px 12px",
                  paddingLeft: `${12 + depth * 20}px`,
                  borderRadius: "6px",
                  cursor: "pointer",
                  backgroundColor: isSelected
                    ? "var(--color-interactive-selected)"
                    : "transparent",
                  border: `1px solid ${
                    isSelected ? "var(--color-border-secondary)" : "transparent"
                  }`,
                  transition: "all 0.15s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    flex: 1,
                  }}
                >
                  {hasChildren && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleCollapse(page.id);
                      }}
                      style={{
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        fontSize: "0.7rem",
                        userSelect: "none",
                        width: "12px",
                        color: "var(--color-text-tertiary)",
                        border: "none",
                        background: "none",
                        padding: "0",
                      }}
                    >
                      {isCollapsed ? "▸" : "▾"}
                    </button>
                  )}
                  {!hasChildren && (
                    <span style={{ width: "12px", display: "inline-block" }} />
                  )}
                  {page.isDirectory ? (
                    <IconFolder
                      size={14}
                      style={{ color: "var(--color-text-tertiary)" }}
                    />
                  ) : (
                    <IconFile
                      size={14}
                      style={{ color: "var(--color-text-tertiary)" }}
                    />
                  )}
                  <Text
                    size="sm"
                    style={{
                      color: "var(--color-text-secondary)",
                      fontSize: "0.9rem",
                    }}
                  >
                    {page.title}
                  </Text>
                </div>
              </Box>
            );
          })}
        </Stack>
      </Box>
    );
  };

  const renderSearchResults = () => {
    if (results.length === 0 && !isSearching) {
      return (
        <Text size="sm" c="dimmed" ta="center" py="xl">
          No results found
        </Text>
      );
    }

    return (
      <Box
        style={{
          maxHeight: "400px",
          overflowY: "auto",
        }}
      >
        <Stack gap={2}>
          {results.map((result, index) => (
            <Box
              key={`${result.result_type}-${result.id}`}
              onClick={() => handleResultClick(result)}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                cursor: "pointer",
                backgroundColor:
                  selectedIndex === index
                    ? "var(--color-interactive-selected)"
                    : "transparent",
                border: `1px solid ${
                  selectedIndex === index
                    ? "var(--color-border-secondary)"
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
                  gap: "6px",
                }}
              >
                {result.result_type === "page" ? (
                  <IconFile
                    size={14}
                    style={{ color: "var(--color-text-tertiary)" }}
                  />
                ) : (
                  <IconFile
                    size={14}
                    style={{ color: "var(--color-text-tertiary)" }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    size="sm"
                    style={{
                      color: "var(--color-text-secondary)",
                      fontSize: "0.9rem",
                      marginBottom: "2px",
                    }}
                  >
                    {result.page_title}
                  </Text>
                  <Text
                    size="xs"
                    style={{
                      color: "var(--color-text-tertiary)",
                      lineHeight: 1.4,
                      fontSize: "0.8rem",
                    }}
                  >
                    {renderSnippet(result.snippet, result.page_id)}
                  </Text>
                </div>
              </div>
            </Box>
          ))}
        </Stack>
      </Box>
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Search"
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
          ref={inputRef}
          placeholder="Search pages and blocks..."
          leftSection={<IconSearch size={16} />}
          rightSection={isSearching ? <Loader size="xs" /> : null}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          styles={{
            input: {
              fontSize: "0.95rem",
            },
          }}
        />

        {query.trim().length === 0 ? renderFileTree() : renderSearchResults()}
      </Stack>
    </Modal>
  );
}
