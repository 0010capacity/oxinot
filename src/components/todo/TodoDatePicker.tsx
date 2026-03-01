import { Popover } from "@mantine/core";
import { DatePicker } from "@mantine/dates";
import { IconAlarm, IconCalendar } from "@tabler/icons-react";
import { format, isToday, parseISO } from "date-fns";
import type { CSSProperties } from "react";
import { useCallback, useMemo, useState } from "react";
import { useBlockStore } from "../../stores/blockStore";

interface TodoDatePickerProps {
  blockId: string;
  type: "scheduled" | "deadline";
  value?: string | null;
  onClose?: () => void;
}

const styles = {
  trigger: {
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "var(--font-size-xs)",
    color: "var(--color-text-secondary)",
    padding: "2px 6px",
    borderRadius: "var(--radius-sm)",
    backgroundColor: "var(--color-bg-secondary)",
    transition: "var(--transition-fast)",
    border: "none",
    fontFamily: "var(--font-family)",
    lineHeight: "1",
    userSelect: "none",
  } satisfies CSSProperties,

  triggerFocused: {
    color: "var(--color-accent)",
  } satisfies CSSProperties,

  dropdown: {
    padding: "var(--spacing-sm)",
  } satisfies CSSProperties,

  footer: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "var(--spacing-sm)",
    paddingTop: "var(--spacing-sm)",
    borderTop: "1px solid var(--color-border-primary)",
  } satisfies CSSProperties,

  clearButton: {
    border: "none",
    background: "transparent",
    color: "var(--color-text-tertiary)",
    fontSize: "var(--font-size-xs)",
    cursor: "pointer",
    padding: "4px var(--spacing-sm)",
    borderRadius: "var(--radius-sm)",
    transition: "var(--transition-fast)",
    fontFamily: "var(--font-family)",
  } satisfies CSSProperties,
};

function formatTriggerLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const date = parseISO(value);
    if (isToday(date)) return "Today";
    return format(date, "d MMM");
  } catch {
    return value;
  }
}

export function TodoDatePicker({
  blockId,
  type,
  value,
  onClose,
}: TodoDatePickerProps) {
  const [opened, setOpened] = useState(false);

  const setBlockMetadata = useBlockStore((s) => s.setBlockMetadata);

  const selectedDate = useMemo(() => {
    if (!value) return null;
    try {
      return parseISO(value);
    } catch {
      return null;
    }
  }, [value]);

  const handleSelectDate = useCallback(
    async (date: Date | null) => {
      if (!date) return;
      const isoDate = format(date, "yyyy-MM-dd");
      await setBlockMetadata(blockId, type, isoDate);
      setOpened(false);
      onClose?.();
    },
    [blockId, type, setBlockMetadata, onClose],
  );

  const handleClear = useCallback(async () => {
    await setBlockMetadata(blockId, type, null);
    setOpened(false);
    onClose?.();
  }, [blockId, type, setBlockMetadata, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpened(false);
        onClose?.();
      }
    },
    [onClose],
  );

  const label = type === "scheduled" ? "Scheduled" : "Deadline";
  const Icon = type === "scheduled" ? IconCalendar : IconAlarm;
  const displayLabel = formatTriggerLabel(value);

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      withinPortal
      shadow="md"
      trapFocus
    >
      <Popover.Target>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpened((o) => !o);
          }}
          style={{
            ...styles.trigger,
            ...(opened ? styles.triggerFocused : {}),
          }}
          aria-label={`${label}: ${displayLabel || "not set"}. Click to ${opened ? "close" : "open"} calendar.`}
          aria-expanded={opened}
          aria-haspopup="dialog"
        >
          <Icon size={12} stroke={1.5} />
          {displayLabel || `Set ${label}`}
        </button>
      </Popover.Target>

      <Popover.Dropdown style={styles.dropdown}>
        <div onKeyDown={handleKeyDown} aria-label={`${label} date picker`}>
          <DatePicker
            value={selectedDate}
            onChange={handleSelectDate}
            size="sm"
            styles={{
              calendarHeader: {
                marginBottom: "var(--spacing-xs)",
              },
              calendarHeaderLevel: {
                fontSize: "var(--font-size-sm)",
                fontWeight: 600,
                color: "var(--color-text-primary)",
              },
              calendarHeaderControl: {
                color: "var(--color-text-secondary)",
                backgroundColor: "transparent",
                "&:hover": {
                  backgroundColor: "var(--color-interactive-hover)",
                  color: "var(--color-text-primary)",
                },
              },
              month: {
                padding: 0,
              },
              weekday: {
                fontSize: "var(--font-size-xs)",
                fontWeight: 500,
                color: "var(--color-text-tertiary)",
                textTransform: "uppercase",
              },
              day: {
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-primary)",
                borderRadius: "var(--radius-md)",
                "&:hover": {
                  backgroundColor: "var(--color-interactive-hover)",
                },
              },
              monthCell: {
                padding: "2px",
              },
            }}
          />

          {value && (
            <div style={styles.footer}>
              <button
                type="button"
                style={styles.clearButton}
                onClick={handleClear}
                aria-label={`Clear ${label.toLowerCase()} date`}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--color-text-secondary)";
                  e.currentTarget.style.backgroundColor =
                    "var(--color-interactive-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--color-text-tertiary)";
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                Clear date
              </button>
            </div>
          )}
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
