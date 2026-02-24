import { Box, Text } from "@mantine/core";
import { IconCircle, IconCircleDot } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useTodoPanelStore } from "../../stores/todoPanelStore";
import { useTodoStore } from "../../stores/todoStore";
import type { TodoResult, TodoStatus } from "../../types/todo";
import { extractStatusPrefix } from "../../types/todo";

const STATUS_CONFIG: Record<
  TodoStatus,
  { icon: typeof IconCircle; color: string }
> = {
  todo: {
    icon: IconCircle,
    color: "var(--color-text-tertiary)",
  },
  doing: {
    icon: IconCircleDot,
    color: "var(--color-accent)",
  },
  done: {
    icon: IconCircle,
    color: "var(--color-success)",
  },
  later: {
    icon: IconCircle,
    color: "var(--color-warning)",
  },
  canceled: {
    icon: IconCircle,
    color: "var(--color-error)",
  },
};

export function TodoIndicator() {
  const todos = useTodoStore((s) => s.todos);
  const fetchTodos = useTodoStore((s) => s.fetchTodos);
  const openPanel = useTodoPanelStore((s) => s.openPanel);
  const isOpen = useTodoPanelStore((s) => s.isOpen);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleTodos, setVisibleTodos] = useState<TodoResult[]>([]);

  useEffect(() => {
    fetchTodos({ status: ["todo", "doing"] });
  }, [fetchTodos]);

  useEffect(() => {
    const pending = useTodoStore
      .getState()
      .todos.filter((t) => t.status === "todo" || t.status === "doing");
    setVisibleTodos(pending);
  }, [todos]);

  useEffect(() => {
    if (visibleTodos.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % visibleTodos.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [visibleTodos.length]);

  if (isOpen || visibleTodos.length === 0) {
    return null;
  }

  const currentTodo = visibleTodos[currentIndex];
  if (!currentTodo) return null;

  const config = STATUS_CONFIG[currentTodo.status];
  const IconComponent = config.icon;
  const extracted = extractStatusPrefix(currentTodo.content);
  const displayContent = extracted ? extracted.rest : currentTodo.content;

  return (
    <Box
      onClick={openPanel}
      style={{
        position: "fixed",
        bottom: "12px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 14px",
        backgroundColor: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border-primary)",
        borderRadius: "20px",
        cursor: "pointer",
        transition: "all var(--transition-fast)",
        maxWidth: "400px",
        boxShadow: "var(--shadow-sm)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor =
          "var(--color-interactive-hover)";
        e.currentTarget.style.transform = "translateX(-50%) scale(1.02)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "var(--color-bg-elevated)";
        e.currentTarget.style.transform = "translateX(-50%) scale(1)";
      }}
    >
      <IconComponent size={14} stroke={1.5} style={{ color: config.color }} />
      <Text
        size="sm"
        style={{
          color: "var(--color-text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: "280px",
        }}
      >
        {displayContent}
      </Text>
      {visibleTodos.length > 1 && (
        <Text size="xs" c="dimmed" style={{ marginLeft: "4px" }}>
          {currentIndex + 1}/{visibleTodos.length}
        </Text>
      )}
    </Box>
  );
}
