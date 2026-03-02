import { Badge, Box, Group, Modal, Text, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconTrash } from "@tabler/icons-react";
import type { CSSProperties } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useBlockUIStore } from "../../stores/blockUIStore";
import { usePageStore } from "../../stores/pageStore";
import { useTodoStore } from "../../stores/todoStore";
import { useViewStore } from "../../stores/viewStore";
import type { Priority, TodoResult, TodoStatus } from "../../types/todo";
import { TodoStatusIcon } from "../todo/TodoStatusIcon";

interface DayTaskListProps {
  selectedDate: string;
  tasks: TodoResult[];
  onTaskStatusChange?: (blockId: string, status: TodoStatus) => void;
  onTaskDelete?: (blockId: string) => void;
}

interface TaskGroup {
  label: string;
  tasks: TodoResult[];
}

const PRIORITY_COLORS: Record<Priority, string> = {
  A: "var(--color-error)",
  B: "var(--color-warning)",
  C: "var(--color-text-tertiary)",
};

const containerStyle: CSSProperties = {
  maxHeight: "400px",
  overflowY: "auto",
  overflowX: "hidden",
};

const groupHeaderStyle: CSSProperties = {
  padding: "6px 16px 5px",
  fontSize: 9,
  fontWeight: 700,
  color: "var(--color-text-tertiary)",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  backgroundColor: "var(--color-bg-secondary)",
  borderBottom: "1px solid var(--color-border-secondary)",
  borderTop: "1px solid var(--color-border-secondary)",
};

const taskRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 16px",
  cursor: "pointer",
  borderBottom: "1px solid var(--color-border-secondary)",
  transition: "background-color var(--transition-fast)",
  backgroundColor: "transparent",
  position: "relative",
};

const taskContentStyle: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: "var(--font-size-sm)",
  color: "var(--color-text-primary)",
  lineHeight: 1.4,
};

const completedContentStyle: CSSProperties = {
  ...taskContentStyle,
  textDecoration: "line-through",
  opacity: 0.45,
};

const deleteButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "24px",
  height: "24px",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text-tertiary)",
  opacity: 0,
  transition:
    "opacity var(--transition-fast), background-color var(--transition-fast), color var(--transition-fast)",
  flexShrink: 0,
};

const deleteButtonVisibleStyle: CSSProperties = {
  ...deleteButtonStyle,
  opacity: 1,
};

const emptyStateStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "var(--spacing-lg)",
  gap: "var(--spacing-sm)",
  color: "var(--color-text-tertiary)",
};

const pageNameStyle: CSSProperties = {
  fontSize: 10,
  color: "var(--color-text-tertiary)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  lineHeight: 1.3,
  marginTop: 1,
};

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

function groupTasksByType(
  tasks: TodoResult[],
  selectedDate: string,
): TaskGroup[] {
  const scheduled: TodoResult[] = [];
  const deadline: TodoResult[] = [];
  const other: TodoResult[] = [];

  for (const task of tasks) {
    const isScheduled = task.scheduled === selectedDate;
    const isDeadline = task.deadline === selectedDate;

    if (isScheduled && isDeadline) {
      // Show in both if both match, but prioritize scheduled
      scheduled.push(task);
    } else if (isScheduled) {
      scheduled.push(task);
    } else if (isDeadline) {
      deadline.push(task);
    } else {
      other.push(task);
    }
  }

  const groups: TaskGroup[] = [];

  if (scheduled.length > 0) {
    groups.push({ label: "Scheduled Today", tasks: scheduled });
  }
  if (deadline.length > 0) {
    groups.push({ label: "Deadline Today", tasks: deadline });
  }
  if (other.length > 0) {
    groups.push({ label: "Other", tasks: other });
  }

  return groups;
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge
      size="xs"
      variant="light"
      style={{
        backgroundColor: `color-mix(in srgb, ${PRIORITY_COLORS[priority]} 15%, transparent)`,
        color: PRIORITY_COLORS[priority],
        border: `1px solid color-mix(in srgb, ${PRIORITY_COLORS[priority]} 30%, transparent)`,
        fontWeight: 700,
        flexShrink: 0,
      }}
      aria-label={`Priority ${priority}`}
    >
      {priority}
    </Badge>
  );
}

export function DayTaskList({
  selectedDate,
  tasks,
  onTaskStatusChange,
  onTaskDelete,
}: DayTaskListProps) {
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TodoResult | null>(null);
  const [
    deleteModalOpened,
    { open: openDeleteModal, close: closeDeleteModal },
  ] = useDisclosure(false);

  const openPageById = usePageStore((s) => s.openPageById);
  const zoomToBlock = useViewStore((s) => s.zoomToBlock);
  const setFocusedBlock = useBlockUIStore((s) => s.setFocusedBlock);
  const cycleTodoStatus = useTodoStore((s) => s.cycleTodoStatus);
  const removeTodoStatus = useTodoStore((s) => s.removeTodoStatus);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const groups = useMemo(
    () => groupTasksByType(tasks, selectedDate),
    [tasks, selectedDate],
  );

  const handleTaskClick = useCallback(
    async (task: TodoResult) => {
      const currentPageId = usePageStore.getState().currentPageId;
      if (task.pageId !== currentPageId) {
        await openPageById(task.pageId);
      }

      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        zoomToBlock(task.blockId);
        setFocusedBlock(task.blockId);
        timeoutRef.current = null;
      }, 100);
    },
    [openPageById, zoomToBlock, setFocusedBlock],
  );

  const handleStatusToggle = useCallback(
    async (e: React.MouseEvent, task: TodoResult) => {
      e.stopPropagation();
      if (onTaskStatusChange) {
        const nextStatus: TodoStatus = task.status === "done" ? "todo" : "done";
        onTaskStatusChange(task.blockId, nextStatus);
      } else {
        await cycleTodoStatus(task.blockId);
      }
    },
    [onTaskStatusChange, cycleTodoStatus],
  );

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent, task: TodoResult) => {
      e.stopPropagation();
      setDeleteTarget(task);
      openDeleteModal();
    },
    [openDeleteModal],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;

    if (onTaskDelete) {
      onTaskDelete(deleteTarget.blockId);
    } else {
      await removeTodoStatus(deleteTarget.blockId);
    }

    setDeleteTarget(null);
    closeDeleteModal();
  }, [deleteTarget, onTaskDelete, removeTodoStatus, closeDeleteModal]);

  const handleCancelDelete = useCallback(() => {
    setDeleteTarget(null);
    closeDeleteModal();
  }, [closeDeleteModal]);

  if (tasks.length === 0) {
    return (
      <Box style={emptyStateStyle} aria-label="No tasks for selected date">
        <Text size="sm" style={{ color: "var(--color-text-tertiary)" }}>
          No tasks for this date
        </Text>
        <Text
          size="xs"
          style={{ color: "var(--color-text-tertiary)", opacity: 0.7 }}
        >
          Tasks with scheduled or deadline dates will appear here
        </Text>
      </Box>
    );
  }

  return (
    <>
      <Box
        style={containerStyle}
        role="list"
        aria-label={`Tasks for ${selectedDate}`}
      >
        {groups.map((group) => (
          <Box key={group.label} role="group" aria-label={group.label}>
            <Box style={groupHeaderStyle} role="heading" aria-level={3}>
              {group.label}&ensp;
              <span style={{ opacity: 0.6, fontWeight: 500 }}>
                ({group.tasks.length})
              </span>
            </Box>

            {group.tasks.map((task) => {
              const isHovered = hoveredTaskId === task.blockId;
              const isCompleted =
                task.status === "done" || task.status === "canceled";
              const displayContent = task.content.replace(
                getStatusPrefix(task.status),
                "",
              );

              return (
                <Box
                  key={task.blockId}
                  role="listitem"
                  aria-label={`Task: ${displayContent}`}
                  style={{
                    ...taskRowStyle,
                    backgroundColor: isHovered
                      ? "var(--color-bg-hover)"
                      : "transparent",
                  }}
                  onClick={() => handleTaskClick(task)}
                  onMouseEnter={() => setHoveredTaskId(task.blockId)}
                  onMouseLeave={() => setHoveredTaskId(null)}
                >
                  <TodoStatusIcon
                    status={task.status}
                    size={14}
                    onClick={() =>
                      handleStatusToggle(
                        { stopPropagation: () => {} } as React.MouseEvent,
                        task,
                      )
                    }
                    showTooltip
                  />

                  <Box style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                    <Text
                      style={
                        isCompleted ? completedContentStyle : taskContentStyle
                      }
                    >
                      {displayContent}
                    </Text>
                    <Text style={pageNameStyle}>{task.pageTitle}</Text>
                  </Box>

                  <Group gap={4} style={{ flexShrink: 0 }}>
                    {task.priority && (
                      <PriorityBadge priority={task.priority} />
                    )}

                    {task.scheduledTime && (
                      <Badge
                        size="xs"
                        variant="light"
                        style={{
                          backgroundColor:
                            "color-mix(in srgb, var(--color-accent) 15%, transparent)",
                          color: "var(--color-accent)",
                        }}
                        aria-label={`Scheduled time: ${task.scheduledTime}`}
                      >
                        {task.scheduledTime}
                      </Badge>
                    )}

                    {task.deadlineTime && (
                      <Badge
                        size="xs"
                        variant="light"
                        style={{
                          backgroundColor:
                            "color-mix(in srgb, var(--color-error) 15%, transparent)",
                          color: "var(--color-error)",
                        }}
                        aria-label={`Deadline time: ${task.deadlineTime}`}
                      >
                        {task.deadlineTime}
                      </Badge>
                    )}

                    <UnstyledButton
                      style={
                        isHovered ? deleteButtonVisibleStyle : deleteButtonStyle
                      }
                      onClick={(e) => handleDeleteClick(e, task)}
                      aria-label={`Delete task: ${displayContent}`}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "color-mix(in srgb, var(--color-error) 15%, transparent)";
                        e.currentTarget.style.color = "var(--color-error)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.color =
                          "var(--color-text-tertiary)";
                      }}
                    >
                      <IconTrash size={14} stroke={1.5} />
                    </UnstyledButton>
                  </Group>
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>

      <Modal
        opened={deleteModalOpened}
        onClose={handleCancelDelete}
        title="Delete Task"
        centered
        size="sm"
        aria-label="Confirm task deletion"
        styles={{
          header: {
            backgroundColor: "var(--color-bg-primary)",
            borderBottom: "1px solid var(--color-border-primary)",
          },
          body: {
            backgroundColor: "var(--color-bg-primary)",
          },
          content: {
            backgroundColor: "var(--color-bg-primary)",
          },
        }}
      >
        <Box style={{ padding: "var(--spacing-sm) 0" }}>
          <Text
            size="sm"
            style={{
              color: "var(--color-text-primary)",
              marginBottom: "var(--spacing-sm)",
            }}
          >
            Are you sure you want to remove the TODO status from this task?
          </Text>
          {deleteTarget && (
            <Text
              size="sm"
              style={{
                color: "var(--color-text-secondary)",
                padding: "var(--spacing-sm)",
                backgroundColor: "var(--color-bg-secondary)",
                borderRadius: "var(--radius-sm)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {deleteTarget.content.replace(
                getStatusPrefix(deleteTarget.status),
                "",
              )}
            </Text>
          )}

          <Group
            gap="var(--spacing-sm)"
            justify="flex-end"
            style={{ marginTop: "var(--spacing-md)" }}
          >
            <UnstyledButton
              onClick={handleCancelDelete}
              aria-label="Cancel deletion"
              style={{
                padding: "var(--spacing-sm) var(--spacing-md)",
                borderRadius: "var(--radius-sm)",
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-secondary)",
                backgroundColor: "var(--color-bg-secondary)",
                transition: "background-color var(--transition-fast)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor =
                  "var(--color-bg-secondary)";
              }}
            >
              Cancel
            </UnstyledButton>
            <UnstyledButton
              onClick={handleConfirmDelete}
              aria-label="Confirm deletion"
              style={{
                padding: "var(--spacing-sm) var(--spacing-md)",
                borderRadius: "var(--radius-sm)",
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-on-accent, #fff)",
                backgroundColor: "var(--color-error)",
                transition:
                  "background-color var(--transition-fast), opacity var(--transition-fast)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.85";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              Delete
            </UnstyledButton>
          </Group>
        </Box>
      </Modal>
    </>
  );
}
