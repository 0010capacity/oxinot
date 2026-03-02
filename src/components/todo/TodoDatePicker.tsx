import { Popover } from "@mantine/core";
import { IconAlarm, IconCalendar } from "@tabler/icons-react";
import { format, isToday, parseISO } from "date-fns";
import type { CSSProperties } from "react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useBlockStore } from "../../stores/blockStore";
import { CalendarGrid } from "../calendar/CalendarGrid";

interface TodoDatePickerProps {
  blockId: string;
  type: "scheduled" | "deadline";
  value?: string | null;
  onClose?: () => void;
}

// ---------------------------------------------------------------------------
// Styles (CSS-variable only)
// ---------------------------------------------------------------------------

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
    backgroundColor: "var(--color-bg-elevated)",
    border: "1px solid var(--color-border-secondary)",
    borderRadius: "var(--radius-md)",
    width: "280px",
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTriggerLabel(
  value: string | null | undefined,
  todayLabel: string,
): string | null {
  if (!value) return null;
  try {
    const date = parseISO(value);
    if (isToday(date)) return todayLabel;
    return format(date, "d MMM");
  } catch {
    return value;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TodoDatePicker({
  blockId,
  type,
  value,
  onClose,
}: TodoDatePickerProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);

  const setBlockMetadata = useBlockStore((s) => s.setBlockMetadata);

  const selectedDate = useMemo(() => {
    if (!value) return undefined;
    try {
      return parseISO(value);
    } catch {
      return undefined;
    }
  }, [value]);

  const handleSelectDate = useCallback(
    async (date: Date) => {
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

  const label = t(
    `help.calendar_popover.${type === "scheduled" ? "scheduled" : "deadline"}`,
  );
  const Icon = type === "scheduled" ? IconCalendar : IconAlarm;
  const todayLabel = t("help.calendar_popover.today");
  const displayLabel = formatTriggerLabel(value, todayLabel);

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
          aria-label={t("help.calendar_popover.aria_label", {
            label,
            displayLabel:
              displayLabel || t("help.calendar_popover.set_label", { label }),
            action: opened
              ? t("help.calendar_popover.aria_action_close")
              : t("help.calendar_popover.aria_action_open"),
          })}
          aria-expanded={opened}
          aria-haspopup="dialog"
        >
          <Icon size={12} stroke={1.5} />
          {displayLabel || t("help.calendar_popover.set_label", { label })}
        </button>
      </Popover.Target>

      <Popover.Dropdown style={styles.dropdown}>
        <div
          onKeyDown={handleKeyDown}
          aria-label={t("help.calendar_popover.aria_dialog", { label })}
        >
          <CalendarGrid
            selectedDate={selectedDate}
            onDateSelect={handleSelectDate}
            showNavigation
          />

          {value && (
            <div style={styles.footer}>
              <button
                type="button"
                style={styles.clearButton}
                onClick={handleClear}
                aria-label={t("help.calendar_popover.aria_clear", {
                  label: label.toLowerCase(),
                })}
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
                {t("help.calendar_popover.clear_date")}
              </button>
            </div>
          )}
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
