import { useEffect, useState } from "react";
import { Box, Group, Stack, Text, Loader, Alert, Button } from "@mantine/core";
import { tauriAPI, QueryResultBlock } from "../tauri-api";
import { parseQueryMacro, QueryParseError } from "../utils/queryParser";
import BlockComponent from "../outliner/BlockComponent";

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

const QueryBlock: React.FC<QueryBlockProps> = ({ macroString, workspacePath }) => {
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
      // Parse the query macro
      const parsed = parseQueryMacro(macroString);

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
        style={{ border: "1px solid var(--mantine-color-gray-3)" }}
        mb="md"
      >
        <Stack gap="sm">
          <textarea
            value={state.editValue}
            onChange={(e) =>
              setState((prev) => ({ ...prev, editValue: e.target.value }))
            }
            style={{
              width: "100%",
              minHeight: "100px",
              fontFamily: "monospace",
              padding: "8px",
              border: "1px solid var(--mantine-color-gray-4)",
              borderRadius: "4px",
            }}
          />
          <Group>
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
      <Box p="md" ta="center">
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
        onClick={handleEdit}
        style={{ cursor: "pointer" }}
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
        border: "1px solid var(--mantine-color-blue-1)",
        backgroundColor: "var(--mantine-color-blue-0)",
        borderRadius: "4px",
        cursor: "pointer",
      }}
      onClick={handleEdit}
    >
      <Stack gap="sm">
        <Group justify="space-between">
          <Text size="sm" fw={500} c="dimmed">
            Query Results ({state.results.length})
          </Text>
        </Group>

        {state.results.length === 0 ? (
          <Text size="sm" c="dimmed" italic>
            No results found
          </Text>
        ) : (
          <Stack gap="xs">
            {state.results.map((block) => (
              <Box
                key={block.id}
                p="xs"
                style={{
                  backgroundColor: "white",
                  borderLeft: "3px solid var(--mantine-color-blue-4)",
                  borderRadius: "2px",
                }}
              >
                <Text size="xs" c="dimmed">
                  {block.pagePath}
                </Text>
                <Text size="sm">{block.content}</Text>
              </Box>
            ))}
          </Stack>
        )}

        <Text size="xs" c="dimmed" italic>
          Click to edit query
        </Text>
      </Stack>
    </Box>
  );
};

export default QueryBlock;
