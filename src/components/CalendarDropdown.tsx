import { ActionIcon, Box, Stack, Text } from "@mantine/core";
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconPlus,
  IconRepeat,
} from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useAppSettingsStore } from "../stores/appSettingsStore";
import type { BlockData } from "../stores/blockStore";
import { useBlockUIStore } from "../stores/blockUIStore";
import { usePageStore } from "../stores/pageStore";
import { useTodoStore } from "../stores/todoStore";
import { useViewStore } from "../stores/viewStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import type { TodoResult, TodoStatus } from "../types/todo";
import {
  STATUS_TO_PREFIX,
  type RepeatFrequency,
  extractStatusPrefix,
} from "../types/todo";
import { buildPageBreadcrumb } from "../utils/pageUtils";

interface CalendarDropdownProps {
  onClose: () => void;
}

// Status icon configuration
const STATUS_CONFIG: Record<TodoStatus, { color: string }> = {
  todo: { color: "var(--color-text-tertiary)" },
  doing: { color: "var(--color-accent)" },
  done: { color: "var(--color-success)" },
  later: { color: "var(--color-warning)" },
  canceled: { color: "var(--color-error)" },
};

// Todo item component
const TodoItem = memo(function TodoItem({
  todo,
  onClick,
  onStatusToggle,
  isUpdating,
}: {
  todo: TodoResult;
  onClick: () => void;
  onStatusToggle: () => void;
  isUpdating: boolean;
}) {
  const config = STATUS_CONFIG[todo.status];
  const extracted = extractStatusPrefix(todo.content);
  const displayContent = extracted ? extracted.rest : todo.content;

  return (
    <Box
      onClick={onClick}
      style={{
        padding: "6px 8px",
        borderRadius: "var(--radius-sm)",
        cursor: "pointer",
        transition: "background-color var(--transition-fast)",
        display: "flex",
        alignItems: "flex-start",
        gap: "8px",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor =
          "var(--color-interactive-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onStatusToggle();
        }}
        disabled={isUpdating}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          marginTop: "2px",
          cursor: isUpdating ? "wait" : "pointer",
          display: "flex",
          alignItems: "center",
          opacity: isUpdating ? 0.5 : 1,
        }}
      >
        <Box
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            border: `2px solid ${config.color}`,
            backgroundColor:
              todo.status === "done" ? config.color : "transparent",
          }}
        />
      </button>
      <Box style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        <Text
          size="xs"
          style={{
            color: "var(--color-text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textDecoration: todo.status === "done" ? "line-through" : "none",
            opacity: todo.status === "done" ? 0.5 : 1,
            lineHeight: 1.4,
          }}
        >
          {displayContent}
        </Text>
      </Box>
    </Box>
  );
});

export function CalendarDropdown({ onClose }: CalendarDropdownProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [quickAddValue, setQuickAddValue] = useState("");
  const [quickAddTime, setQuickAddTime] = useState("");
  const [quickAddRepeat, setQuickAddRepeat] = useState<RepeatFrequency | "">("");
  const [quickAddNoDate, setQuickAddNoDate] = useState(false);
  const [updatingBlockId, setUpdatingBlockId] = useState<string | null>(null);

  // Stores
  const pagesById = usePageStore((state) => state.pagesById);
  const pageIds = usePageStore((state) => state.pageIds);
  const setCurrentPageId = usePageStore((state) => state.setCurrentPageId);
  const openPageByPath = usePageStore((state) => state.openPageByPath);
  const createPage = usePageStore((state) => state.createPage);
  const openNote = useViewStore((state) => state.openNote);
  const getDailyNotePath = useAppSettingsStore(
    (state) => state.getDailyNotePath,
  );
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);

  // TODO store
  // TODO store
  const todos = useTodoStore((state) => state.todos);
  const fetchTodos = useTodoStore((state) => state.fetchTodos);
  const cycleTodoStatus = useTodoStore((state) => state.cycleTodoStatus);

  // Block UI store
  const zoomToBlock = useViewStore((state) => state.zoomToBlock);
  const setFocusedBlock = useBlockUIStore((state) => state.setFocusedBlock);

  // Fetch todos on mount
  useEffect(() => {
    fetchTodos({});
  }, [fetchTodos]);

  // Pre-calculate page paths for O(1) lookup
  const pagePathMap = useMemo(() => {
    const map = new Map<string, string>();
    const buildPath = (pageId: string): string => {
      const page = pagesById[pageId];
      if (!page) return "";
      if (page.parentId) {
        const parentPath = buildPath(page.parentId);
        return parentPath ? `${parentPath}/${page.title}` : page.title;
      }
      return page.title;
    };

    for (const id of pageIds) {
      const path = buildPath(id);
      if (path) {
        map.set(path, id);
      }
    }
    return map;
  }, [pagesById, pageIds]);

// Group todos by date for efficient lookup
const todosByDate = useMemo(() => {
const map = new Map<string, TodoResult[]>();
for (const todo of todos) {
if (todo.scheduled) {
const existing = map.get(todo.scheduled) || [];
map.set(todo.scheduled, [...existing, todo]);
}
if (todo.deadline && todo.deadline !== todo.scheduled) {
const existing = map.get(todo.deadline) || [];
map.set(todo.deadline, [...existing, todo]);
}
}
return map;
  }, [todos]);

  // Track todos without scheduled date (for "today" display)
  const unscheduledTodos = useMemo(() => {
    return todos.filter(
      (t) => !t.scheduled && !t.deadline && t.status !== "done" && t.status !== "canceled",
    );
  }, [todos]);

  // Get todos for a specific date
  const getTodosForDate = useCallback(
    (date: Date): TodoResult[] => {
      const dateStr = date.toISOString().split("T")[0];
      const today = new Date().toISOString().split("T")[0];
      const dateTodos = todosByDate.get(dateStr) || [];
      
      // Include unscheduled todos for today
      if (dateStr === today) {
        return [...dateTodos, ...unscheduledTodos];
      }
      
      return dateTodos;
    },
    [todosByDate, unscheduledTodos],
  );

  // Selected date todos
  const selectedDateTodos = useMemo(
    () => getTodosForDate(selectedDate),
    [selectedDate, getTodosForDate],
  );

  // Check if a date has overdue todos
  const hasOverdueTodos = useCallback(
    (date: Date): boolean => {
      const dateStr = date.toISOString().split("T")[0];
      const todosForDate = todosByDate.get(dateStr) || [];
      return todosForDate.some(
        (t) =>
          t.deadline === dateStr &&
          t.status !== "done" &&
          t.status !== "canceled",
      );
    },
    [todosByDate],
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
    const pageId = pagePathMap.get(fullPath);
    return pageId ? pagesById[pageId] : undefined;
  };

  // Format selected date for display
  const formatSelectedDate = (date: Date): string => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const dateStr = date.toISOString().split("T")[0];

    if (dateStr === todayStr) {
      return "Today";
    }

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateStr === tomorrow.toISOString().split("T")[0]) {
      return "Tomorrow";
    }

    return `${monthNames[date.getMonth()]} ${date.getDate()}`;
  };

  // Handle day selection (not opening daily note)
  const handleDayClick = (day: number) => {
    const newDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
    );
    setSelectedDate(newDate);
  };

  // Handle opening daily note
  const handleOpenDailyNote = async () => {
    const fullPath = getFullDailyNotePath(selectedDate);

    try {
      const pageId = await openPageByPath(fullPath);
      const freshPagesById = usePageStore.getState().pagesById;
      const page = freshPagesById[pageId];

      if (!page) {
        throw new Error("Page not found after opening");
      }

      const { names, ids } = buildPageBreadcrumb(pageId, freshPagesById);
      setCurrentPageId(pageId);
      openNote(pageId, page.title, names, ids);
    } catch (error) {
      console.error("[CalendarDropdown] Failed to open daily note:", error);
    }

    onClose();
  };

  // Handle todo click
  const handleTodoClick = useCallback(
    async (todo: TodoResult) => {
      const currentPageId = usePageStore.getState().currentPageId;
      if (todo.pageId !== currentPageId) {
        await usePageStore.getState().openPageById(todo.pageId);
      }

      setTimeout(() => {
        zoomToBlock(todo.blockId);
        setFocusedBlock(todo.blockId);
      }, 100);

      onClose();
    },
    [zoomToBlock, setFocusedBlock, onClose],
  );

  // Handle status toggle
  const handleStatusToggle = useCallback(
    async (blockId: string) => {
      setUpdatingBlockId(blockId);
      try {
        await cycleTodoStatus(blockId);
        await fetchTodos({});
      } finally {
        setUpdatingBlockId(null);
      }
    },
    [cycleTodoStatus, fetchTodos],
  );

  // Handle quick add
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedValue = quickAddValue.trim();
    if (!trimmedValue || !workspacePath) return;

    try {
      // Get the daily note path for selected date
      const dailyNotePath = getFullDailyNotePath(selectedDate);
      const dateStr = selectedDate.toISOString().split("T")[0];

      // Get or create the daily note page
      const dailyNotePageId = await openPageByPath(dailyNotePath);

      // Create a child page for the task
      const taskTitle = `Task-${Date.now()}`;
      const taskPageId = await createPage(taskTitle, dailyNotePageId);

      // Create the TODO block in the child page
      const fullContent = STATUS_TO_PREFIX.todo + trimmedValue;
      const newBlock: BlockData = await invoke("create_block", {
        workspacePath,
        request: {
          pageId: taskPageId,
          parentId: null,
          afterBlockId: null,
          content: fullContent,
        },
      });

      // Build metadata
      const metadata: Record<string, string> = {
        todoStatus: "todo",
      };

      // Add scheduled date (unless "no date" is checked)
      if (!quickAddNoDate) {
        metadata.scheduled = dateStr;
        if (quickAddTime) {
          metadata.scheduledTime = quickAddTime;
        }
      }

      // Add repeat config if set
      if (quickAddRepeat) {
        metadata.repeat = JSON.stringify({ frequency: quickAddRepeat });
      }

      // Set metadata via update_block
      await invoke<BlockData>("update_block", {
        workspacePath,
        request: {
          id: newBlock.id,
          metadata,
        },
      });

      // Reset form
      setQuickAddValue("");
      setQuickAddTime("");
      setQuickAddRepeat("");
      setQuickAddNoDate(false);
      await fetchTodos({});
    } catch (error) {
      console.error("[CalendarDropdown] Failed to create todo:", error);
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1),
    );
  };

  const handleNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
    );
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
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
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear();

    const selectedDateStr = selectedDate.toISOString().split("T")[0];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        day,
      );
      const dateStr = date.toISOString().split("T")[0];
      const isToday = isCurrentMonth && day === today.getDate();
      const isSelected = dateStr === selectedDateStr;
      const hasNote = !!getDailyNotePage(date);
      const todosForDay = getTodosForDate(date);
      const hasOverdue = hasOverdueTodos(date);
      const todoCount = todosForDay.length;

      days.push(
        <Box
          key={day}
          onClick={() => handleDayClick(day)}
          style={{
            aspectRatio: "1",
            padding: "6px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            borderRadius: "4px",
            border: isToday
              ? "2px solid var(--color-accent)"
              : "2px solid transparent",
            backgroundColor: isSelected
              ? "var(--color-accent)"
              : hasNote
                ? "var(--color-interactive-selected)"
                : "transparent",
            transition: "all 0.15s ease",
            fontWeight: hasNote || isSelected ? 600 : 400,
            color: isSelected ? "white" : "var(--color-text-secondary)",
            fontSize: "13px",
            gap: "2px",
          }}
          onMouseEnter={(e) => {
            if (!isSelected) {
              e.currentTarget.style.backgroundColor =
                "var(--color-interactive-hover)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isSelected) {
              e.currentTarget.style.backgroundColor = hasNote
                ? "var(--color-interactive-selected)"
                : "transparent";
            }
          }}
        >
          <Text size="xs" style={{ fontSize: "13px" }}>
            {day}
          </Text>
          {todoCount > 0 && (
            <Box
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "14px",
                height: "14px",
                borderRadius: "50%",
                backgroundColor: isSelected
                  ? "rgba(255,255,255,0.3)"
                  : hasOverdue
                    ? "var(--color-error)"
                    : "var(--color-accent)",
                padding: "0 3px",
              }}
            >
              <Text
                size="xs"
                style={{
                  fontSize: "9px",
                  fontWeight: 600,
                  color: "white",
                  lineHeight: 1,
                }}
              >
                {todoCount > 9 ? "9+" : todoCount}
              </Text>
            </Box>
          )}
        </Box>,
      );
    }

    return days;
  };

  return (
    <Stack gap="sm" style={{ width: "340px", maxHeight: "480px" }}>
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
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
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
        {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
          <Text
            key={i}
            size="xs"
            fw={600}
            ta="center"
            style={{
              padding: "4px 0",
              fontSize: "10px",
              color: "var(--color-text-tertiary)",
            }}
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

      {/* Divider */}
      <div
        style={{
          height: "1px",
          backgroundColor: "var(--color-border-secondary)",
          margin: "4px 0",
        }}
      />

      {/* Selected Date Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text size="xs" fw={600} style={{ color: "var(--color-text-primary)" }}>
          {formatSelectedDate(selectedDate)}
        </Text>
        <ActionIcon
          variant="subtle"
          size="xs"
          onClick={handleOpenDailyNote}
          title="Open Daily Note"
        >
          <IconCalendar size={14} />
        </ActionIcon>
      </div>

      {/* Quick Add */}
      <form onSubmit={handleQuickAdd}>
        <Box
          style={{
            padding: "8px",
            borderRadius: "var(--radius-sm)",
            backgroundColor: "var(--color-bg-secondary)",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          {/* Task input row */}
          <Box
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <IconPlus
              size={12}
              stroke={1.5}
              style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }}
            />
            <input
              type="text"
              value={quickAddValue}
              onChange={(e) => setQuickAddValue(e.target.value)}
              placeholder="Add a task..."
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: "var(--font-size-xs)",
                color: "var(--color-text-primary)",
                padding: "2px 0",
              }}
            />
          </Box>

          {/* Options row */}
          <Box
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            {/* Time input */}
            <Box
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <IconClock
                size={10}
                style={{ color: "var(--color-text-tertiary)" }}
              />
              <input
                type="time"
                value={quickAddTime}
                onChange={(e) => setQuickAddTime(e.target.value)}
                style={{
                  fontSize: "10px",
                  background: "var(--color-bg-tertiary)",
                  border: "none",
                  borderRadius: "4px",
                  padding: "2px 4px",
                  color: "var(--color-text-secondary)",
                  width: "70px",
                }}
              />
            </Box>

            {/* Repeat select */}
            <Box
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <IconRepeat
                size={10}
                style={{ color: "var(--color-text-tertiary)" }}
              />
              <select
                value={quickAddRepeat}
                onChange={(e) =>
                  setQuickAddRepeat(e.target.value as RepeatFrequency | "")
                }
                style={{
                  fontSize: "10px",
                  background: "var(--color-bg-tertiary)",
                  border: "none",
                  borderRadius: "4px",
                  padding: "2px 4px",
                  color: "var(--color-text-secondary)",
                  cursor: "pointer",
                }}
              >
                <option value="">No repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </Box>

            {/* No date checkbox */}
            <Box
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                marginLeft: "auto",
              }}
            >
              <input
                type="checkbox"
                id="noDate"
                checked={quickAddNoDate}
                onChange={(e) => setQuickAddNoDate(e.target.checked)}
                style={{ cursor: "pointer" }}
              />
              <label
                htmlFor="noDate"
                style={{
                  fontSize: "10px",
                  color: "var(--color-text-tertiary)",
                  cursor: "pointer",
                }}
              >
                No date
              </label>
            </Box>
          </Box>
        </Box>
      </form>

      {/* Todo List */}
      <Box
        style={{
          flex: 1,
          minHeight: 0,
          maxHeight: "150px",
          overflow: "auto",
        }}
      >
        {selectedDateTodos.length === 0 ? (
          <Box
            style={{
              padding: "var(--spacing-sm)",
              textAlign: "center",
              color: "var(--color-text-tertiary)",
            }}
          >
            <Text size="xs" style={{ fontSize: "11px" }}>
              No tasks for this day
            </Text>
          </Box>
        ) : (
          selectedDateTodos.map((todo) => (
            <TodoItem
              key={todo.blockId}
              todo={todo}
              onClick={() => handleTodoClick(todo)}
              onStatusToggle={() => handleStatusToggle(todo.blockId)}
              isUpdating={updatingBlockId === todo.blockId}
            />
          ))
        )}
      </Box>
    </Stack>
  );
}
