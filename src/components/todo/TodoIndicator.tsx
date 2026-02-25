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
  const togglePanel = useTodoPanelStore((s) => s.togglePanel);
  const isOpen = useTodoPanelStore((s) => s.isOpen);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleTodos, setVisibleTodos] = useState<TodoResult[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);

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
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % visibleTodos.length);
        setIsTransitioning(false);
      }, 150);
    }, 3000);

    return () => clearInterval(interval);
  }, [visibleTodos.length]);

  if (visibleTodos.length === 0) {
    return null;
  }

  const currentTodo = visibleTodos[currentIndex];
  if (!currentTodo) return null;

  const config = STATUS_CONFIG[currentTodo.status];
  const IconComponent = config.icon;
  const extracted = extractStatusPrefix(currentTodo.content);
  const displayContent = extracted ? extracted.rest : currentTodo.content;

  return (
    <>
      <style>
        {`
          @keyframes todoFadeIn {
            from { opacity: 0; transform: translateY(4px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
      <Box
        onClick={togglePanel}
        style={{
          position: "fixed",
          bottom: "16px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 10px",
          backgroundColor: "transparent",
          borderRadius: "var(--radius-sm)",
          cursor: "pointer",
          transition: "opacity var(--transition-fast)",
          minWidth: "120px",
          maxWidth: "280px",
          opacity: isOpen ? 0.6 : 1,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = isOpen ? "0.6" : "1";
        }}
      >
        <IconComponent
          size={14}
          stroke={1.5}
          style={{ color: config.color, flexShrink: 0 }}
        />
        <Text
          size="xs"
          style={{
            color: isOpen
              ? "var(--color-accent)"
              : "var(--color-text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            minWidth: 0,
            opacity: isTransitioning ? 0 : 1,
            transform: isTransitioning ? "translateY(2px)" : "translateY(0)",
            transition: "opacity 0.15s ease, transform 0.15s ease",
          }}
        >
          {displayContent}
        </Text>
        {visibleTodos.length > 1 && (
          <Text
            size="xs"
            style={{
              color: "var(--color-text-tertiary)",
              flexShrink: 0,
              fontSize: "10px",
            }}
          >
            {currentIndex + 1}/{visibleTodos.length}
          </Text>
        )}
      </Box>
    </>
  );
}
