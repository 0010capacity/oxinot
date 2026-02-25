/**
 * Natural language date parser for Korean and English.
 * Parses expressions like "내일", "tomorrow", "next Friday", "3일 후" into ISO date strings.
 */

interface ParseResult {
  date: string; // ISO date string (YYYY-MM-DD)
  hasTime: boolean;
  time?: { hour: number; minute: number };
}

const DAY_NAMES_KO = ["일", "월", "화", "수", "목", "금", "토"];
const DAY_NAMES_EN = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/**
 * Parse a natural language date string into an ISO date.
 * Returns null if the input cannot be parsed.
 */
export function parseDate(input: string): ParseResult | null {
  const normalized = input.trim().toLowerCase();

  // ======== RELATIVE DAYS ========

  // Korean: 오늘, 내일, 모레, 글피, 그저께
  if (normalized === "오늘" || normalized === "today") {
    return { date: getToday(), hasTime: false };
  }

  if (normalized === "내일" || normalized === "tomorrow") {
    return { date: addDays(getToday(), 1), hasTime: false };
  }

  if (normalized === "모레" || normalized === "day after tomorrow") {
    return { date: addDays(getToday(), 2), hasTime: false };
  }

  if (normalized === "글피") {
    return { date: addDays(getToday(), 3), hasTime: false };
  }

  if (normalized === "그저께" || normalized === "day before yesterday") {
    return { date: addDays(getToday(), -2), hasTime: false };
  }

  if (normalized === "어제" || normalized === "yesterday") {
    return { date: addDays(getToday(), -1), hasTime: false };
  }

  // ======== WEEK RELATIVES ========

  // Korean: 다음주, 지난주
  const nextWeekMatch = normalized.match(/^(다음\s?주|next\s?week)$/);
  if (nextWeekMatch) {
    // Return Monday of next week
    const monday = getNextWeekday(1); // Monday
    return { date: monday, hasTime: false };
  }

  const lastWeekMatch = normalized.match(/^(지난\s?주|last\s?week)$/);
  if (lastWeekMatch) {
    const monday = addDays(getNextWeekday(1), -7);
    return { date: monday, hasTime: false };
  }

  // ======== DAYS OF WEEK ========

  // Korean: 다음 주 월요일, 이번 주 금요일, 월요일
  for (let i = 0; i < 7; i++) {
    const koPattern = new RegExp(`(다음\\s*주\\s*)?${DAY_NAMES_KO[i]}요일?`);
    const koMatch = normalized.match(koPattern);
    if (koMatch) {
      const isNextWeek = !!koMatch[1];
      const target = getDayOfWeek(i, isNextWeek);
      return { date: target, hasTime: false };
    }

    // English: next Monday, this Friday, Monday
    const enPattern = new RegExp(
      `(next\\s+|this\\s+)?${DAY_NAMES_EN[i]}(day)?`,
    );
    const enMatch = normalized.match(enPattern);
    if (enMatch) {
      const isNextWeek = enMatch[1]?.includes("next");
      const target = getDayOfWeek(i, isNextWeek);
      return { date: target, hasTime: false };
    }
  }

  // ======== RELATIVE EXPRESSIONS ========

  // Korean: N일 후, N일 뒤, N일 뒤에
  const daysAfterKoMatch = normalized.match(/(\d+)\s*일\s*(후|뒤)/);
  if (daysAfterKoMatch) {
    const days = Number.parseInt(daysAfterKoMatch[1], 10);
    return { date: addDays(getToday(), days), hasTime: false };
  }

  // Korean: N주 후
  const weeksAfterKoMatch = normalized.match(/(\d+)\s*주\s*(후|뒤)/);
  if (weeksAfterKoMatch) {
    const weeks = Number.parseInt(weeksAfterKoMatch[1], 10);
    return { date: addDays(getToday(), weeks * 7), hasTime: false };
  }

  // English: in N days, N days from now
  const daysAfterEnMatch = normalized.match(
    /(?:in\s+)?(\d+)\s*days?(?:\s+from\s+now)?/,
  );
  if (daysAfterEnMatch) {
    const days = Number.parseInt(daysAfterEnMatch[1], 10);
    return { date: addDays(getToday(), days), hasTime: false };
  }

  // English: in N weeks
  const weeksAfterEnMatch = normalized.match(/(?:in\s+)?(\d+)\s*weeks?/);
  if (weeksAfterEnMatch) {
    const weeks = Number.parseInt(weeksAfterEnMatch[1], 10);
    return { date: addDays(getToday(), weeks * 7), hasTime: false };
  }

  // ======== MONTH RELATIVES ========

  // Korean: 다음 달, 이번 달
  if (normalized === "다음 달" || normalized === "next month") {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(1);
    return { date: formatDate(d), hasTime: false };
  }

  // ======== SPECIFIC DATES ========

  // Korean: 3월 15일, 3월15일, 3/15
  const koDateMatch = normalized.match(/(\d{1,2})월\s*(\d{1,2})일?/);
  if (koDateMatch) {
    const month = Number.parseInt(koDateMatch[1], 10);
    const day = Number.parseInt(koDateMatch[2], 10);
    const year = new Date().getFullYear();
    return { date: formatYearMonthDay(year, month, day), hasTime: false };
  }

  // English: March 15, Mar 15, 3/15, 15/3, 2026-03-15
  const enDateMatch = normalized.match(
    /(?:(\d{4})[-/])?(\d{1,2})[-/](\d{1,2})/,
  );
  if (enDateMatch) {
    const year = enDateMatch[1]
      ? Number.parseInt(enDateMatch[1], 10)
      : new Date().getFullYear();
    const month = Number.parseInt(enDateMatch[2], 10);
    const day = Number.parseInt(enDateMatch[3], 10);
    return { date: formatYearMonthDay(year, month, day), hasTime: false };
  }

  // ISO format: 2026-03-15
  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return { date: isoMatch[0], hasTime: false };
  }

  // ======== TIME PARSING ========

  // Korean: 오후 3시, 오전 9시 30분
  const timeKoMatch = normalized.match(
    /(오전|오후)\s*(\d{1,2})시(?:\s*(\d{1,2})분)?/,
  );
  if (timeKoMatch) {
    const isPM = timeKoMatch[1] === "오후";
    let hour = Number.parseInt(timeKoMatch[2], 10);
    const minute = timeKoMatch[3] ? Number.parseInt(timeKoMatch[3], 10) : 0;

    if (isPM && hour !== 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;

    // Use today's date with the parsed time
    return { date: getToday(), hasTime: true, time: { hour, minute } };
  }

  // English: 3pm, 3:30 pm, 15:00
  const timeEnMatch = normalized.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeEnMatch && !normalized.includes("월") && !normalized.includes("일")) {
    let hour = Number.parseInt(timeEnMatch[1], 10);
    const minute = timeEnMatch[2] ? Number.parseInt(timeEnMatch[2], 10) : 0;
    const meridiem = timeEnMatch[3]?.toLowerCase();

    if (meridiem === "pm" && hour !== 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;

    return { date: getToday(), hasTime: true, time: { hour, minute } };
  }

  return null;
}

// ======== HELPER FUNCTIONS ========

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

function formatYearMonthDay(year: number, month: number, day: number): string {
  const monthStr = month.toString().padStart(2, "0");
  const dayStr = day.toString().padStart(2, "0");
  return `${year}-${monthStr}-${dayStr}`;
}

function getNextWeekday(targetDay: number): string {
  // targetDay: 0 = Sunday, 1 = Monday, etc.
  const today = new Date();
  const currentDay = today.getDay();

  let daysUntil = targetDay - currentDay;
  if (daysUntil <= 0) {
    daysUntil += 7;
  }

  today.setDate(today.getDate() + daysUntil);
  return formatDate(today);
}

function getDayOfWeek(targetDay: number, nextWeek: boolean): string {
  const today = new Date();
  const currentDay = today.getDay();

  let daysUntil = targetDay - currentDay;
  if (daysUntil <= 0) {
    daysUntil += 7;
  }
  if (nextWeek) {
    daysUntil += 7;
  }

  today.setDate(today.getDate() + daysUntil);
  return formatDate(today);
}

/**
 * Combine a date result with a time result into a full ISO datetime string.
 */
export function combineDateAndTime(
  dateResult: ParseResult,
  timeResult: ParseResult,
): string {
  const time = timeResult.time || { hour: 0, minute: 0 };
  const hourStr = time.hour.toString().padStart(2, "0");
  const minuteStr = time.minute.toString().padStart(2, "0");
  return `${dateResult.date}T${hourStr}:${minuteStr}:00`;
}

/**
 * Parse input that may contain both date and time.
 * Returns the combined ISO datetime string, or just the date if no time.
 */
export function parseDateTime(input: string): string | null {
  // Try to parse as a single expression first
  const result = parseDate(input);
  if (result) {
    if (result.hasTime && result.time) {
      const hourStr = result.time.hour.toString().padStart(2, "0");
      const minuteStr = result.time.minute.toString().padStart(2, "0");
      return `${result.date}T${hourStr}:${minuteStr}:00`;
    }
    return result.date;
  }
  return null;
}
