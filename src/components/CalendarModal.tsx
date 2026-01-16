import { Box, Button, Group, Modal, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { usePageStore } from "../stores/pageStore";
import { useViewStore } from "../stores/viewStore";

interface CalendarModalProps {
  opened: boolean;
  onClose: () => void;
}

export function CalendarModal({ opened, onClose }: CalendarModalProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const pagesById = usePageStore((state) => state.pagesById);
  const pageIds = usePageStore((state) => state.pageIds);
  const createPage = usePageStore((state) => state.createPage);
  const setCurrentPageId = usePageStore((state) => state.setCurrentPageId);
  const showPage = useViewStore((state) => state.showPage);

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const formatDateForPage = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getDailyNotePage = (date: Date) => {
    const dateStr = formatDateForPage(date);
    const pageId = pageIds.find((id) => pagesById[id]?.title === dateStr);
    return pageId ? pagesById[pageId] : undefined;
  };

  const handleDayClick = async (day: number) => {
    const selectedDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      day,
    );
    const dateStr = formatDateForPage(selectedDate);

    // Check if page already exists
    const page = getDailyNotePage(selectedDate);

    if (!page) {
      // Create new daily note page
      try {
        const newPageId = await createPage(dateStr, undefined);
        setCurrentPageId(newPageId);
        showPage(newPageId);
      } catch (error) {
        console.error("Failed to create daily note:", error);
      }
    } else {
      // Open existing page
      setCurrentPageId(page.id);
      showPage(page.id);
    }

    onClose();
  };

  const handlePrevMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
    );
  };

  const handleNextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
    );
  };

  const handleToday = () => {
    handleDayClick(new Date().getDate());
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <Box
          key={`empty-${i}`}
          style={{
            aspectRatio: "1",
            padding: "8px",
          }}
        />,
      );
    }

    // Calendar days
    const today = new Date();
    const isCurrentMonth =
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        day,
      );
      const isToday = isCurrentMonth && day === today.getDate();
      const hasNote = !!getDailyNotePage(date);

      days.push(
        <Box
          key={day}
          onClick={() => handleDayClick(day)}
          style={{
            aspectRatio: "1",
            padding: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            borderRadius: "6px",
            border: isToday
              ? "2px solid var(--color-accent)"
              : "2px solid transparent",
            backgroundColor: hasNote
              ? "var(--color-interactive-selected)"
              : "transparent",
            transition: "all 0.15s ease",
            fontWeight: hasNote ? 600 : 400,
            color: "var(--color-text-secondary)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-interactive-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = hasNote
              ? "var(--color-interactive-selected)"
              : "transparent";
          }}
        >
          <Text size="sm">{day}</Text>
        </Box>,
      );
    }

    return days;
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Daily Notes"
      size="lg"
      styles={{
        title: {
          fontSize: "1.1rem",
          fontWeight: 600,
        },
      }}
    >
      <Stack gap="lg">
        {/* Month Navigation */}
        <Group justify="space-between">
          <Button variant="subtle" size="sm" onClick={handlePrevMonth}>
            ← Prev
          </Button>
          <Text size="lg" fw={600}>
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </Text>
          <Button variant="subtle" size="sm" onClick={handleNextMonth}>
            Next →
          </Button>
        </Group>

        {/* Today Button */}
        <Button onClick={handleToday} fullWidth variant="light">
          Go to Today
        </Button>

        {/* Day Labels */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "4px",
            marginBottom: "-8px",
          }}
        >
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <Text
              key={day}
              size="xs"
              fw={600}
              ta="center"
              c="dimmed"
              style={{ padding: "8px 0" }}
            >
              {day}
            </Text>
          ))}
        </div>

        {/* Calendar Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "4px",
          }}
        >
          {renderCalendar()}
        </div>

        {/* Legend */}
        <Box
          style={{
            marginTop: "8px",
            padding: "12px",
            borderRadius: "6px",
            backgroundColor: "var(--color-bg-secondary)",
          }}
        >
          <Stack gap="xs">
            <Group gap="xs">
              <Box
                style={{
                  width: "16px",
                  height: "16px",
                  borderRadius: "4px",
                  border: "2px solid var(--color-accent)",
                }}
              />
              <Text size="xs" c="dimmed">
                Today
              </Text>
            </Group>
            <Group gap="xs">
              <Box
                style={{
                  width: "16px",
                  height: "16px",
                  borderRadius: "4px",
                  backgroundColor: "var(--color-interactive-selected)",
                }}
              />
              <Text size="xs" c="dimmed">
                Has note
              </Text>
            </Group>
          </Stack>
        </Box>
      </Stack>
    </Modal>
  );
}
