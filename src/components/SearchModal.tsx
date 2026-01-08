import { Modal, TextInput, Stack, Text, Box, Loader } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useMantineColorScheme } from "@mantine/core";
import { usePageStore } from "../stores/pageStore";
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

export function SearchModal({ opened, onClose }: SearchModalProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const setCurrentPageId = usePageStore((state) => state.setCurrentPageId);
  const showPage = useViewStore((state) => state.showPage);
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);

  const performSearch = useCallback(async (searchQuery: string) => {
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
  }, []);

  useEffect(() => {
    if (opened) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [opened]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, performSearch]);

  const handleResultClick = (result: SearchResult) => {
    setCurrentPageId(result.page_id);
    showPage(result.page_id);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results.length > 0) {
      e.preventDefault();
      handleResultClick(results[selectedIndex]);
    }
  };

  const renderSnippet = (snippet: string) => {
    // Parse the snippet and highlight the **matched** text
    const parts = snippet.split(/(\*\*.*?\*\*)/g);
    return (
      <span>
        {parts.map((part, index) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            const text = part.slice(2, -2);
            return (
              <span
                key={index}
                style={{
                  backgroundColor: isDark ? "#ffd43b" : "#fff3bf",
                  color: isDark ? "#000" : "#000",
                  fontWeight: 600,
                }}
              >
                {text}
              </span>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </span>
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
          placeholder="Search pages and blocks..."
          leftSection={<IconSearch size={16} />}
          rightSection={isSearching ? <Loader size="xs" /> : null}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          styles={{
            input: {
              fontSize: "0.95rem",
            },
          }}
        />

        {query.trim().length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            Type to search in pages and blocks
          </Text>
        ) : results.length === 0 && !isSearching ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            No results found
          </Text>
        ) : (
          <Box
            style={{
              maxHeight: "400px",
              overflowY: "auto",
            }}
          >
            <Stack gap="xs">
              {results.map((result, index) => (
                <Box
                  key={`${result.result_type}-${result.id}`}
                  onClick={() => handleResultClick(result)}
                  style={{
                    padding: "12px",
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
                  <Stack gap={4}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <Text
                        size="xs"
                        c="dimmed"
                        style={{
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          fontSize: "0.7rem",
                        }}
                      >
                        {result.result_type}
                      </Text>
                      <Text
                        size="sm"
                        fw={500}
                        style={{
                          color: isDark ? "#c1c2c5" : "#495057",
                        }}
                      >
                        {result.page_title}
                      </Text>
                    </div>
                    <Text
                      size="sm"
                      style={{
                        color: isDark ? "#909296" : "#868e96",
                        lineHeight: 1.5,
                      }}
                    >
                      {renderSnippet(result.snippet)}
                    </Text>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </Modal>
  );
}
