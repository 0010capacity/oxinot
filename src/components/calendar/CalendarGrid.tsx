import type { TodoResult } from "@/types/todo";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isToday as isDateToday,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { enUS, ko } from "date-fns/locale";
import type { CSSProperties } from "react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

type TodosByDate = Record<string, TodoResult[]>;

interface CalendarGridProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  onDateDoubleClick?: (date: Date) => void;
  todosByDate?: TodosByDate;
  showNavigation?: boolean;
  defaultMonth?: Date;
}

// Cell size and gap — single source of truth
const CELL = 32;
const GAP = 4;
// Total grid width: 7 cells + 6 gaps
export const GRID_W = 7 * CELL + 6 * GAP; // 248px

function toISODateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: CSSProperties = {
  fontFamily: "var(--font-family)",
  color: "var(--color-text-primary)",
  userSelect: "none",
  width: GRID_W,
  flexShrink: 0,
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: GRID_W,
  marginBottom: 8,
};

const headerLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--color-text-primary)",
  cursor: "default",
  letterSpacing: "0.01em",
};

const navButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 24,
  border: "none",
  borderRadius: "var(--radius-sm)",
  backgroundColor: "transparent",
  color: "var(--color-text-tertiary)",
  cursor: "pointer",
  fontSize: 16,
  lineHeight: 1,
  padding: 0,
  transition:
    "background-color var(--transition-fast), color var(--transition-fast)",
  flexShrink: 0,
};

const weekdayStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  color: "var(--color-text-tertiary)",
  textAlign: "center",
  width: CELL,
  height: 20,
  lineHeight: "20px",
  letterSpacing: "0.02em",
  whiteSpace: "nowrap",
  opacity: 0.7,
};

const dayCellBase: CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: CELL,
  height: CELL,
  borderRadius: "var(--radius-md)",
  border: "none",
  backgroundColor: "transparent",
  cursor: "pointer",
  fontSize: 12,
  fontFamily: "var(--font-family)",
  lineHeight: 1,
  padding: 0,
  transition:
    "background-color var(--transition-fast), color var(--transition-fast), transform var(--transition-fast)",
};

const badgeStyle: CSSProperties = {
  position: "absolute",
  top: 2,
  right: 2,
  minWidth: 10,
  height: 10,
  padding: "0 2px",
  borderRadius: "var(--radius-lg)",
  backgroundColor: "var(--color-text-secondary)",
  color: "#fff",
  fontSize: 7,
  fontWeight: 700,
  lineHeight: "10px",
  textAlign: "center",
  pointerEvents: "none",
};

// ---------------------------------------------------------------------------
// DayCell
// ---------------------------------------------------------------------------

function DayCell({
  date,
  isCurrentMonth,
  isSelected,
  isToday,
  todoCount,
  onClick,
  onDoubleClick,
  language = "en",
}: {
  date: Date;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  todoCount: number;
  onClick: (date: Date) => void;
  onDoubleClick?: (date: Date) => void;
  language?: string;
}) {
  const handleClick = useCallback(() => onClick(date), [onClick, date]);
  const handleDoubleClick = useCallback(
    () => onDoubleClick?.(date),
    [onDoubleClick, date],
  );

  const todayBg =
    "color-mix(in srgb, var(--color-text-primary) 10%, transparent)";
  const todayBorder = "var(--color-text-secondary)";

  const style: CSSProperties = {
    ...dayCellBase,
    color: isSelected
      ? "var(--color-bg-primary)"
      : !isCurrentMonth
        ? "var(--color-text-tertiary)"
        : "var(--color-text-primary)",
    backgroundColor: isSelected ? "var(--color-text-primary)" : "transparent",
    fontWeight: isSelected || isToday ? 600 : 400,
    boxShadow:
      isToday && !isSelected ? `inset 0 0 0 1.5px ${todayBorder}` : "none",
    opacity: !isCurrentMonth ? 0.4 : 1,
  };

  return (
    <button
      type="button"
      style={style}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      aria-label={format(date, "EEEE, MMMM d, yyyy", {
        locale: language === "ko" ? ko : enUS,
      })}
      aria-pressed={isSelected}
      aria-current={isToday ? "date" : undefined}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor =
            "var(--color-interactive-hover)";
          e.currentTarget.style.transform = "scale(1.05)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = isToday
            ? todayBg
            : "transparent";
          e.currentTarget.style.transform = "scale(1)";
        }
      }}
    >
      {date.getDate()}
      {todoCount > 0 && (
        <span style={badgeStyle} aria-hidden="true">
          {todoCount > 9 ? "9+" : todoCount}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// CalendarGrid
// ---------------------------------------------------------------------------

function getWeekdayNames(language: string) {
  if (language === "ko") {
    return ["월", "화", "수", "목", "금", "토", "일"];
  }
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
}

export function CalendarGrid({
  selectedDate,
  onDateSelect,
  onDateDoubleClick,
  todosByDate = {},
  showNavigation = true,
  defaultMonth,
}: CalendarGridProps) {
  const { i18n } = useTranslation();
  const [viewDate, setViewDate] = useState<Date>(
    defaultMonth ?? selectedDate ?? new Date(),
  );

  const handlePrevMonth = useCallback(
    () => setViewDate((d) => subMonths(d, 1)),
    [],
  );
  const handleNextMonth = useCallback(
    () => setViewDate((d) => addMonths(d, 1)),
    [],
  );
  const handleDateClick = useCallback(
    (date: Date) => onDateSelect?.(date),
    [onDateSelect],
  );
  const handleDateDoubleClick = useCallback(
    (date: Date) => onDateDoubleClick?.(date),
    [onDateDoubleClick],
  );

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(viewDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [viewDate]);

  const monthLabel = format(viewDate, "MMMM yyyy", {
    locale: i18n.language === "ko" ? ko : enUS,
  });

  const gridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(7, ${CELL}px)`,
    gap: GAP,
  };

  return (
    <div style={containerStyle} aria-label="Calendar">
      {showNavigation && (
        <div style={headerStyle}>
          <button
            type="button"
            style={navButtonStyle}
            onClick={handlePrevMonth}
            aria-label="Previous month"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "var(--color-interactive-hover)";
              e.currentTarget.style.color = "var(--color-text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--color-text-tertiary)";
            }}
          >
            ‹
          </button>
          <span style={headerLabelStyle}>{monthLabel}</span>
          <button
            type="button"
            style={navButtonStyle}
            onClick={handleNextMonth}
            aria-label="Next month"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "var(--color-interactive-hover)";
              e.currentTarget.style.color = "var(--color-text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--color-text-tertiary)";
            }}
          >
            ›
          </button>
        </div>
      )}

      {/* Weekday headers */}
      <div style={{ ...gridStyle, marginBottom: 4 }}>
        {getWeekdayNames(i18n.language).map((day) => (
          <div key={day} style={weekdayStyle}>
            {day}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div style={gridStyle} aria-label={monthLabel}>
        {calendarDays.map((day) => {
          const key = toISODateKey(day);
          const todoCount = todosByDate[key]?.length ?? 0;
          const isSelected = selectedDate
            ? isSameDay(day, selectedDate)
            : false;

          return (
            <DayCell
              key={key}
              date={day}
              isCurrentMonth={isSameMonth(day, viewDate)}
              isSelected={isSelected}
              isToday={isDateToday(day)}
              todoCount={todoCount}
              onClick={handleDateClick}
              onDoubleClick={handleDateDoubleClick}
              language={i18n.language}
            />
          );
        })}
      </div>
    </div>
  );
}
