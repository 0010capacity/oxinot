import { Box, Popover, Text, useComputedColorScheme } from "@mantine/core";
import { useEffect, useState } from "react";
import { useClockFormatStore } from "../../stores/clockFormatStore";
import { CalendarDropdown } from "../CalendarDropdown";

export function Clock() {
  const computedColorScheme = useComputedColorScheme("light");
  const isDark = computedColorScheme === "dark";
  const [time, setTime] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [opened, setOpened] = useState(false);

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

  const handleClose = () => {
    setOpened(false);
  };

  return (
    <Popover
      position="bottom-end"
      withArrow={false}
      offset={0}
      opened={opened}
      onChange={setOpened}
    >
      <Popover.Target>
        <Box
          onClick={() => setOpened(!opened)}
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: "6px",
            cursor: "pointer",
            padding: "4px 6px",
            borderRadius: "4px",
            transition: "background-color 0.2s ease",
            backgroundColor: opened
              ? isDark
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(0, 0, 0, 0.05)"
              : "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = isDark
              ? "rgba(255, 255, 255, 0.08)"
              : "rgba(0, 0, 0, 0.03)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = opened
              ? isDark
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(0, 0, 0, 0.05)"
              : "transparent";
          }}
        >
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
      </Popover.Target>

      <Popover.Dropdown
        style={{
          padding: "16px",
          borderRadius: "12px",
          backgroundColor: isDark ? "#1a1b1e" : "#ffffff",
          border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
          boxShadow: isDark
            ? "0 8px 24px rgba(0, 0, 0, 0.4)"
            : "0 8px 24px rgba(0, 0, 0, 0.12)",
        }}
      >
        <CalendarDropdown onClose={handleClose} />
      </Popover.Dropdown>
    </Popover>
  );
}
