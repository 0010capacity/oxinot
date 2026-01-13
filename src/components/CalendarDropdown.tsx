import { Stack, Text, Box, Button, ActionIcon } from "@mantine/core";
import { useMantineColorScheme } from "@mantine/core";
import { useState } from "react";
import { usePageStore } from "../stores/pageStore";
import { useViewStore } from "../stores/viewStore";
import { useAppSettingsStore } from "../stores/appSettingsStore";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

interface CalendarDropdownProps {
  onClose: () => void;
}

export function CalendarDropdown({ onClose }: CalendarDropdownProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";
  const [currentDate, setCurrentDate] = useState(new Date());
  const pagesById = usePageStore((state) => state.pagesById);
  const pageIds = usePageStore((state) => state.pageIds);
  const createPage = usePageStore((state) => state.createPage);
  const setCurrentPageId = usePageStore((state) => state.setCurrentPageId);
  const loadPages = usePageStore((state) => state.loadPages);
  const openNote = useViewStore((state) => state.openNote);
  const getDailyNotePath = useAppSettingsStore(
    (state) => state.getDailyNotePath,
  );

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

  const getFullDailyNotePath = (date: Date) => {
    return getDailyNotePath(date);
  };

  const getDailyNotePage = (date: Date) => {
    const fullPath = getFullDailyNotePath(date);

    const getPageIdByPath = (path: string): string | undefined => {
      return pageIds.find((id) => {
        const page = pagesById[id];
        if (!page) return false;
        const buildPath = (pageId: string): string => {
          const p = pagesById[pageId];
          if (!p) return "";
          if (p.parentId) {
            const parentPath = buildPath(p.parentId);
            return parentPath ? `${parentPath}/${p.title}` : p.title;
          }
          return p.title;
        };
        return buildPath(id) === path;
      });
    };

    const pageId = getPageIdByPath(fullPath);
    return pageId ? pagesById[pageId] : undefined;
  };

  const handleDayClick = async (day: number) => {
    const selectedDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      day,
    );
    const fullPath = getFullDailyNotePath(selectedDate);

    // Check if page already exists
    const page = getDailyNotePage(selectedDate);

    if (!page) {
      // Create new daily note page with full path
      try {
        // Split path and create nested structure
        const pathParts = fullPath.split("/");
        let parentId: string | undefined = undefined;

        // Create parent pages if they don't exist
        for (let i = 0; i < pathParts.length; i++) {
          const currentPath = pathParts.slice(0, i + 1).join("/");

          // Find existing page at this path level
          const existingPage = pageIds.find((id) => {
            const p = pagesById[id];
            if (!p) return false;

            const buildPath = (pageId: string): string => {
              const page = pagesById[pageId];
              if (!page) return "";
              if (page.parentId) {
                const parentPath = buildPath(page.parentId);
                return parentPath ? `${parentPath}/${page.title}` : page.title;
              }
              return page.title;
            };

            return buildPath(id) === currentPath;
          });

          if (existingPage) {
            parentId = existingPage;
          } else {
            const newPageId = await createPage(pathParts[i], parentId);
            parentId = newPageId;
          }
        }

        // Reload pages to ensure breadcrumb updates correctly
        await loadPages();

        // Get fresh store state after reload
        const freshPagesById = usePageStore.getState().pagesById;
        const freshPageIds = usePageStore.getState().pageIds;

        // Find the created page after reload using the full path
        const createdPageId = freshPageIds.find((id) => {
          const p = freshPagesById[id];
          if (!p) return false;

          const buildPath = (pageId: string): string => {
            const page = freshPagesById[pageId];
            if (!page) return "";
            if (page.parentId) {
              const parentPath = buildPath(page.parentId);
              return parentPath ? `${parentPath}/${page.title}` : page.title;
            }
            return page.title;
          };

          return buildPath(id) === fullPath;
        });

        if (createdPageId) {
          const createdPage = freshPagesById[createdPageId];

          // Build parent names array for breadcrumb
          const parentNames: string[] = [];
          const pagePathIds: string[] = [];

          const buildParentPath = (pageId: string) => {
            const page = freshPagesById[pageId];
            if (!page) return;

            if (page.parentId) {
              buildParentPath(page.parentId);
              const parentPage = freshPagesById[page.parentId];
              if (parentPage) {
                parentNames.push(parentPage.title);
                pagePathIds.push(page.parentId);
              }
            }
          };

          buildParentPath(createdPageId);
          pagePathIds.push(createdPageId);

          setCurrentPageId(createdPageId);
          openNote(createdPageId, createdPage.title, parentNames, pagePathIds);
        }
      } catch (error) {
        console.error("Failed to create daily note:", error);
      }
    } else {
      // Open existing page
      const parentNames: string[] = [];
      const pagePathIds: string[] = [];

      const buildParentPath = (pageId: string) => {
        const p = pagesById[pageId];
        if (!p) return;

        if (p.parentId) {
          buildParentPath(p.parentId);
          const parentPage = pagesById[p.parentId];
          if (parentPage) {
            parentNames.push(parentPage.title);
            pagePathIds.push(p.parentId);
          }
        }
      };

      buildParentPath(page.id);
      pagePathIds.push(page.id);

      setCurrentPageId(page.id);
      openNote(page.id, page.title, parentNames, pagePathIds);
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
    const today = new Date();
    setCurrentDate(today);
    handleDayClick(today.getDate());
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
            padding: "6px",
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
            padding: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            borderRadius: "4px",
            border: isToday
              ? `2px solid ${isDark ? "#4dabf7" : "#228be6"}`
              : "2px solid transparent",
            backgroundColor: hasNote
              ? isDark
                ? "rgba(74, 171, 247, 0.15)"
                : "rgba(34, 139, 230, 0.1)"
              : "transparent",
            transition: "all 0.15s ease",
            fontWeight: hasNote ? 600 : 400,
            color: isDark ? "#c1c2c5" : "#495057",
            fontSize: "13px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = isDark
              ? "rgba(255, 255, 255, 0.08)"
              : "rgba(0, 0, 0, 0.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = hasNote
              ? isDark
                ? "rgba(74, 171, 247, 0.15)"
                : "rgba(34, 139, 230, 0.1)"
              : "transparent";
          }}
        >
          <Text size="xs" style={{ fontSize: "13px" }}>
            {day}
          </Text>
        </Box>,
      );
    }

    return days;
  };

  return (
    <Stack gap="md" style={{ width: "280px" }}>
      {/* Month Navigation */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <ActionIcon variant="subtle" size="sm" onClick={handlePrevMonth}>
          <IconChevronLeft size={16} />
        </ActionIcon>
        <Text size="sm" fw={600} ta="center" style={{ flex: 1 }}>
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </Text>
        <ActionIcon variant="subtle" size="sm" onClick={handleNextMonth}>
          <IconChevronRight size={16} />
        </ActionIcon>
      </div>

      {/* Day Labels */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "4px",
          marginBottom: "-4px",
        }}
      >
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <Text
            key={day}
            size="xs"
            fw={600}
            ta="center"
            c="dimmed"
            style={{ padding: "4px 0", fontSize: "11px" }}
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

      {/* Today Button */}
      <Button onClick={handleToday} fullWidth variant="light" size="sm">
        Today
      </Button>
    </Stack>
  );
}
