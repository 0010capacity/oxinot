import {
  Box,
  Checkbox,
  Group,
  Menu,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { useCallback, useState } from "react";
import { useTodoStore } from "../../stores/todoStore";
import type { TodoResult, TodoStatus } from "../../types/todo";
import { formatDateForDisplay } from "../../types/todo";
import { TodoStatusIcon } from "./TodoStatusIcon";

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

const STATUS_OPTIONS: { value: TodoStatus; label: string }[] = [
  { value: "todo", label: "TODO" },
  { value: "doing", label: "DOING" },
  { value: "done", label: "DONE" },
  { value: "later", label: "LATER" },
  { value: "canceled", label: "CANCELED" },
];

export function TodoListView({ todos, onTodoClick }: TodoListViewProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const bulkUpdateStatus = useTodoStore((s) => s.bulkUpdateStatus);

  const isAllSelected = todos.length > 0 && selectedIds.size === todos.length;
  const isSomeSelected = selectedIds.size > 0;

  const handleToggleSelect = useCallback((blockId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(todos.map((t) => t.blockId)));
    }
  }, [todos, isAllSelected]);

  const handleBulkStatusChange = useCallback(
    async (status: TodoStatus) => {
      if (selectedIds.size === 0) return;
      await bulkUpdateStatus(Array.from(selectedIds), status);
      setSelectedIds(new Set());
    },
    [selectedIds, bulkUpdateStatus],
  );

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

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
      {/* Bulk Actions Bar */}
      {isSomeSelected && (
        <Group
          gap="xs"
          style={{
            padding: "8px 12px",
            backgroundColor: "var(--color-bg-secondary)",
            borderBottom: "1px solid var(--color-border-primary)",
          }}
        >
          <Text size="sm" c="var(--color-text-secondary)">
            {selectedIds.size} selected
          </Text>
          <Menu position="bottom-start" withinPortal>
            <Menu.Target>
              <UnstyledButton
                style={{
                  padding: "4px 8px",
                  fontSize: "var(--font-size-xs)",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--color-bg-hover)",
                }}
              >
                Mark as...
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              {STATUS_OPTIONS.map((opt) => (
                <Menu.Item
                  key={opt.value}
                  onClick={() => handleBulkStatusChange(opt.value)}
                >
                  {opt.label}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
          <UnstyledButton
            onClick={handleClearSelection}
            style={{
              padding: "4px 8px",
              fontSize: "var(--font-size-xs)",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--color-bg-hover)",
            }}
          >
            <IconX size={14} />
          </UnstyledButton>
        </Group>
      )}

      {/* Select All Header */}
      <Group
        gap="xs"
        style={{
          padding: "6px 12px",
          borderBottom: "1px solid var(--color-border-secondary)",
          backgroundColor: "var(--color-bg-secondary)",
        }}
      >
        <Checkbox
          checked={isAllSelected}
          indeterminate={isSomeSelected && !isAllSelected}
          onChange={handleToggleAll}
          size="xs"
        />
        <Text size="xs" c="var(--color-text-secondary)">
          {todos.length} task{todos.length !== 1 ? "s" : ""}
        </Text>
      </Group>

      {/* Todo Items */}
      {todos.map((todo) => (
        <Group
          key={todo.blockId}
          gap="xs"
          style={{
            padding: "8px 12px",
            cursor: "pointer",
            borderBottom: "1px solid var(--color-border-secondary)",
            transition: "background-color 0.15s ease",
            backgroundColor: selectedIds.has(todo.blockId)
              ? "var(--color-bg-secondary)"
              : "transparent",
          }}
          onClick={() => onTodoClick?.(todo)}
          onMouseEnter={(e) => {
            if (!selectedIds.has(todo.blockId)) {
              e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
            }
          }}
          onMouseLeave={(e) => {
            if (!selectedIds.has(todo.blockId)) {
              e.currentTarget.style.backgroundColor = "transparent";
            }
          }}
        >
          {/* Selection Checkbox */}
          <Checkbox
            checked={selectedIds.has(todo.blockId)}
            onChange={() => handleToggleSelect(todo.blockId)}
            onClick={(e) => e.stopPropagation()}
            size="xs"
          />

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
                textDecoration:
                  todo.status === "done" ? "line-through" : "none",
                opacity: todo.status === "done" ? 0.6 : 1,
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
