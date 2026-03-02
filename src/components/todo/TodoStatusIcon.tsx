import { Tooltip } from "@mantine/core";
import type { CSSProperties } from "react";
import { forwardRef, useCallback } from "react";
import type { TodoStatus } from "../../types/todo";
import { STATUS_DISPLAY_NAMES } from "../../types/todo";

interface TodoStatusIconProps {
  status: TodoStatus;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  size?: number;
  showTooltip?: boolean;
}

const STATUS_COLORS: Record<TodoStatus, string> = {
  todo: "var(--color-text-tertiary)",
  doing: "var(--color-accent)",
  done: "var(--color-success)",
  later: "var(--color-warning)",
  canceled: "var(--color-error)",
};

const containerStyle: CSSProperties = {
  flexShrink: 0,
  width: "var(--layout-bullet-container-size)",
  height: "var(--layout-bullet-container-size)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  border: "none",
  background: "transparent",
  padding: 0,
  transition: "background-color var(--transition-normal)",
  borderRadius: "var(--radius-sm)",
};

function TodoCircleIcon({
  status,
  size = 14,
}: { status: TodoStatus; size?: number }) {
  const color = STATUS_COLORS[status];

  switch (status) {
    case "todo":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
    case "doing":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2 a10 10 0 0 1 10 10" strokeWidth="2.5" />
        </svg>
      );
    case "done":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={color}
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
    case "later":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="4 2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
    case "canceled":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
      );
  }
}

export const TodoStatusIcon = forwardRef<
  HTMLButtonElement,
  TodoStatusIconProps
>(function TodoStatusIcon(
  { status, onClick, onContextMenu, size = 14, showTooltip = true },
  ref,
) {
  // Prevent mousedown from stealing focus from CodeMirror editor.
  // Without this, clicking the icon causes CM to blur, which triggers
  // editorStateCache save/restore and reverts the TODO prefix.
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick?.();
    },
    [onClick],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && onClick) {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }
    },
    [onClick],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu?.(e);
    },
    [onContextMenu],
  );

  const icon = (
    <button
      ref={ref}
      type="button"
      style={containerStyle}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      aria-label={`${STATUS_DISPLAY_NAMES[status]} - Click to cycle status`}
    >
      <TodoCircleIcon status={status} size={size} />
    </button>
  );

  if (showTooltip) {
    return (
      <Tooltip
        label={STATUS_DISPLAY_NAMES[status]}
        withArrow
        position="top"
        openDelay={500}
      >
        {icon}
      </Tooltip>
    );
  }

  return icon;
});

export { STATUS_COLORS };
