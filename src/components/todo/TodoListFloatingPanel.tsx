import { Box, Text, Tooltip } from "@mantine/core";
import {
  IconAlertTriangle,
  IconCalendar,
  IconCalendarPlus,
  IconCheck,
  IconCircle,
  IconCircleCheck,
  IconCircleDashed,
  IconCircleDot,
  IconCircleX,
  IconFlag,
  IconList,
  IconPlus,
} from "@tabler/icons-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useBlockUIStore } from "../../stores/blockUIStore";
import { usePageStore } from "../../stores/pageStore";
import { useTodoPanelStore } from "../../stores/todoPanelStore";
import { useTodoStore } from "../../stores/todoStore";
import type { SmartView, TodoResult, TodoStatus } from "../../types/todo";
import { SMART_VIEWS, extractStatusPrefix } from "../../types/todo";
import { useViewStore } from "../../stores/viewStore";

const ICON_MAP: Record<
  SmartView["iconName"],
  | typeof IconCalendar
  | typeof IconCalendarPlus
  | typeof IconAlertTriangle
  | typeof IconFlag
  | typeof IconList
  | typeof IconCheck
> = {
  IconCalendar,
  IconCalendarPlus,
  IconAlertTriangle,
  IconFlag,
  IconList,
  IconCheck,
};

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
    icon: IconCircleCheck,
    color: "var(--color-success)",
  },
  later: {
    icon: IconCircleDashed,
    color: "var(--color-warning)",
  },
  canceled: {
    icon: IconCircleX,
    color: "var(--color-error)",
  },
};

function SmartViewIcon({
  iconName,
  size = 14,
}: { iconName: SmartView["iconName"]; size?: number }) {
  const IconComponent = ICON_MAP[iconName];
  return <IconComponent size={size} stroke={1.5} />;
}

const TodoItem = memo(function TodoItem({
  todo,
  onClick,
  onStatusToggle,
  isUpdating,
}: {
  todo: TodoResult;
  onClick: () => void;
  onStatusToggle: () => void;
  isUpdating: boolean;
}) {
  const config = STATUS_CONFIG[todo.status];
  const IconComponent = config.icon;
  const extracted = extractStatusPrefix(todo.content);
  const displayContent = extracted ? extracted.rest : todo.content;

  return (
    <Box
      onClick={onClick}
      style={{
        padding: "6px 8px",
        borderRadius: "var(--radius-sm)",
        cursor: "pointer",
        transition: "background-color var(--transition-fast)",
        display: "flex",
        alignItems: "flex-start",
        gap: "8px",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor =
          "var(--color-interactive-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onStatusToggle();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
          }
        }}
        disabled={isUpdating}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          marginTop: "2px",
          cursor: isUpdating ? "wait" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: isUpdating ? 0.5 : 1,
          transition: "transform var(--transition-fast)",
        }}
        onMouseEnter={(e) => {
          if (!isUpdating) {
            e.currentTarget.style.transform = "scale(1.15)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        <IconComponent size={14} stroke={1.5} style={{ color: config.color }} />
      </button>
      <Box style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        <Text
          size="xs"
          style={{
            color: "var(--color-text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textDecoration: todo.status === "done" ? "line-through" : "none",
            opacity: todo.status === "done" ? 0.5 : 1,
            lineHeight: 1.4,
          }}
        >
          {displayContent}
        </Text>
        <Text
          size="xs"
          style={{
            color: "var(--color-text-tertiary)",
            fontSize: "10px",
            marginTop: "2px",
          }}
        >
          {todo.pageTitle}
        </Text>
      </Box>
    </Box>
  );
});

export function TodoListFloatingPanel() {
  const isOpen = useTodoPanelStore((s) => s.isOpen);
  const activeView = useTodoPanelStore((s) => s.activeView);
  const closePanel = useTodoPanelStore((s) => s.closePanel);

  const setActiveView = useTodoPanelStore((s) => s.setActiveView);

const todos = useTodoStore((s) => s.todos);
  const fetchSmartView = useTodoStore((s) => s.fetchSmartView);
  const cycleTodoStatus = useTodoStore((s) => s.cycleTodoStatus);
  const createTodo = useTodoStore((s) => s.createTodo);
  const isLoading = useTodoStore((s) => s.isLoading);

  const openPageById = usePageStore((s) => s.openPageById);
  const zoomToBlock = useViewStore((s) => s.zoomToBlock);
  const setFocusedBlock = useBlockUIStore((s) => s.setFocusedBlock);

const [updatingBlockId, setUpdatingBlockId] = useState<string | null>(null);
  const [quickAddValue, setQuickAddValue] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isOpen) {
      fetchSmartView(activeView);
    }
  }, [isOpen, activeView, fetchSmartView]);

  const handleTodoClick = useCallback(
    async (todo: TodoResult) => {
      closePanel();

      const currentPageId = usePageStore.getState().currentPageId;
      if (todo.pageId !== currentPageId) {
        await openPageById(todo.pageId);
      }

      // Clear any existing timeout before setting new one
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        zoomToBlock(todo.blockId);
        setFocusedBlock(todo.blockId);
        timeoutRef.current = null;
      }, 100);
    },
    [closePanel, openPageById, zoomToBlock, setFocusedBlock],
  );

  const handleStatusToggle = useCallback(
    async (blockId: string) => {
      setUpdatingBlockId(blockId);
      try {
        await cycleTodoStatus(blockId);
        await fetchSmartView(activeView);
      } finally {
        setUpdatingBlockId(null);
      }
    },
[cycleTodoStatus, fetchSmartView, activeView],
  );

  const handleQuickAdd = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedValue = quickAddValue.trim();
      if (!trimmedValue) return;

      try {
        await createTodo(trimmedValue);
        setQuickAddValue("");
        await fetchSmartView(activeView);
      } catch (error) {
        console.error("[TodoListFloatingPanel] Failed to create todo:", error);
      }
    },
    [quickAddValue, createTodo, fetchSmartView, activeView],
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const activeViewData = SMART_VIEWS.find((v) => v.id === activeView);

  if (!isOpen) return null;

  return (
    <Box
      style={{
        position: "fixed",
        bottom: "52px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "320px",
        maxHeight: "320px",
        display: "flex",
        flexDirection: "column",
        zIndex: 200,
        overflow: "hidden",
        backgroundColor: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border-primary)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-lg)",
        animation: "slideUp 0.15s ease-out",
      }}
    >
      <style>
        {`
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateX(-50%) translateY(8px);
            }
            to {
              opacity: 1;
              transform: translateX(-50%) translateY(0);
            }
          }
        `}
      </style>

      <Box
        style={{
          padding: "4px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "2px",
        }}
      >

{SMART_VIEWS.map((view) => (
          <Tooltip key={view.id} label={view.label} position="bottom">
            <button
              type="button"
              onClick={() => setActiveView(view.id)}
              style={{
                width: 24,
                height: 20,
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "var(--radius-sm)",
                border: "none",
                cursor: "pointer",
                backgroundColor:
                  activeView === view.id
                    ? "var(--color-accent)"
                    : "transparent",
                color:
                  activeView === view.id
                    ? "white"
                    : "var(--color-text-tertiary)",
                transition: "all var(--transition-fast)",
              }}
              onMouseEnter={(e) => {
                if (activeView !== view.id) {
                  e.currentTarget.style.backgroundColor =
                    "var(--color-interactive-hover)";
                }
              }}
              onMouseLeave={(e) => {
                if (activeView !== view.id) {
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              <SmartViewIcon iconName={view.iconName} size={12} />
            </button>
          </Tooltip>
        ))}
      </Box>

      {/* Quick-add input */}
      <form onSubmit={handleQuickAdd}>
        <Box
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 8px",
            borderTop: "1px solid var(--color-border-secondary)",
            borderBottom: "1px solid var(--color-border-secondary)",
            backgroundColor: "var(--color-bg-secondary)",
          }}
        >
          <IconPlus size={12} stroke={1.5} style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }} />
          <input
            type="text"
            value={quickAddValue}
            onChange={(e) => setQuickAddValue(e.target.value)}
            placeholder="Add a task..."
            disabled={isLoading}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: "var(--font-size-xs)",
              color: "var(--color-text-primary)",
              padding: "2px 0",
            }}
          />
        </Box>
      </form>

      <Box
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          padding: "4px",
        }}
      >
        {todos.length === 0 ? (
          <Box
            style={{
              padding: "var(--spacing-md)",
              textAlign: "center",
              color: "var(--color-text-tertiary)",
            }}
          >
            <Text size="xs" style={{ fontSize: "11px" }}>
              No tasks
            </Text>
          </Box>
        ) : (
          todos.map((todo) => (
            <TodoItem
              key={todo.blockId}
              todo={todo}
              onClick={() => handleTodoClick(todo)}
              onStatusToggle={() => handleStatusToggle(todo.blockId)}
              isUpdating={updatingBlockId === todo.blockId}
            />
          ))
        )}
      </Box>

      {activeViewData && (
        <Box
          style={{
            padding: "4px 8px",
            borderTop: "1px solid var(--color-border-secondary)",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Text
            size="xs"
            style={{ color: "var(--color-text-tertiary)", fontSize: "10px" }}
          >
            {activeViewData.label}
          </Text>
        </Box>
      )}
    </Box>
  );
}
