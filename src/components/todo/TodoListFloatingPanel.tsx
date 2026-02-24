import { Badge, Box, Group, Text, Tooltip } from "@mantine/core";
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
  IconX,
} from "@tabler/icons-react";
import { memo, useCallback, useEffect, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { useBlockUIStore } from "../../stores/blockUIStore";
import { usePageStore } from "../../stores/pageStore";
import { useTodoPanelStore } from "../../stores/todoPanelStore";
import { useTodoStore } from "../../stores/todoStore";
import { useViewStore } from "../../stores/viewStore";
import type { SmartView, TodoResult, TodoStatus } from "../../types/todo";
import {
  SMART_VIEWS,
  extractStatusPrefix,
  formatDateForDisplay,
} from "../../types/todo";

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
  { icon: typeof IconCircle; color: string; label: string }
> = {
  todo: {
    icon: IconCircle,
    color: "var(--color-text-tertiary)",
    label: "TODO",
  },
  doing: {
    icon: IconCircleDot,
    color: "var(--color-accent)",
    label: "DOING",
  },
  done: {
    icon: IconCircleCheck,
    color: "var(--color-success)",
    label: "DONE",
  },
  later: {
    icon: IconCircleDashed,
    color: "var(--color-warning)",
    label: "LATER",
  },
  canceled: {
    icon: IconCircleX,
    color: "var(--color-error)",
    label: "CANCELED",
  },
};

function SmartViewIcon({
  iconName,
  size = 14,
}: { iconName: SmartView["iconName"]; size?: number }) {
  const IconComponent = ICON_MAP[iconName];
  return <IconComponent size={size} stroke={1.5} />;
}

function StatusCheckbox({
  status,
  onToggle,
  isLoading,
}: {
  status: TodoStatus;
  onToggle: () => void;
  isLoading?: boolean;
}) {
  const config = STATUS_CONFIG[status];
  const IconComponent = config.icon;

  return (
    <Tooltip label={`Status: ${config.label} (click to cycle)`} position="top">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        disabled={isLoading}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: isLoading ? "wait" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: isLoading ? 0.5 : 1,
          transition: "transform var(--transition-fast)",
        }}
        onMouseEnter={(e) => {
          if (!isLoading) {
            e.currentTarget.style.transform = "scale(1.1)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        <IconComponent size={18} stroke={1.5} style={{ color: config.color }} />
      </button>
    </Tooltip>
  );
}

function StatusBadge({ status }: { status: TodoStatus }) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge
      size="xs"
      variant="light"
      style={{
        backgroundColor: `color-mix(in srgb, ${config.color} 15%, transparent)`,
        color: config.color,
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
      }}
    >
      {config.label}
    </Badge>
  );
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
  const extracted = extractStatusPrefix(todo.content);
  const displayContent = extracted ? extracted.rest : todo.content;

  return (
    <Box
      onClick={onClick}
      style={{
        padding: "var(--spacing-sm) var(--spacing-md)",
        marginBottom: "var(--spacing-xs)",
        borderRadius: "var(--radius-sm)",
        backgroundColor: "rgba(255, 255, 255, 0.03)",
        cursor: "pointer",
        transition: "background-color var(--transition-fast)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor =
          "var(--color-interactive-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <StatusCheckbox
          status={todo.status}
          onToggle={onStatusToggle}
          isLoading={isUpdating}
        />
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Group gap="xs" wrap="nowrap" align="center">
            <Text
              size="sm"
              style={{
                color: "var(--color-text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textDecoration:
                  todo.status === "done" ? "line-through" : "none",
                opacity: todo.status === "done" ? 0.6 : 1,
                flex: 1,
              }}
            >
              {displayContent}
            </Text>
            <StatusBadge status={todo.status} />
          </Group>
          <Group gap="xs" mt={4}>
            <Text size="xs" c="dimmed">
              {todo.pageTitle}
            </Text>
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
        </Box>
      </Group>
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

  const openPageById = usePageStore((s) => s.openPageById);
  const zoomToBlock = useViewStore((s) => s.zoomToBlock);
  const setFocusedBlock = useBlockUIStore((s) => s.setFocusedBlock);

  const [updatingBlockId, setUpdatingBlockId] = useState<string | null>(null);

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

      setTimeout(() => {
        zoomToBlock(todo.blockId);
        setFocusedBlock(todo.blockId);
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

  const activeViewData = SMART_VIEWS.find((v) => v.id === activeView);

  if (!isOpen) return null;

  return (
    <Box
      style={{
        position: "fixed",
        bottom: "60px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "480px",
        maxHeight: "400px",
        display: "flex",
        flexDirection: "column",
        zIndex: 200,
        overflow: "hidden",
        backgroundColor: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border-primary)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-lg)",
        animation: "slideUp 0.2s ease-out",
      }}
    >
      <style>
        {`
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateX(-50%) translateY(20px);
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
          padding: "var(--spacing-sm) var(--spacing-md)",
          backgroundColor: "rgba(255, 255, 255, 0.03)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
          borderRadius: "var(--radius-sm)",
          marginBottom: "var(--spacing-xs)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Group gap="xs">
          <IconList
            size={16}
            stroke={1.5}
            style={{ color: "var(--color-text-secondary)" }}
          />
          <Text size="sm" fw={600}>
            Tasks
          </Text>
        </Group>
        <button
          type="button"
          onClick={closePanel}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--color-text-secondary)",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "var(--radius-sm)",
            transition: "background-color var(--transition-fast)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor =
              "var(--color-interactive-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <IconX size={14} stroke={1.5} />
        </button>
      </Box>

      <Box
        style={{
          padding: "var(--spacing-xs) var(--spacing-sm)",
          borderBottom: "1px solid var(--color-border-secondary)",
          display: "flex",
          justifyContent: "center",
          gap: "2px",
        }}
      >
        {SMART_VIEWS.map((view) => (
          <Tooltip key={view.id} label={view.label} position="bottom" withArrow>
            <button
              type="button"
              onClick={() => setActiveView(view.id)}
              style={{
                width: 32,
                height: 28,
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
                    : "var(--color-text-secondary)",
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
              <SmartViewIcon iconName={view.iconName} size={16} />
            </button>
          </Tooltip>
        ))}
      </Box>

      <Box style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        {todos.length === 0 ? (
          <Box
            style={{
              padding: "var(--spacing-lg)",
              textAlign: "center",
              color: "var(--color-text-tertiary)",
            }}
          >
            <Text size="sm">No tasks found</Text>
          </Box>
        ) : (
          <Virtuoso
            data={todos}
            itemContent={(_index, todo) => (
              <TodoItem
                todo={todo}
                onClick={() => handleTodoClick(todo)}
                onStatusToggle={() => handleStatusToggle(todo.blockId)}
                isUpdating={updatingBlockId === todo.blockId}
              />
            )}
            style={{ height: "100%" }}
          />
        )}
      </Box>

      <Box
        style={{
          padding: "var(--spacing-xs) var(--spacing-md)",
          backgroundColor: "rgba(255, 255, 255, 0.03)",
          borderTop: "1px solid rgba(255, 255, 255, 0.05)",
          borderRadius: "var(--radius-sm)",
          marginTop: "var(--spacing-xs)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text size="xs" c="dimmed">
          {todos.length} task{todos.length !== 1 ? "s" : ""}
        </Text>
        {activeViewData && (
          <Text size="xs" c="dimmed">
            {activeViewData.label}
          </Text>
        )}
      </Box>
    </Box>
  );
}
