import { useEffect, useState } from "react";
import {
  Box,
  Group,
  Stack,
  Text,
  Loader,
  Alert,
  Button,
  ActionIcon,
  Tooltip,
  useComputedColorScheme,
} from "@mantine/core";
import { IconEdit } from "@tabler/icons-react";
import { tauriAPI, QueryResultBlock } from "../tauri-api";
import { parseQueryMacro, QueryParseError } from "../utils/queryParser";

interface QueryBlockProps {
  macroString: string;
  workspacePath: string;
}

interface QueryBlockState {
  results: QueryResultBlock[];
  isLoading: boolean;
  error: string | null;
  isEditing: boolean;
  editValue: string;
}

const QueryBlock: React.FC<QueryBlockProps> = ({
  macroString,
  workspacePath,
}) => {
  const computedColorScheme = useComputedColorScheme("light");
  const isDark = computedColorScheme === "dark";

  const [state, setState] = useState<QueryBlockState>({
    results: [],
    isLoading: true,
    error: null,
    isEditing: false,
    editValue: macroString,
  });

  // Execute query on mount or when macro changes
  useEffect(() => {
    executeQuery();
  }, [macroString, workspacePath]);

  const executeQuery = async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Parse and validate the query macro
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

  const handleEdit = () => {
    setState((prev) => ({ ...prev, isEditing: true, editValue: macroString }));
  };

  const handleSave = async () => {
    try {
      parseQueryMacro(state.editValue);
      setState((prev) => ({
        ...prev,
        isEditing: false,
      }));
      // The useEffect will trigger a re-query
    } catch (err) {
      const message =
        err instanceof QueryParseError ? err.message : "Invalid query syntax";
      setState((prev) => ({
        ...prev,
        error: message,
      }));
    }
  };

  const handleCancel = () => {
    setState((prev) => ({ ...prev, isEditing: false }));
  };

  // Show edit mode
  if (state.isEditing) {
    return (
      <Box
        p="md"
        style={{
          border: `2px solid ${
            isDark
              ? "var(--mantine-color-blue-7)"
              : "var(--mantine-color-blue-5)"
          }`,
          backgroundColor: isDark
            ? "rgba(63, 81, 181, 0.1)"
            : "var(--mantine-color-blue-0)",
          borderRadius: "6px",
        }}
        mb="md"
      >
        <Stack gap="sm">
          <Text size="sm" fw={500} c="blue">
            Edit Query
          </Text>
          <textarea
            value={state.editValue}
            onChange={(e) =>
              setState((prev) => ({ ...prev, editValue: e.target.value }))
            }
            style={{
              width: "100%",
              minHeight: "100px",
              fontFamily: "monospace",
              padding: "12px",
              fontSize: "13px",
              border: `1px solid ${
                isDark
                  ? "var(--mantine-color-gray-6)"
                  : "var(--mantine-color-gray-4)"
              }`,
              borderRadius: "4px",
              resize: "vertical",
              boxSizing: "border-box",
              backgroundColor: isDark ? "var(--mantine-color-gray-8)" : "white",
              color: isDark ? "var(--mantine-color-gray-0)" : "inherit",
            }}
          />
          <Group gap="sm">
            <Button size="xs" onClick={handleSave}>
              Save
            </Button>
            <Button size="xs" variant="default" onClick={handleCancel}>
              Cancel
            </Button>
          </Group>
        </Stack>
      </Box>
    );
  }

  // Show loading state
  if (state.isLoading) {
    return (
      <Box
        p="md"
        ta="center"
        mb="md"
        style={{
          border: `1px solid ${
            isDark
              ? "var(--mantine-color-gray-6)"
              : "var(--mantine-color-gray-3)"
          }`,
          borderRadius: "4px",
          backgroundColor: isDark
            ? "var(--mantine-color-gray-9)"
            : "transparent",
        }}
      >
        <Loader size="sm" />
      </Box>
    );
  }

  // Show error state
  if (state.error) {
    return (
      <Alert
        title="Query Error"
        color="red"
        mb="md"
        style={{ cursor: "pointer", borderRadius: "4px" }}
        onClick={handleEdit}
        icon={
          <Tooltip label="Click to edit">
            <ActionIcon
              size="sm"
              color="red"
              variant="subtle"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit();
              }}
            >
              <IconEdit size={14} />
            </ActionIcon>
          </Tooltip>
        }
      >
        {state.error}
      </Alert>
    );
  }

  // Show results (embed style)
  return (
    <Box
      p="md"
      mb="md"
      style={{
        border: `1px solid ${
          isDark ? "var(--mantine-color-blue-7)" : "var(--mantine-color-blue-2)"
        }`,
        backgroundColor: isDark
          ? "rgba(63, 81, 181, 0.08)"
          : "var(--mantine-color-blue-0)",
        borderRadius: "6px",
        cursor: "pointer",
      }}
      onClick={handleEdit}
    >
      <Stack gap="sm">
        <Group justify="space-between" mb="xs">
          <Group gap="xs">
            <Text size="sm" fw={500} c="blue">
              Query Results
            </Text>
            <Text size="xs" c="dimmed">
              ({state.results.length})
            </Text>
          </Group>
          <Tooltip label="Edit query">
            <ActionIcon
              size="sm"
              variant="subtle"
              color="blue"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit();
              }}
            >
              <IconEdit size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {state.results.length === 0 ? (
          <Text size="sm" c="dimmed" style={{ fontStyle: "italic" }}>
            No results found
          </Text>
        ) : (
          <Stack gap="xs">
            {state.results.map((block) => (
              <Box
                key={block.id}
                p="xs"
                style={{
                  backgroundColor: isDark
                    ? "var(--mantine-color-gray-8)"
                    : "white",
                  borderLeft: `3px solid ${
                    isDark
                      ? "var(--mantine-color-blue-5)"
                      : "var(--mantine-color-blue-4)"
                  }`,
                  borderRadius: "3px",
                }}
              >
                <Text size="xs" c="dimmed" fw={500}>
                  {block.pagePath}
                </Text>
                <Text
                  size="sm"
                  style={{
                    wordBreak: "break-word",
                    color: isDark ? "var(--mantine-color-gray-1)" : "inherit",
                  }}
                >
                  {block.content}
                </Text>
              </Box>
            ))}
          </Stack>
        )}

        <Text
          size="xs"
          c="dimmed"
          style={{ fontStyle: "italic", marginTop: "4px" }}
        >
          Click or press Edit to modify query
        </Text>
      </Stack>
    </Box>
  );
};

export default QueryBlock;
