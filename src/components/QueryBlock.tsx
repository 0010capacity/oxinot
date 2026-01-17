import { Box, Text, useComputedColorScheme } from "@mantine/core";
import { IconEdit } from "@tabler/icons-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useBlockStore } from "../stores/blockStore";
import { useBlockUIStore } from "../stores/blockUIStore";
import { Editor } from "./Editor";
import { tauriAPI, QueryResultBlock } from "../tauri-api";
import { parseQueryMacro, QueryParseError } from "../utils/queryParser";

interface QueryBlockProps {
  macroString: string;
  workspacePath: string;
  onEdit?: () => void;
}

interface QueryBlockState {
  results: QueryResultBlock[];
  isLoading: boolean;
  error: string | null;
}

const QueryBlock: React.FC<QueryBlockProps> = ({
  macroString,
  workspacePath,
  onEdit,
}) => {
  const computedColorScheme = useComputedColorScheme("light");
  const isDark = computedColorScheme === "dark";

  const [state, setState] = useState<QueryBlockState>({
    results: [],
    isLoading: true,
    error: null,
  });

  const [isHovered, setIsHovered] = useState(false);

  const openPage = useBlockStore((state) => state.openPage);
  const setFocusedBlock = useBlockUIStore((state) => state.setFocusedBlock);

  // Execute query on mount or when macro changes
  useEffect(() => {
    executeQuery();
  }, [macroString, workspacePath]);

  const executeQuery = async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Parse the query macro to validate syntax
      parseQueryMacro(macroString);

      // Execute query via Tauri
      const result = await tauriAPI.executeQueryMacro(
        workspacePath,
        macroString
      );

      if (result.error) {
        setState((prev) => ({
          ...prev,
          error: result.error || "Unknown error",
          isLoading: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          results: result.blocks,
          isLoading: false,
        }));
      }
    } catch (err) {
      const message =
        err instanceof QueryParseError
          ? `Parse error: ${err.message}`
          : err instanceof Error
          ? err.message
          : "Unknown error";

      setState((prev) => ({
        ...prev,
        error: message,
        isLoading: false,
      }));
    }
  };

  const handleNavigateToBlock = async (block: QueryResultBlock) => {
    try {
      // Open the page containing the block
      await openPage(block.pageId);
      // Focus the block
      setFocusedBlock(block.id);
    } catch (err) {
      console.error("Failed to navigate to block:", err);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.();
  };

  // Show loading state
  if (state.isLoading) {
    return (
      <Box
        style={{
          margin: "6px 0",
          opacity: 0.6,
        }}
      >
        <Text size="sm" c="dimmed">
          Loading…
        </Text>
      </Box>
    );
  }

  // Show error state
  if (state.error) {
    return (
      <Box style={{ margin: "6px 0" }}>
        <Text size="sm" c="red">
          {state.error}
        </Text>
      </Box>
    );
  }

  // No results
  if (state.results.length === 0) {
    return (
      <Box style={{ margin: "6px 0" }}>
        <Text size="sm" c="dimmed" style={{ fontStyle: "italic" }}>
          No results found
        </Text>
      </Box>
    );
  }

  // Render results in embed style
  return (
    <Box
      style={{
        margin: "0",
        position: "relative",
        border: `1px solid ${
          isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"
        }`,
        borderRadius: "8px",
        padding: "12px",
        backgroundColor: isDark
          ? "rgba(255, 255, 255, 0.02)"
          : "rgba(0, 0, 0, 0.01)",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Hover action buttons */}
      <Box
        style={{
          position: "absolute",
          top: "8px",
          right: "8px",
          display: "flex",
          gap: "6px",
          opacity: isHovered ? 1 : 0,
          transition: "opacity 120ms ease",
          pointerEvents: "auto",
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={handleEdit}
          title="Edit query"
          style={{
            border: "none",
            background: isDark
              ? "rgba(255, 255, 255, 0.1)"
              : "rgba(0, 0, 0, 0.05)",
            color: isDark ? "rgba(255, 255, 255, 0.7)" : "rgba(0, 0, 0, 0.7)",
            borderRadius: "4px",
            padding: "4px",
            fontSize: "12px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "auto",
            position: "relative",
            zIndex: 11,
          }}
        >
          <IconEdit size={16} />
        </button>
      </Box>

      {/* Results */}
      <Box style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {state.results.map((block) => (
          <Box
            key={block.id}
            onClick={() => handleNavigateToBlock(block)}
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "flex-start",
              cursor: "pointer",
              padding: "8px",
              borderRadius: "4px",
              transition: "background-color 120ms ease",
              backgroundColor: isDark
                ? "rgba(255, 255, 255, 0.04)"
                : "rgba(0, 0, 0, 0.02)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = isDark
                ? "rgba(255, 255, 255, 0.08)"
                : "rgba(0, 0, 0, 0.04)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = isDark
                ? "rgba(255, 255, 255, 0.04)"
                : "rgba(0, 0, 0, 0.02)";
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleNavigateToBlock(block);
              }}
              style={{
                opacity: 0.55,
                userSelect: "none",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: 0,
                margin: 0,
                fontSize: "14px",
                lineHeight: "1.5",
                minWidth: "12px",
                textAlign: "center",
              }}
              title="Navigate to this block"
            >
              •
            </button>

            <Box style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
              <Box
                style={{
                  fontSize: "14px",
                  lineHeight: "1.5",
                }}
              >
                <Editor
                  value={block.content}
                  onChange={() => {
                    // Read-only: no-op
                  }}
                  readOnly={true}
                  lineNumbers={false}
                  theme={isDark ? "dark" : "light"}
                  style={{
                    fontSize: "14px",
                    lineHeight: "1.5",
                  }}
                />
              </Box>
              <Text size="xs" c="dimmed" style={{ marginTop: "4px" }}>
                {block.pagePath}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default QueryBlock;
