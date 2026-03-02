import {
  Badge,
  Button,
  Group,
  Modal,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconAlertTriangle,
  IconCalendar,
  IconTrash,
} from "@tabler/icons-react";
import type { CSSProperties } from "react";
import { memo, useCallback } from "react";
import type { Priority, TodoResult, TodoStatus } from "../../types/todo";
import { formatDateForDisplay, removeStatusPrefix } from "../../types/todo";
import { TodoStatusIcon } from "./TodoStatusIcon";

type TaskItemLayout = "compact" | "expanded";

interface TaskItemProps {
  task: TodoResult;
  isSelected: boolean;
  onSelect: (task: TodoResult) => void;
  onStatusChange: (task: TodoResult, newStatus: TodoStatus) => void;
  onDelete?: (task: TodoResult) => void;
  layout: TaskItemLayout;
}

const PRIORITY_COLORS: Record<Priority, string> = {
  A: "var(--color-error)",
  B: "var(--color-warning)",
  C: "var(--color-text-tertiary)",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  A: "High",
  B: "Medium",
  C: "Low",
};



function PriorityBadge({
  priority,
  size,
}: { priority: Priority; size: "compact" | "expanded" }) {
  const color = PRIORITY_COLORS[priority];
  const badgeStyle: CSSProperties = {
    backgroundColor: "transparent",
    color,
    border: `1px solid ${color}`,
    borderRadius: "var(--radius-md)",
    padding:
      size === "compact"
        ? "0 var(--spacing-xs)"
        : "var(--spacing-xs) var(--spacing-sm)",
    fontSize:
      size === "compact" ? "var(--font-size-xs)" : "var(--font-size-sm)",
    fontWeight: 600,
    lineHeight: 1.4,
    flexShrink: 0,
    whiteSpace: "nowrap" as const,
  };

  return (
    <Tooltip label={`Priority: ${PRIORITY_LABELS[priority]}`} openDelay={400}>
      <span style={badgeStyle}>P{priority}</span>
    </Tooltip>
  );
}

function DateBadge({
  date,
  type,
}: { date: string; type: "scheduled" | "deadline" }) {
  const isDeadline = type === "deadline";
  const Icon = isDeadline ? IconAlertTriangle : IconCalendar;
  const color = isDeadline
    ? "var(--color-error)"
    : "var(--color-text-secondary)";

  return (
    <Badge
      size="xs"
      variant="light"
      leftSection={<Icon size={10} stroke={1.5} />}
      styles={{
        root: {
          backgroundColor: "transparent",
          border: `1px solid ${color}`,
          color,
          flexShrink: 0,
        },
      }}
    >
      {formatDateForDisplay(date)}
    </Badge>
  );
}

export const TaskItem = memo(function TaskItem({
  task,
  isSelected,
  onSelect,
  onStatusChange,
  onDelete,
  layout,
}: TaskItemProps) {
  const [isHovered, { open: onHoverEnter, close: onHoverLeave }] =
    useDisclosure(false);
  const [
    isDeleteModalOpen,
    { open: openDeleteModal, close: closeDeleteModal },
  ] = useDisclosure(false);

  const isCompleted = task.status === "done" || task.status === "canceled";
  const displayContent = removeStatusPrefix(task.content);

  const handleCheckboxClick = useCallback(() => {
    const newStatus: TodoStatus = isCompleted ? "todo" : "done";
    onStatusChange(task, newStatus);
  }, [task, isCompleted, onStatusChange]);

  const handleRowClick = useCallback(() => {
    onSelect(task);
  }, [task, onSelect]);

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      openDeleteModal();
    },
    [openDeleteModal],
  );

  const handleConfirmDelete = useCallback(() => {
    onDelete?.(task);
    closeDeleteModal();
  }, [task, onDelete, closeDeleteModal]);

  const isCompact = layout === "compact";

  const containerStyle: CSSProperties = {
    display: "flex",
    alignItems: isCompact ? "center" : "flex-start",
    gap: "var(--spacing-sm)",
    padding: isCompact
      ? "var(--spacing-sm) var(--spacing-md)"
      : "var(--spacing-md)",
    borderRadius: "var(--radius-md)",
    cursor: "pointer",
    backgroundColor: isSelected
      ? "var(--color-interactive-selected)"
      : isHovered
        ? "var(--color-bg-hover)"
        : "transparent",
    transition: "background-color var(--transition-fast)",
    position: "relative",
  };

  const contentStyle: CSSProperties = isCompact
    ? {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        flex: 1,
        minWidth: 0,
        textDecoration: isCompleted ? "line-through" : "none",
        opacity: isCompleted ? 0.5 : 1,
        color: "var(--color-text-primary)",
        fontSize: "var(--font-size-sm)",
        lineHeight: "var(--line-height-normal)",
        transition: "opacity var(--transition-fast)",
      }
    : {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        flex: 1,
        minWidth: 0,
        textDecoration: isCompleted ? "line-through" : "none",
        opacity: isCompleted ? 0.5 : 1,
        color: "var(--color-text-primary)",
        fontSize: "var(--font-size-base)",
        lineHeight: "var(--line-height-relaxed)",
        transition: "opacity var(--transition-fast)",
      };

  const deleteButtonStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "var(--spacing-xs)",
    borderRadius: "var(--radius-md)",
    color: "var(--color-text-tertiary)",
    opacity: isHovered ? 1 : 0,
    transition:
      "opacity var(--transition-fast), background-color var(--transition-fast)",
    pointerEvents: isHovered ? "auto" : "none",
    flexShrink: 0,
  };

  return (
    <>
      <div
        style={containerStyle}
        onClick={handleRowClick}
        onMouseEnter={onHoverEnter}
        onMouseLeave={onHoverLeave}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleRowClick();
          }
        }}
      >
        {/* Status Icon */}
        <TodoStatusIcon
          status={task.status}
          size={isCompact ? 14 : 16}
          onClick={handleCheckboxClick}
        />

        {/* Content area */}
        {isCompact ? (
          <>
            <span style={contentStyle}>{displayContent}</span>

            <Group
              gap="var(--spacing-xs)"
              wrap="nowrap"
              style={{ flexShrink: 0 }}
            >
              {task.priority && (
                <PriorityBadge priority={task.priority} size="compact" />
              )}
              {task.scheduled && (
                <DateBadge date={task.scheduled} type="scheduled" />
              )}
              {task.deadline && (
                <DateBadge date={task.deadline} type="deadline" />
              )}
            </Group>
          </>
        ) : (
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={contentStyle}>{displayContent}</span>

            <Text
              size="xs"
              c="var(--color-text-secondary)"
              style={{ marginTop: "var(--spacing-xs)" }}
            >
              {task.pageTitle}
            </Text>

            <Group
              gap="var(--spacing-sm)"
              wrap="wrap"
              style={{ marginTop: "var(--spacing-sm)" }}
            >
              {task.priority && (
                <PriorityBadge priority={task.priority} size="expanded" />
              )}
              {task.scheduled && (
                <DateBadge date={task.scheduled} type="scheduled" />
              )}
              {task.deadline && (
                <DateBadge date={task.deadline} type="deadline" />
              )}
            </Group>
          </div>
        )}

        {/* Delete button - shown on hover */}
        {onDelete && (
          <UnstyledButton style={deleteButtonStyle} onClick={handleDeleteClick}>
            <IconTrash size={14} stroke={1.5} />
          </UnstyledButton>
        )}
      </div>

      {/* Delete confirmation modal */}
      {onDelete && (
        <Modal
          opened={isDeleteModalOpen}
          onClose={closeDeleteModal}
          title="Delete Task"
          size="sm"
          centered
        >
          <Text size="sm" c="var(--color-text-secondary)">
            Are you sure you want to delete this task? This action cannot be
            undone.
          </Text>
          <Group justify="flex-end" mt="md" gap="var(--spacing-sm)">
            <Button variant="default" onClick={closeDeleteModal}>
              Cancel
            </Button>
            <Button color="red" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </Group>
        </Modal>
      )}
    </>
  );
});
