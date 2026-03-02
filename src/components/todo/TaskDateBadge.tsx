import {
  differenceInDays,
  format,
  isToday,
  isTomorrow,
  isYesterday,
  parseISO,
} from "date-fns";

interface TaskDateBadgeProps {
  date: Date | string;
  type: "scheduled" | "deadline";
  isOverdue: boolean;
}

function formatBadgeDate(date: Date): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  if (isYesterday(date)) return "Yesterday";

  const now = new Date();
  const daysDiff = differenceInDays(date, now);

  // Within ±6 days: show weekday + day number (e.g., "Mon 15")
  if (daysDiff > 0 && daysDiff <= 6) {
    return format(date, "EEE d");
  }

  // Otherwise: "15 Mar"
  return format(date, "d MMM");
}

function getFullDateLabel(date: Date, type: "scheduled" | "deadline"): string {
  const prefix = type === "scheduled" ? "Scheduled for" : "Deadline:";
  return `${prefix} ${format(date, "EEEE, MMMM d, yyyy")}`;
}

function resolveColor(
  type: "scheduled" | "deadline",
  isOverdue: boolean,
  date: Date,
): string {
  if (type === "scheduled") {
    return "var(--color-accent)";
  }

  if (isOverdue) {
    return "var(--color-error)";
  }

  const daysDiff = differenceInDays(date, new Date());
  if (daysDiff <= 3) {
    return "var(--color-warning)";
  }

  return "var(--color-text-secondary)";
}

function CalendarIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M5 1v2M11 1v2M2 6h12M3 3h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DeadlineIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M8 4v4l2.5 1.5M14 8A6 6 0 112 8a6 6 0 0112 0z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TaskDateBadge({ date, type, isOverdue }: TaskDateBadgeProps) {
  const resolvedDate = typeof date === "string" ? parseISO(date) : date;
  const color = resolveColor(type, isOverdue, resolvedDate);
  const label = formatBadgeDate(resolvedDate);
  const ariaLabel = getFullDateLabel(resolvedDate, type);

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--spacing-xs)",
        height: 24,
        padding: "0 var(--spacing-sm)",
        fontSize: "var(--font-size-xs)",
        lineHeight: 1,
        fontWeight: 500,
        color,
        backgroundColor: "transparent",
        border: `1px solid ${color}`,
        borderRadius: "var(--radius-sm)",
        whiteSpace: "nowrap",
        userSelect: "none",
        transition:
          "color var(--transition-normal), border-color var(--transition-normal), background-color var(--transition-normal)",
      }}
    >
      {type === "scheduled" ? <CalendarIcon /> : <DeadlineIcon />}
      {label}
    </span>
  );
}
