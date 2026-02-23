import {
  Badge,
  Box,
  Checkbox,
  Group,
  Menu,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { IconAlertTriangle, IconCalendar, IconX } from "@tabler/icons-react";
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
          <Checkbox
            checked={selectedIds.has(todo.blockId)}
            onChange={() => handleToggleSelect(todo.blockId)}
            onClick={(e) => e.stopPropagation()}
            size="xs"
          />

          <TodoStatusIcon status={todo.status} onClick={() => {}} />

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

          <Group gap="xs">
            {todo.scheduled && (
              <Badge
                size="xs"
                variant="light"
                color="blue"
                leftSection={<IconCalendar size={10} stroke={1.5} />}
              >
                {formatDateForDisplay(todo.scheduled)}
              </Badge>
            )}
            {todo.deadline && (
              <Badge
                size="xs"
                variant="light"
                color="red"
                leftSection={<IconAlertTriangle size={10} stroke={1.5} />}
              >
                {formatDateForDisplay(todo.deadline)}
              </Badge>
            )}
            {todo.priority && (
              <Badge
                size="xs"
                variant="light"
                color={
                  todo.priority === "A"
                    ? "red"
                    : todo.priority === "B"
                      ? "yellow"
                      : "blue"
                }
              >
                P{todo.priority}
              </Badge>
            )}
          </Group>
        </Group>
      ))}
    </Box>
  );
}
