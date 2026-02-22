import { Box, Group, Text } from "@mantine/core";
import type { TodoResult, TodoStatus } from "../../types/todo";
import { TodoStatusIcon } from "./TodoStatusIcon";
import { formatDateForDisplay } from "../../types/todo";

interface TodoListViewProps {
  todos: TodoResult[];
  onTodoClick?: (todo: TodoResult) => void;
}

function getStatusPrefix(status: TodoStatus): string {
  const prefixes: Record<TodoStatus, string> = {
    todo: "TODO ",
    doing: "DOING ",
    done: "DONE ",
    later: "LATER ",
    canceled: "CANCELED ",
  };
  return prefixes[status] || "";
}

export function TodoListView({ todos, onTodoClick }: TodoListViewProps) {
  if (todos.length === 0) {
    return (
      <Box p="md">
        <Text c="dimmed" size="sm" ta="center">
          No tasks found
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      {todos.map((todo) => (
        <Group
          key={todo.blockId}
          gap="xs"
          style={{
            padding: "8px 12px",
            cursor: "pointer",
            borderBottom: "1px solid var(--color-border-secondary)",
            transition: "background-color 0.15s ease",
          }}
          onClick={() => onTodoClick?.(todo)}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          {/* Status Icon */}
          <TodoStatusIcon
            status={todo.status}
            onClick={() => {
              // Could open status menu here
            }}
          />

          {/* Content */}
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text
              size="sm"
              c="var(--color-text-primary)"
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {todo.content.replace(getStatusPrefix(todo.status), "")}
            </Text>
            <Text size="xs" c="var(--color-text-secondary)">
              {todo.pageTitle}
            </Text>
          </Box>

          {/* Date & Priority badges */}
          <Group gap="xs">
            {todo.scheduled && (
              <Text size="xs" c="var(--color-text-secondary)">
                📅 {formatDateForDisplay(todo.scheduled)}
              </Text>
            )}
            {todo.deadline && (
              <Text size="xs" c="var(--color-text-secondary)">
                ⏰ {formatDateForDisplay(todo.deadline)}
              </Text>
            )}
            {todo.priority && (
              <Box
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: "var(--font-size-xs)",
                  padding: "2px 6px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor:
                    todo.priority === "A"
                      ? "rgba(239, 68, 68, 0.2)"
                      : todo.priority === "B"
                        ? "rgba(234, 179, 8, 0.2)"
                        : "rgba(59, 130, 246, 0.2)",
                  color:
                    todo.priority === "A"
                      ? "#ef4444"
                      : todo.priority === "B"
                        ? "#eab308"
                        : "#3b82f6",
                  fontWeight: 500,
                }}
              >
                {todo.priority}
              </Box>
            )}
          </Group>
        </Group>
      ))}
    </Box>
  );
}
