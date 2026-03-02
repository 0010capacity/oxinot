import type { TodoResult } from "@/types/todo";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday as isDateToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import type { CSSProperties } from "react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { enUS, ko } from "date-fns/locale";

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
const CELL = 28;
const GAP = 2;
// Total grid width: 7 cells + 6 gaps
export const GRID_W = 7 * CELL + 6 * GAP; // 208px

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
  marginBottom: 4,
};

const headerLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--color-text-primary)",
  cursor: "default",
  letterSpacing: "0.01em",
};

const navButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 20,
  height: 20,
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
  fontSize: 8,
  fontWeight: 700,
  color: "var(--color-text-tertiary)",
  textTransform: "uppercase",
  textAlign: "center",
  width: CELL,
  height: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
  letterSpacing: "0.05em",
};

const dayCellBase: CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: CELL,
  height: CELL,
  borderRadius: "var(--radius-sm)",
  border: "none",
  backgroundColor: "transparent",
  cursor: "pointer",
  fontSize: 11,
  fontFamily: "var(--font-family)",
  lineHeight: 1,
  padding: 0,
  transition:
    "background-color var(--transition-fast), color var(--transition-fast)",
};

const badgeStyle: CSSProperties = {
  position: "absolute",
  top: 2,
  right: 2,
  minWidth: 10,
  height: 10,
  padding: "0 2px",
  borderRadius: "var(--radius-lg)",
  backgroundColor: "var(--color-accent)",
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

  const style: CSSProperties = {
    ...dayCellBase,
    color: isSelected
      ? "#fff"
      : !isCurrentMonth
        ? "var(--color-text-tertiary)"
        : isToday
          ? "var(--color-accent)"
          : "var(--color-text-primary)",
    backgroundColor: isSelected ? "var(--color-accent)" : "transparent",
    fontWeight: isSelected ? 700 : isToday ? 600 : 400,
    outline:
      isToday && !isSelected ? "1.5px solid var(--color-accent)" : "none",
    outlineOffset: -1,
    opacity: !isCurrentMonth ? 0.35 : 1,
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
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = "transparent";
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

      <table
        style={{ borderCollapse: "collapse", width: GRID_W }}
        aria-label={monthLabel}
      >
        <thead>
          <tr>
            {getWeekdayNames(i18n.language).map((day) => (
              <th key={day} style={{ ...weekdayStyle, padding: 0 }} scope="col">
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(() => {
            const rows = [];
            for (let i = 0; i < calendarDays.length; i += 7) {
              rows.push(
                <tr key={`week-${i}`}>
                  {calendarDays.slice(i, i + 7).map((day) => {
                    const key = toISODateKey(day);
                    const todoCount = todosByDate[key]?.length ?? 0;
                    const isSelected = selectedDate
                      ? isSameDay(day, selectedDate)
                      : false;

                    return (
                      <td key={key} style={{ padding: 0, textAlign: "center" }}>
                        <DayCell
                          date={day}
                          isCurrentMonth={isSameMonth(day, viewDate)}
                          isSelected={isSelected}
                          isToday={isDateToday(day)}
                          todoCount={todoCount}
                          onClick={handleDateClick}
                          onDoubleClick={handleDateDoubleClick}
                          language={i18n.language}
                        />
                      </td>
                    );
                  })}
                </tr>,
              );
            }
            return rows;
          })()}
        </tbody>
      </table>
    </div>
  );
}
