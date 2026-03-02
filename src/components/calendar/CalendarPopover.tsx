import { useAppSettingsStore } from "@/stores/appSettingsStore";
import { usePageStore } from "@/stores/pageStore";
import { useTodoStore } from "@/stores/todoStore";
import { useViewStore } from "@/stores/viewStore";
import { buildPageBreadcrumb } from "@/utils/pageUtils";
import type { SmartViewType, TodoResult } from "@/types/todo";
import { removeStatusPrefix } from "@/types/todo";
import { IconCheck, IconSearch, IconX } from "@tabler/icons-react";
import { format } from "date-fns";
import { enUS, ko } from "date-fns/locale";
import type { CSSProperties, RefObject } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { CalendarGrid } from "./CalendarGrid";
import { DayTaskList } from "./DayTaskList";
import { TaskQuickAdd } from "./TaskQuickAdd";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CalendarPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLElement | null>;
}

type ISODateString = string;

type TabId = "date" | SmartViewType;

interface TabConfig {
  id: TabId;
  label: string;
  getCount: (counts: ViewCounts) => number;
}

interface ViewCounts {
  today: number;
  upcoming: number;
  overdue: number;
  highPriority: number;
  all: number;
  completed: number;
}



const POPOVER_WIDTH = 420;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toISODate(date: Date): ISODateString {
  return format(date, "yyyy-MM-dd");
}

// ---------------------------------------------------------------------------
// Inline CSS
// ---------------------------------------------------------------------------

const DYNAMIC_CSS = `
.oxinot-cal-tasklist::-webkit-scrollbar { width: 4px; }
.oxinot-cal-tasklist::-webkit-scrollbar-track { background: transparent; }
.oxinot-cal-tasklist::-webkit-scrollbar-thumb {
  background: var(--color-border-secondary);
  border-radius: var(--radius-sm);
}
.oxinot-cal-tab-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 4px;
  height: 32px;
  border: none;
  border-bottom: 1.5px solid transparent;
  background: transparent;
  color: var(--color-text-tertiary);
  font-size: 11px;
  font-family: var(--font-family);
  font-weight: 400;
  letter-spacing: 0.01em;
  cursor: pointer;
  white-space: nowrap;
  transition: color var(--transition-fast), border-color var(--transition-fast);
  border-radius: 0;
  flex: 1;
  opacity: 0.7;
}
.oxinot-cal-tab-btn:hover {
  color: var(--color-text-secondary);
  opacity: 0.9;
}
.oxinot-cal-tab-btn[data-active="true"] {
  color: var(--color-text-primary);
  border-bottom-color: var(--color-text-primary);
  font-weight: 500;
  opacity: 1;
}
.oxinot-cal-tab-btn[data-overdue="true"] {
  color: var(--color-error);
  opacity: 0.8;
}
.oxinot-cal-tab-btn[data-active="true"][data-overdue="true"] {
  color: var(--color-error);
  border-bottom-color: var(--color-error);
  opacity: 1;
}
.oxinot-stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 8px 4px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-bg-secondary);
  cursor: pointer;
  transition: background-color var(--transition-fast);
  min-width: 0;
  width: 100%;
  height: 100%;
}
.oxinot-stat-card:hover {
  background: var(--color-bg-hover);
}
.oxinot-stat-card-passive {
  cursor: default;
}
.oxinot-stat-card-passive:hover {
  background: var(--color-bg-secondary);
}
@keyframes oxinot-pulse {
  0%, 100% { opacity: 0.4; }
  50%       { opacity: 0.8; }
}
`;

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

function StatCard({
  value,
  label,
  color,
  onClick,
}: {
  value: number;
  label: string;
  color: string;
  onClick?: () => void;
}) {
  const cls = onClick
    ? "oxinot-stat-card"
    : "oxinot-stat-card oxinot-stat-card-passive";

  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      aria-label={`${label}: ${value}`}
    >
      <span
        style={{
          fontSize: 20,
          fontWeight: 600,
          lineHeight: 1,
          color: value > 0 ? color : "var(--color-text-tertiary)",
          fontFamily: "var(--font-family)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.02em",
          opacity: value > 0 ? 1 : 0.4,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 9,
          fontWeight: 500,
          color: "var(--color-text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontFamily: "var(--font-family)",
          lineHeight: 1,
          textAlign: "center",
          opacity: 0.6,
        }}
      >
        {label}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// SelectedDateCard — prominent date display for sidebar top
// ---------------------------------------------------------------------------

function SelectedDateCard({ selectedDate, locale }: { selectedDate: Date; locale: string }) {
  const dayNum = format(selectedDate, "d");
  const dayName = format(selectedDate, "EEEE", { locale: locale === "ko" ? ko : enUS });
  const monthYear = format(selectedDate, "MMMM yyyy", { locale: locale === "ko" ? ko : enUS });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "8px 4px 6px",
        border: "none",
        borderRadius: "var(--radius-md)",
        backgroundColor: "var(--color-bg-secondary)",
        gap: 2,
        textAlign: "center",
      }}
    >
      <span
        style={{
          fontSize: 32,
          fontWeight: 700,
          lineHeight: 1,
          color: "var(--color-text-primary)",
          fontFamily: "var(--font-family)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.03em",
        }}
      >
        {dayNum}
      </span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 400,
          color: "var(--color-text-secondary)",
          fontFamily: "var(--font-family)",
          lineHeight: 1.2,
          opacity: 0.7,
        }}
      >
        {dayName}
      </span>
      <span
        style={{
          fontSize: 9,
          color: "var(--color-text-tertiary)",
          fontFamily: "var(--font-family)",
          lineHeight: 1,
          marginTop: 1,
          opacity: 0.5,
        }}
      >
        {monthYear}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CalendarSidebar
// ---------------------------------------------------------------------------

function CalendarSidebar({
  selectedDate,
  dayTaskCount,
  todayCount,
  overdueCount,
  upcomingCount,
  onTabChange,
}: {
  selectedDate: Date;
  dayTaskCount: number;
  todayCount: number;
  overdueCount: number;
  upcomingCount: number;
  onTabChange: (tab: TabId) => void;
}) {
  const { t, i18n } = useTranslation();

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {/* Selected date */}
      <SelectedDateCard selectedDate={selectedDate} locale={i18n.language} />

      {/* Stats grid — 2×2 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: 6,
          flex: 1,
          minHeight: 0,
          alignItems: "stretch",
        }}
      >
        <StatCard
          value={dayTaskCount}
          label={t("calendar.stats.this_day")}
          color="var(--color-text-primary)"
          onClick={() => onTabChange("date")}
        />
        <StatCard
          value={todayCount}
          label={t("calendar.stats.today")}
          color="var(--color-accent)"
          onClick={() => onTabChange("today")}
        />
        <StatCard
          value={overdueCount}
          label={t("calendar.stats.overdue")}
          color="var(--color-error)"
          onClick={() => onTabChange("overdue")}
        />
        <StatCard
          value={upcomingCount}
          label={t("calendar.stats.upcoming")}
          color="var(--color-text-primary)"
          onClick={() => onTabChange("all")}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function Skeleton() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "16px 20px",
      }}
    >
      {[75, 55, 68, 45].map((w) => (
        <div
          key={w}
          style={{
            height: 13,
            width: `${w}%`,
            borderRadius: "var(--radius-sm)",
            backgroundColor: "var(--color-bg-secondary)",
            animation: "oxinot-pulse 1.5s ease-in-out infinite",
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab badge
// ---------------------------------------------------------------------------

function TabBadge({ count, isOverdue }: { count: number; isOverdue: boolean }) {
  if (count === 0) return null;
  return (
    <span
      style={{
        minWidth: 15,
        height: 15,
        padding: "0 4px",
        borderRadius: "var(--radius-lg)",
        backgroundColor: isOverdue
          ? "color-mix(in srgb, var(--color-error) 18%, transparent)"
          : "color-mix(in srgb, var(--color-accent) 18%, transparent)",
        color: isOverdue ? "var(--color-error)" : "var(--color-accent)",
        fontSize: 8,
        fontWeight: 600,
        lineHeight: "15px",
        textAlign: "center",
        display: "inline-block",
      }}
      aria-hidden="true"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

// ---------------------------------------------------------------------------
// SmartTaskRow
// ---------------------------------------------------------------------------

function SmartTaskRow({
  task,
  isSelected,
  onToggleSelect,
  onCycleStatus,
}: {
  task: TodoResult;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onCycleStatus: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const content = removeStatusPrefix(task.content);
  const isDone = task.status === "done" || task.status === "canceled";

  const statusColor: Record<string, string> = {
    todo: "var(--color-text-tertiary)",
    doing: "var(--color-accent)",
    done: "var(--color-success)",
    later: "var(--color-warning)",
    canceled: "var(--color-text-tertiary)",
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: task row - selection via checkbox
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 16px",
        backgroundColor: isSelected
          ? "color-mix(in srgb, var(--color-accent) 10%, transparent)"
          : hovered
            ? "var(--color-bg-hover)"
            : "transparent",
        cursor: "pointer",
        transition: "background-color var(--transition-fast)",
        borderBottom: "1px solid var(--color-border-secondary)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onToggleSelect(task.blockId)}
    >
      {/* Status dot */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCycleStatus(task.blockId);
        }}
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          border: `2px solid ${statusColor[task.status] ?? "var(--color-text-tertiary)"}`,
          backgroundColor: isDone ? statusColor[task.status] : "transparent",
          flexShrink: 0,
          cursor: "pointer",
          padding: 0,
          transition: "background-color var(--transition-fast)",
        }}
        aria-label={`Status: ${task.status}. Click to cycle.`}
      />

      {/* Content + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: "var(--font-size-sm)",
            color: "var(--color-text-primary)",
            textDecoration: isDone ? "line-through" : "none",
            opacity: isDone ? 0.45 : 1,
            lineHeight: 1.4,
          }}
        >
          {content}
        </div>
        {(task.scheduled || task.deadline) && (
          <div
            style={{
              fontSize: 10,
              color: "var(--color-text-tertiary)",
              lineHeight: 1.3,
              marginTop: 1,
            }}
          >
            {task.scheduled
              ? format(new Date(task.scheduled), "MMM d")
              : task.deadline
                ? format(new Date(task.deadline), "MMM d")
                : null}
          </div>
        )}
      </div>

      {/* Priority */}
      {task.priority && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color:
              task.priority === "A"
                ? "var(--color-error)"
                : task.priority === "B"
                  ? "var(--color-warning)"
                  : "var(--color-text-tertiary)",
            flexShrink: 0,
            letterSpacing: "0.01em",
          }}
        >
          {task.priority}
        </span>
      )}

      {/* Selection checkbox */}
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: "var(--radius-sm)",
          border: `1.5px solid ${isSelected ? "var(--color-accent)" : "var(--color-border-secondary)"}`,
          backgroundColor: isSelected ? "var(--color-accent)" : "transparent",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition:
            "background-color var(--transition-fast), border-color var(--transition-fast)",
          opacity: hovered || isSelected ? 1 : 0,
        }}
        aria-hidden="true"
      >
        {isSelected && (
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none" role="img" aria-label="Selected">
            <path
              d="M1.5 4.5l2 2 4-4"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BulkBar
// ---------------------------------------------------------------------------

function BulkBar({
  count,
  onMarkDone,
  onDelete,
  onClear,
}: {
  count: number;
  onMarkDone: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const btnStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 12px",
    border: "1px solid var(--color-border-primary)",
    borderRadius: "var(--radius-md)",
    backgroundColor: "transparent",
    color: "var(--color-text-secondary)",
    fontSize: "var(--font-size-xs)",
    fontFamily: "var(--font-family)",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition:
      "background-color var(--transition-fast), opacity var(--transition-fast)",
    fontWeight: 500,
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 16px",
        borderTop: "1px solid var(--color-border-secondary)",
        backgroundColor: "var(--color-bg-secondary)",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: "var(--font-size-xs)",
          color: "var(--color-text-tertiary)",
          fontFamily: "var(--font-family)",
        }}
      >
        {t("calendar.selected", { count })}
      </span>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          style={{
            ...btnStyle,
            color: "var(--color-success)",
            borderColor:
              "color-mix(in srgb, var(--color-success) 40%, var(--color-border-secondary))",
          }}
          onClick={onMarkDone}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor =
              "color-mix(in srgb, var(--color-success) 10%, transparent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <IconCheck size={11} stroke={2.5} /> {t("calendar.done")}
        </button>
        <button
          type="button"
          style={{
            ...btnStyle,
            color: "var(--color-error)",
            borderColor:
              "color-mix(in srgb, var(--color-error) 40%, var(--color-border-secondary))",
          }}
          onClick={onDelete}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor =
              "color-mix(in srgb, var(--color-error) 10%, transparent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <IconX size={11} stroke={2.5} /> {t("calendar.delete")}
        </button>
        <button
          type="button"
          style={btnStyle}
          onClick={onClear}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          {t("calendar.clear")}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CalendarPopover({
  isOpen,
  onClose,
  triggerRef,
}: CalendarPopoverProps) {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [activeTab, setActiveTab] = useState<TabId>("date");
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState(false);
  const [animReady, setAnimReady] = useState(false);

  const getDailyNotePath = useAppSettingsStore(
    (state) => state.getDailyNotePath,
  );
  const { openPageByPath } = usePageStore();
  const { openNote } = useViewStore();

  // Dynamic TABS based on i18n
  const tabs = useMemo<TabConfig[]>(
    () => [
      { id: "date", label: t("calendar.tabs.date"), getCount: () => 0 },
      { id: "today", label: t("calendar.tabs.today"), getCount: (c) => c.today },
      {
        id: "overdue",
        label: t("calendar.tabs.overdue"),
        getCount: (c) => c.overdue,
      },
      { id: "all", label: t("calendar.tabs.all"), getCount: (c) => c.all },
    ],
    [t],
  );

  const fetchTodos = useTodoStore((s) => s.fetchTodos);
  const fetchSmartView = useTodoStore((s) => s.fetchSmartView);
  const fetchViewCounts = useTodoStore((s) => s.fetchViewCounts);
  const cycleTodoStatus = useTodoStore((s) => s.cycleTodoStatus);
  const bulkUpdateStatus = useTodoStore((s) => s.bulkUpdateStatus);
  const storeTodos = useTodoStore((s) => s.todos);
  const storeLoading = useTodoStore((s) => s.isLoading);
  const viewCounts = useTodoStore((s) => s.viewCounts);

  const popoverRef = useRef<HTMLDivElement>(null);

  const calcPosition = useCallback(() => {
    if (!triggerRef.current) return { top: 8, left: 8 };
    const rect = triggerRef.current.getBoundingClientRect();
    const gap = 10;
    let left = rect.right - POPOVER_WIDTH;
    if (left < 12) left = 12;
    if (left + POPOVER_WIDTH > window.innerWidth - 12)
      left = window.innerWidth - POPOVER_WIDTH - 12;
    return { top: rect.bottom + gap, left };
  }, [triggerRef]);

  const [position, setPosition] = useState(() => calcPosition());

  useLayoutEffect(() => {
    if (isOpen) setPosition(calcPosition());
  }, [isOpen, calcPosition]);

  useEffect(() => {
    if (!isOpen) return;
    const update = () => setPosition(calcPosition());
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [isOpen, calcPosition]);

  const todosByDate = useMemo(() => {
    const map: Record<string, TodoResult[]> = {};
    for (const todo of storeTodos) {
      for (const key of [todo.scheduled, todo.deadline]) {
        if (!key) continue;
        if (!map[key]) map[key] = [];
        if (!map[key].includes(todo)) map[key].push(todo);
      }
    }
    return map;
  }, [storeTodos]);

  const fetchForDateTab = useCallback(
    async (date: Date) => {
      const iso = toISODate(date);
      await fetchTodos({ scheduledFrom: iso, scheduledTo: iso });
    },
    [fetchTodos],
  );

  const fetchForSmartTab = useCallback(
    async (tab: SmartViewType) => {
      await fetchSmartView(tab);
    },
    [fetchSmartView],
  );

  const refreshCurrent = useCallback(async () => {
    if (activeTab === "date") {
      await fetchForDateTab(selectedDate);
    } else {
      await fetchForSmartTab(activeTab as SmartViewType);
    }
    fetchViewCounts();
  }, [
    activeTab,
    selectedDate,
    fetchForDateTab,
    fetchForSmartTab,
    fetchViewCounts,
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetch functions are stable from store
  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      setAnimReady(false);
      // Two rAFs: first lets the browser paint the hidden state, second triggers transition
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setAnimReady(true)),
      );
      fetchTodos({}).then(() => fetchViewCounts());
      if (activeTab === "date") {
        fetchForDateTab(selectedDate);
      } else {
        fetchForSmartTab(activeTab as SmartViewType);
      }
      setSelectedIds(new Set());
      setSearchQuery("");
    } else {
      setAnimReady(false);
      // Keep visible briefly so exit transition can play
      const t = setTimeout(() => setVisible(false), 150);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetch functions are stable from store
  useEffect(() => {
    if (!isOpen) return;
    setSelectedIds(new Set());
    setSearchQuery("");
    if (activeTab === "date") {
      fetchForDateTab(selectedDate);
    } else {
      fetchForSmartTab(activeTab as SmartViewType);
    }
  }, [activeTab]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetch function is stable from store
  useEffect(() => {
    if (!isOpen || activeTab !== "date") return;
    fetchForDateTab(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      onClose();
    };
    const timer = setTimeout(
      () => document.addEventListener("mousedown", handler),
      0,
    );
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
    };
  }, [isOpen, onClose, triggerRef]);

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    setActiveTab("date");
  }, []);

  const handleDateDoubleClick = useCallback(
    async (date: Date) => {
      try {
        const fullPath = getDailyNotePath(date);
        const pageId = await openPageByPath(fullPath);
        const freshPageData = usePageStore.getState().pagesById[pageId];
        if (freshPageData) {
          const freshPagesById = usePageStore.getState().pagesById;
          const { names, ids } = buildPageBreadcrumb(pageId, freshPagesById);
          openNote(pageId, freshPageData.title, names, ids);
        }
        onClose();
      } catch (error) {
        console.error("[CalendarPopover] Failed to open daily note:", error);
      }
    },
    [getDailyNotePath, openPageByPath, openNote, onClose],
  );

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
  }, []);

  const handleTaskAdded = useCallback(
    async (_todo: TodoResult) => {
      await refreshCurrent();
    },
    [refreshCurrent],
  );

  const handleCycleStatus = useCallback(
    async (id: string) => {
      await cycleTodoStatus(id);
      await refreshCurrent();
    },
    [cycleTodoStatus, refreshCurrent],
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleBulkDone = useCallback(async () => {
    await bulkUpdateStatus(Array.from(selectedIds), "done");
    setSelectedIds(new Set());
    await refreshCurrent();
  }, [selectedIds, bulkUpdateStatus, refreshCurrent]);

  const handleBulkDelete = useCallback(async () => {
    await bulkUpdateStatus(Array.from(selectedIds), "canceled");
    setSelectedIds(new Set());
    await refreshCurrent();
  }, [selectedIds, bulkUpdateStatus, refreshCurrent]);

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return storeTodos;
    return storeTodos.filter(
      (t) =>
        removeStatusPrefix(t.content).toLowerCase().includes(q) ||
        t.pageTitle.toLowerCase().includes(q),
    );
  }, [storeTodos, searchQuery]);

  const selectedDateISO = useMemo(
    () => toISODate(selectedDate),
    [selectedDate],
  );

  const counts: ViewCounts = viewCounts;

  const dayTaskCount = useMemo(() => {
    const iso = toISODate(selectedDate);
    return storeTodos.filter((t) => t.scheduled === iso || t.deadline === iso)
      .length;
  }, [storeTodos, selectedDate]);

  const upcomingAll = useMemo(() => {
    const iso = toISODate(selectedDate);
    const today = toISODate(new Date());
    return storeTodos
      .filter(
        (t) =>
          t.status !== "done" &&
          t.status !== "canceled" &&
          t.scheduled &&
          t.scheduled > (iso > today ? iso : today),
      )
      .sort((a, b) => (a.scheduled ?? "").localeCompare(b.scheduled ?? ""));
  }, [storeTodos, selectedDate]);

  const upcomingCount = upcomingAll.length;

  if (!visible) return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        width: POPOVER_WIDTH,
        maxWidth: "calc(100vw - 24px)",
        bottom: 16,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-bg-elevated)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-lg)",
        overflow: "hidden",
        fontFamily: "var(--font-family)",
        zIndex: 1000,
        opacity: animReady ? 1 : 0,
        transform: animReady
          ? "translateX(0) scale(1)"
          : "translateX(20px) scale(0.98)",
        transition: animReady
          ? "opacity 0.18s ease-out, transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)"
          : "opacity 0.12s ease-in, transform 0.12s ease-in",
      }}
      // biome-ignore lint/a11y/useSemanticElements: custom styled dialog
      role="dialog"
      aria-label="Calendar and tasks"
      aria-modal="false"
    >
      <style>{DYNAMIC_CSS}</style>

      {/* ── Top section: Calendar + Sidebar ── */}
      <div
        style={{
          display: "flex",
          gap: 14,
          padding: "14px 16px 12px",
          borderBottom: "1px solid var(--color-border-secondary)",
          flexShrink: 0,
          alignItems: "stretch",
        }}
      >
        {/* Left: sidebar (stat cards) */}
        <CalendarSidebar
          selectedDate={selectedDate}
          dayTaskCount={dayTaskCount}
          todayCount={counts.today}
          overdueCount={counts.overdue}
          upcomingCount={upcomingCount}
          onTabChange={handleTabChange}
        />

        {/* Right: calendar grid */}
        <div style={{ flexShrink: 0 }}>
          <CalendarGrid
            selectedDate={activeTab === "date" ? selectedDate : undefined}
            onDateSelect={handleDateSelect}
            onDateDoubleClick={handleDateDoubleClick}
            todosByDate={todosByDate}
            showNavigation
          />
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--color-border-secondary)",
          flexShrink: 0,
          backgroundColor: "var(--color-bg-elevated)",
          padding: "0 4px",
        }}
        role="tablist"
        aria-label="Task views"
      >
        {tabs.map((tab) => {
          const count = tab.getCount(counts);
          const isOverdue = tab.id === "overdue" && count > 0;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className="oxinot-cal-tab-btn"
              data-active={activeTab === tab.id ? "true" : "false"}
              data-overdue={
                isOverdue && activeTab !== tab.id ? "true" : "false"
              }
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
              {tab.id !== "date" && count > 0 && (
                <TabBadge count={count} isOverdue={isOverdue} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Quick add ── */}
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid var(--color-border-secondary)",
          flexShrink: 0,
        }}
      >
        <TaskQuickAdd
          selectedDate={selectedDate}
          onTaskAdded={handleTaskAdded}
          placeholder={t("calendar.quick_add_placeholder")}
        />
      </div>

      {/* ── Search (smart view tabs only) ── */}
      {activeTab !== "date" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 14px",
            borderBottom: "1px solid var(--color-border-secondary)",
            flexShrink: 0,
          }}
        >
          <IconSearch
            size={13}
            stroke={1.5}
            style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }}
          />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("calendar.search_placeholder")}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-primary)",
              fontFamily: "var(--font-family)",
              padding: "2px 0",
            }}
            aria-label={t("calendar.search_placeholder")}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 2,
                color: "var(--color-text-tertiary)",
                display: "flex",
                borderRadius: "var(--radius-sm)",
              }}
              aria-label="Clear search"
            >
              <IconX size={12} stroke={1.5} />
            </button>
          )}
        </div>
      )}

      {/* ── Task list ── */}
      <div
        className="oxinot-cal-tasklist"
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          minHeight: 0,
        }}
      >
        {storeLoading ? (
          <Skeleton />
        ) : activeTab === "date" ? (
          <DayTaskList selectedDate={selectedDateISO} tasks={filteredTasks} />
        ) : filteredTasks.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "32px 24px",
              gap: 6,
            }}
          >
            <span
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-tertiary)",
              }}
            >
              {t("calendar.no_tasks_found")}
            </span>
            {searchQuery && (
              <span
                style={{
                  fontSize: "var(--font-size-xs)",
                  color: "var(--color-text-tertiary)",
                  opacity: 0.7,
                }}
              >
                {t("calendar.try_different_search")}
              </span>
            )}
          </div>
        ) : (
          filteredTasks.map((task) => (
            <SmartTaskRow
              key={task.blockId}
              task={task}
              isSelected={selectedIds.has(task.blockId)}
              onToggleSelect={toggleSelect}
              onCycleStatus={handleCycleStatus}
            />
          ))
        )}
      </div>

      {/* ── Bulk action bar ── */}
      {selectedIds.size > 0 && (
        <BulkBar
          count={selectedIds.size}
          onMarkDone={handleBulkDone}
          onDelete={handleBulkDelete}
          onClear={() => setSelectedIds(new Set())}
        />
      )}
    </div>,
    document.body,
  );
}
