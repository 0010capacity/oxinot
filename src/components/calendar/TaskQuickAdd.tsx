import { useBlockStore } from "@/stores/blockStore";
import { useTodoStore } from "@/stores/todoStore";
import type { TodoResult } from "@/types/todo";
import {
  type CSSProperties,
  type KeyboardEvent,
  useCallback,
  useRef,
  useState,
} from "react";

type TaskMode = "todo" | "scheduled" | "repeat";

interface TaskQuickAddProps {
  selectedDate: Date;
  onTaskAdded?: (todo: TodoResult) => void;
  placeholder?: string;
}

const containerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--spacing-xs)",
  width: "100%",
};

const rowStyle: CSSProperties = {
  display: "flex",
  gap: "var(--spacing-sm)",
  alignItems: "center",
  width: "100%",
};

const inputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "var(--spacing-sm) var(--spacing-md)",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--color-border-primary)",
  borderRadius: "var(--radius-md)",
  backgroundColor: "var(--color-bg-primary)",
  color: "var(--color-text-primary)",
  fontFamily: "var(--font-family)",
  fontSize: "var(--font-size-sm)",
  lineHeight: "var(--line-height-normal)",
  outline: "none",
  transition:
    "border-color var(--transition-fast), box-shadow var(--transition-fast)",
};

const inputFocusStyle: CSSProperties = {
  borderColor: "var(--color-accent)",
  boxShadow:
    "0 0 0 2px color-mix(in srgb, var(--color-accent) 25%, transparent)",
};

const modeIndicatorStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--spacing-xs)",
  padding: "4px var(--spacing-sm)",
  backgroundColor: "var(--color-bg-secondary)",
  borderRadius: "var(--radius-sm)",
  fontSize: "var(--font-size-xs)",
  color: "var(--color-text-secondary)",
  fontFamily: "var(--font-family)",
  whiteSpace: "nowrap",
};

const modeDotStyle: CSSProperties = {
  width: "6px",
  height: "6px",
  borderRadius: "50%",
};

const buttonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--spacing-xs)",
  padding: "var(--spacing-sm) var(--spacing-md)",
  border: "none",
  borderRadius: "var(--radius-md)",
  backgroundColor: "var(--color-accent)",
  color: "var(--color-text-on-accent, #fff)",
  fontFamily: "var(--font-family)",
  fontSize: "var(--font-size-sm)",
  fontWeight: 500,
  lineHeight: "var(--line-height-normal)",
  cursor: "pointer",
  whiteSpace: "nowrap",
  transition:
    "opacity var(--transition-fast), transform var(--transition-fast)",
};

const buttonDisabledStyle: CSSProperties = {
  opacity: 0.5,
  cursor: "not-allowed",
};

const errorStyle: CSSProperties = {
  color: "var(--color-error)",
  fontSize: "var(--font-size-xs, 11px)",
  lineHeight: "var(--line-height-tight)",
  margin: 0,
  padding: "0 var(--spacing-sm)",
};

const MODE_CONFIG: Record<
  TaskMode,
  { label: string; dotColor: string; hint: string }
> = {
  todo: {
    label: "TODO",
    dotColor: "var(--color-text-tertiary)",
    hint: "No date",
  },
  scheduled: {
    label: "SCHEDULED",
    dotColor: "var(--color-accent)",
    hint: "On selected date",
  },
  repeat: {
    label: "REPEAT",
    dotColor: "var(--color-warning, #f59e0b)",
    hint: "Weekly",
  },
};

export function TaskQuickAdd({
  selectedDate,
  onTaskAdded,
  placeholder = "Add a task\u2026",
}: TaskQuickAddProps) {
  const [value, setValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [mode, setMode] = useState<TaskMode>("scheduled");
  const inputRef = useRef<HTMLInputElement>(null);

  const createTodo = useTodoStore((s) => s.createTodo);
  const setBlockMetadata = useBlockStore((s) => s.setBlockMetadata);

  const cycleMode = useCallback(() => {
    setMode((prev) => {
      if (prev === "todo") return "scheduled";
      if (prev === "scheduled") return "repeat";
      return "todo";
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createTodo(trimmed);

      if (result) {
        let todoWithDate: TodoResult;

        if (mode === "todo") {
          // Pure TODO: remove scheduled metadata
          await setBlockMetadata(result.blockId, "scheduled", null);
          todoWithDate = {
            ...result,
            scheduled: undefined,
          };
        } else if (mode === "scheduled") {
          // SCHEDULED: set to selectedDate
          const scheduledStr = selectedDate.toISOString().split("T")[0];
          await setBlockMetadata(result.blockId, "scheduled", scheduledStr);
          todoWithDate = {
            ...result,
            scheduled: scheduledStr,
          };
        } else {
          // REPEAT: set repeat metadata (weekly by default)
          const scheduledStr = selectedDate.toISOString().split("T")[0];
          const repeatConfig = { frequency: "weekly" as const };
          await setBlockMetadata(result.blockId, "scheduled", scheduledStr);
          await setBlockMetadata(result.blockId, "repeat", JSON.stringify(repeatConfig));
          todoWithDate = {
            ...result,
            scheduled: scheduledStr,
            repeat: repeatConfig,
          };
        }

        setValue("");
        onTaskAdded?.(todoWithDate);
      } else {
        setError("Failed to create task. Please try again.");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
    } finally {
      setIsSubmitting(false);
      inputRef.current?.focus();
    }
  }, [
    value,
    isSubmitting,
    createTodo,
    setBlockMetadata,
    selectedDate,
    onTaskAdded,
    mode,
  ]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === "Tab") {
        e.preventDefault();
        cycleMode();
      }
    },
    [handleSubmit, cycleMode],
  );

  const computedInputStyle: CSSProperties = {
    ...inputStyle,
    ...(isFocused ? inputFocusStyle : {}),
  };

  const computedButtonStyle: CSSProperties = {
    ...buttonStyle,
    ...(isSubmitting || !value.trim() ? buttonDisabledStyle : {}),
  };

  const modeConfig = MODE_CONFIG[mode];
  const dateLabel = selectedDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      style={containerStyle}
      role="form"
      aria-label={`Add task for ${dateLabel}`}
    >
      <div style={rowStyle}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={isSubmitting}
          aria-label={`New task for ${dateLabel}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "task-quick-add-error" : undefined}
          style={computedInputStyle}
        />
        <button
          type="button"
          onClick={cycleMode}
          style={modeIndicatorStyle}
          title={`Tab to change mode\n${modeConfig.hint}`}
          aria-label={`Task mode: ${modeConfig.label}. Press Tab or click to change.`}
        >
          <div style={{ ...modeDotStyle, backgroundColor: modeConfig.dotColor }} />
          <span>{modeConfig.label}</span>
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !value.trim()}
          aria-label="Add task"
          style={computedButtonStyle}
          onMouseDown={(e) => {
            if (!isSubmitting && value.trim()) {
              e.currentTarget.style.transform = "scale(0.95)";
            }
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          {isSubmitting ? (
            "Adding\u2026"
          ) : (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add
            </>
          )}
        </button>
      </div>
      {error && (
        <p id="task-quick-add-error" role="alert" style={errorStyle}>
          {error}
        </p>
      )}
    </div>
  );
}
