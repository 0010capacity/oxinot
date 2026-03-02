import { Box, Text } from "@mantine/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { useClockFormatStore } from "../../stores/clockFormatStore";
import { useTodoStore } from "../../stores/todoStore";
import { CalendarPopover } from "../calendar/CalendarPopover";

export function Clock() {
  const [time, setTime] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const calendarTriggerRef = useRef<HTMLDivElement>(null);

  // Get the formatter functions
  const formatTime = useClockFormatStore((state) => state.formatTime);
  const formatDate = useClockFormatStore((state) => state.formatDate);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime(formatTime(now));
      setDate(formatDate(now));
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);

    return () => clearInterval(interval);
  }, [formatTime, formatDate]);

  // Fetch todos when calendar opens
  const todos = useTodoStore((state) => state.todos);
  const fetchTodos = useTodoStore((state) => state.fetchTodos);

  useEffect(() => {
    if (isCalendarOpen) {
      fetchTodos({});
    }
  }, [isCalendarOpen, fetchTodos]);

  // Calculate today's active todo count (includes unscheduled)
  const todayTodoCount = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return todos.filter(
      (t) =>
        t.status !== "done" &&
        t.status !== "canceled" &&
        (t.scheduled === today ||
          t.deadline === today ||
          (!t.scheduled && !t.deadline)),
    ).length;
  }, [todos]);

  return (
    <>
      <Box
        ref={calendarTriggerRef}
        onClick={() => setIsCalendarOpen(!isCalendarOpen)}
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "6px",
          cursor: "pointer",
          padding: "4px 6px",
          borderRadius: "4px",
          transition: "background-color 0.2s ease",
          backgroundColor: isCalendarOpen
            ? "var(--color-interactive-active)"
            : "transparent",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor =
            "var(--color-interactive-hover)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = isCalendarOpen
            ? "var(--color-interactive-active)"
            : "transparent";
        }}
      >
        {/* Today's todo count badge */}
        {todayTodoCount > 0 && (
          <Box
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "16px",
              height: "16px",
              borderRadius: "50%",
              backgroundColor: "var(--color-accent)",
              padding: "0 4px",
            }}
          >
            <Text
              size="xs"
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "white",
                lineHeight: 1,
              }}
            >
              {todayTodoCount}
            </Text>
          </Box>
        )}
        <Text
          size="xs"
          fw={500}
          style={{
            color: "var(--color-text-secondary)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {date || "00/00"}
        </Text>
        <Text
          size="xs"
          c="dimmed"
          style={{
            fontVariantNumeric: "tabular-nums",
          }}
        >
          |
        </Text>
        <Text
          size="xs"
          fw={500}
          style={{
            color: "var(--color-text-secondary)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {time || "00:00"}
        </Text>
      </Box>

      <CalendarPopover
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        triggerRef={calendarTriggerRef}
      />
    </>
  );
}
