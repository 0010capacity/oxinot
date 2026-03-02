import { useBlockStore } from "@/stores/blockStore";
import { useTodoStore } from "@/stores/todoStore";
import type { RepeatFrequency, TodoResult } from "@/types/todo";
import { IconPlus, IconRepeat } from "@tabler/icons-react";
import {
  type CSSProperties,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TaskMode = "todo" | "scheduled" | "repeat";

interface TaskQuickAddProps {
  selectedDate: Date;
  onTaskAdded?: (todo: TodoResult) => void;
  placeholder?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REPEAT_OPTIONS: { value: RepeatFrequency; label: string }[] = [
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
  { value: "yearly", label: "Every year" },
];

const MODE_META: Record<
  TaskMode,
  { label: string; color: string; title: string }
> = {
  todo: {
    label: "TODO",
    color: "var(--color-text-tertiary)",
    title: "No date — plain TODO",
  },
  scheduled: {
    label: "SCHED",
    color: "var(--color-accent)",
    title: "Scheduled on selected date",
  },
  repeat: {
    label: "REPEAT",
    color: "var(--color-warning, #f59e0b)",
    title: "Repeating task",
  },
};

// ---------------------------------------------------------------------------
// Inline CSS injected once
// ---------------------------------------------------------------------------

const QUICK_ADD_CSS = `
.oxinot-qa-wrap {
  display: flex;
  align-items: center;
  gap: 0;
  height: 32px;
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--radius-md);
  background: var(--color-bg-secondary);
  overflow: visible;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.oxinot-qa-wrap:focus-within {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 20%, transparent);
}
.oxinot-qa-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 8px;
  background: transparent;
  border: none;
  outline: none;
  font-size: var(--font-size-sm);
  font-family: var(--font-family);
  color: var(--color-text-primary);
}
.oxinot-qa-input::placeholder {
  color: var(--color-text-tertiary);
}
.oxinot-qa-mode {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  height: 100%;
  border: none;
  border-left: 1px solid var(--color-border-secondary);
  background: transparent;
  font-size: 10px;
  font-weight: 600;
  font-family: var(--font-family);
  letter-spacing: 0.02em;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color var(--transition-fast);
  flex-shrink: 0;
}
.oxinot-qa-mode:hover {
  background: var(--color-bg-hover);
}
.oxinot-qa-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 100%;
  border: none;
  border-left: 1px solid var(--color-border-secondary);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: background-color var(--transition-fast), color var(--transition-fast);
  flex-shrink: 0;
  padding: 0;
}
.oxinot-qa-submit:not(:disabled):hover {
  background: var(--color-accent);
  color: #fff;
}
.oxinot-qa-submit:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.oxinot-qa-mode-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
/* Repeat dropdown */
.oxinot-qa-repeat-anchor {
  position: relative;
}
.oxinot-qa-repeat-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 1100;
  min-width: 148px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.oxinot-qa-repeat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-family: var(--font-family);
  color: var(--color-text-primary);
  cursor: pointer;
  text-align: left;
  transition: background-color var(--transition-fast);
  width: 100%;
}
.oxinot-qa-repeat-item:hover {
  background: var(--color-bg-hover);
}
.oxinot-qa-repeat-item[data-selected="true"] {
  color: var(--color-accent);
  font-weight: 600;
}
.oxinot-qa-error {
  font-size: var(--font-size-xs);
  color: var(--color-error);
  padding: 2px 2px 0;
  font-family: var(--font-family);
}
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskQuickAdd({
  selectedDate,
  onTaskAdded,
  placeholder = "Add a task…",
}: TaskQuickAddProps) {
  const [value, setValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<TaskMode>("scheduled");
  const [repeatFreq, setRepeatFreq] = useState<RepeatFrequency>("weekly");
  const [repeatOpen, setRepeatOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const repeatMenuRef = useRef<HTMLDivElement>(null);

  const createTodo = useTodoStore((s) => s.createTodo);
  const setBlockMetadata = useBlockStore((s) => s.setBlockMetadata);

  // Close repeat dropdown on outside click
  useEffect(() => {
    if (!repeatOpen) return;
    const handler = (e: MouseEvent) => {
      if (!repeatMenuRef.current?.contains(e.target as Node)) {
        setRepeatOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [repeatOpen]);

  const cycleMode = useCallback(() => {
    setMode((prev) => {
      if (prev === "todo") return "scheduled";
      if (prev === "scheduled") return "repeat";
      return "todo";
    });
    setRepeatOpen(false);
  }, []);

  const handleModeClick = useCallback(() => {
    if (mode === "repeat") {
      setRepeatOpen((o) => !o);
    } else {
      cycleMode();
    }
  }, [mode, cycleMode]);

  const handleRepeatSelect = useCallback((freq: RepeatFrequency) => {
    setRepeatFreq(freq);
    setRepeatOpen(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createTodo(trimmed);
      if (!result) {
        setError("Failed to create task.");
        return;
      }

      const scheduledStr = selectedDate.toISOString().split("T")[0];

      if (mode === "todo") {
        await setBlockMetadata(result.blockId, "scheduled", null);
        onTaskAdded?.({ ...result, scheduled: undefined });
      } else if (mode === "scheduled") {
        await setBlockMetadata(result.blockId, "scheduled", scheduledStr);
        onTaskAdded?.({ ...result, scheduled: scheduledStr });
      } else {
        // repeat
        const repeatConfig = { frequency: repeatFreq };
        await setBlockMetadata(result.blockId, "scheduled", scheduledStr);
        await setBlockMetadata(
          result.blockId,
          "repeat",
          JSON.stringify(repeatConfig),
        );
        onTaskAdded?.({
          ...result,
          scheduled: scheduledStr,
          repeat: repeatConfig,
        });
      }

      setValue("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setIsSubmitting(false);
      inputRef.current?.focus();
    }
  }, [
    value,
    isSubmitting,
    mode,
    repeatFreq,
    selectedDate,
    createTodo,
    setBlockMetadata,
    onTaskAdded,
  ]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === "Tab") {
        e.preventDefault();
        cycleMode();
      } else if (e.key === "Escape") {
        setRepeatOpen(false);
      }
    },
    [handleSubmit, cycleMode],
  );

  const meta = MODE_META[mode];
  const repeatLabel =
    REPEAT_OPTIONS.find((o) => o.value === repeatFreq)?.label ?? "Every week";

  return (
    <div style={{ width: "100%" } as CSSProperties}>
      <style>{QUICK_ADD_CSS}</style>

      <div className="oxinot-qa-wrap">
        {/* Text input */}
        <input
          ref={inputRef}
          type="text"
          className="oxinot-qa-input"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isSubmitting}
          aria-label="New task"
        />

        {/* Mode pill */}
        <div className="oxinot-qa-repeat-anchor" ref={repeatMenuRef}>
          <button
            type="button"
            className="oxinot-qa-mode"
            onClick={handleModeClick}
            title={
              mode === "repeat"
                ? `${meta.title} — click to choose frequency`
                : `${meta.title} — click or Tab to change`
            }
            aria-label={`Mode: ${meta.label}`}
            aria-haspopup={mode === "repeat" ? "menu" : undefined}
            aria-expanded={mode === "repeat" ? repeatOpen : undefined}
          >
            <span
              className="oxinot-qa-mode-dot"
              style={{ backgroundColor: meta.color }}
            />
            <span style={{ color: meta.color }}>
              {mode === "repeat" ? repeatLabel : meta.label}
            </span>
            {mode === "repeat" && (
              <IconRepeat
                size={10}
                stroke={2}
                style={{ color: meta.color, marginLeft: 1 }}
              />
            )}
          </button>

          {/* Repeat frequency dropdown */}
          {mode === "repeat" && repeatOpen && (
            <div className="oxinot-qa-repeat-menu" role="menu">
              {REPEAT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="menuitem"
                  className="oxinot-qa-repeat-item"
                  data-selected={repeatFreq === opt.value ? "true" : "false"}
                  onClick={() => handleRepeatSelect(opt.value)}
                >
                  {opt.label}
                  {repeatFreq === opt.value && (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                      style={{ marginLeft: "auto" }}
                      aria-label="Selected"
                    >
                      <title>Selected repeat frequency</title>
                      <path
                        d="M1.5 5l2.5 2.5 5-5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              ))}
              {/* Escape hint */}
              <div
                style={{
                  borderTop: "1px solid var(--color-border-secondary)",
                  marginTop: 2,
                  paddingTop: 4,
                  paddingLeft: 10,
                  paddingRight: 10,
                  fontSize: 10,
                  color: "var(--color-text-tertiary)",
                  fontFamily: "var(--font-family)",
                }}
              >
                Click outside or Tab to switch mode
              </div>
            </div>
          )}
        </div>

        {/* Submit button */}
        <button
          type="button"
          className="oxinot-qa-submit"
          onClick={handleSubmit}
          disabled={isSubmitting || !value.trim()}
          aria-label="Add task"
        >
          <IconPlus size={14} stroke={2} />
        </button>
      </div>

      {error && (
        <p className="oxinot-qa-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
