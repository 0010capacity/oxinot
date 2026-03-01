import type { TodoResult } from "@/types/todo";
import { DatePicker } from "@mantine/dates";
import { format, isToday as isDateToday, isSameDay } from "date-fns";
import { useCallback, useMemo, useState } from "react";
import type { CSSProperties } from "react";

type TodosByDate = Record<string, TodoResult[]>;

interface CalendarGridProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  todosByDate?: TodosByDate;
  showNavigation?: boolean;
  defaultMonth?: Date;
}

const styles = {
  container: {
    fontFamily: "var(--font-family)",
    fontSize: "var(--font-size-sm)",
    color: "var(--color-text-primary)",
    userSelect: "none",
  } satisfies CSSProperties,

  badge: {
    position: "absolute",
    top: "2px",
    right: "2px",
    minWidth: "14px",
    height: "14px",
    padding: "0 3px",
    borderRadius: "var(--radius-lg)",
    backgroundColor: "var(--color-success)",
    color: "var(--color-bg-primary)",
    fontSize: "9px",
    fontWeight: 700,
    lineHeight: "14px",
    textAlign: "center",
    pointerEvents: "none",
  } satisfies CSSProperties,
};

function toISODateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function CalendarGrid({
  selectedDate,
  onDateSelect,
  todosByDate = {},
  showNavigation = true,
  defaultMonth,
}: CalendarGridProps) {
  const [viewDate, setViewDate] = useState<Date>(
    defaultMonth ?? selectedDate ?? new Date(),
  );

  const handleDateChange = useCallback(
    (date: Date | null) => {
      if (date && onDateSelect) {
        onDateSelect(date);
      }
    },
    [onDateSelect],
  );

  const calendarStyles = useMemo(
    () => ({
      calendarHeader: {
        display: showNavigation ? "flex" : "none",
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
        textTransform: "uppercase" as const,
      },
      day: {
        fontSize: "var(--font-size-sm)",
        color: "var(--color-text-primary)",
        borderRadius: "var(--radius-md)",
        position: "relative" as const,
        "&:hover": {
          backgroundColor: "var(--color-interactive-hover)",
        },
      },
      monthCell: {
        padding: "2px",
      },
    }),
    [showNavigation],
  );

  const renderDay = useCallback(
    (date: Date) => {
      const dateKey = toISODateKey(date);
      const todos = todosByDate[dateKey];
      const todoCount = todos?.length ?? 0;
      const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
      const isToday = isDateToday(date);

      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <span
            style={{
              fontWeight: isSelected ? 600 : isToday ? 700 : 400,
            }}
          >
            {date.getDate()}
          </span>
          {todoCount > 0 && (
            <span style={styles.badge} aria-hidden="true">
              {todoCount > 99 ? "99+" : todoCount}
            </span>
          )}
        </div>
      );
    },
    [todosByDate, selectedDate],
  );

  return (
    <div style={styles.container} aria-label="Calendar">
      <DatePicker
        value={selectedDate ?? null}
        onChange={handleDateChange}
        date={viewDate}
        onDateChange={setViewDate}
        size="sm"
        renderDay={renderDay}
        styles={calendarStyles}
      />
    </div>
  );
}
