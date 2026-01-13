import { persist } from "zustand/middleware";
import { createWithEqualityFn } from "zustand/traditional";

export type TimeFormat = "24h" | "12h";
export type DateSeparator = "/" | "-" | ".";
export type DateOrder = "MDY" | "DMY" | "YMD";
export type Timezone = string;

interface ClockFormatSettings {
  timeFormat: TimeFormat;
  dateOrder: DateOrder;
  dateSeparator: DateSeparator;
  timezone: Timezone;
}

interface ClockFormatStore extends ClockFormatSettings {
  setTimeFormat: (format: TimeFormat) => void;
  setDateOrder: (order: DateOrder) => void;
  setDateSeparator: (separator: DateSeparator) => void;
  setTimezone: (timezone: Timezone) => void;
  formatTime: (date: Date) => string;
  formatDate: (date: Date) => string;
}

export const useClockFormatStore = createWithEqualityFn<ClockFormatStore>()(
  persist(
    (set, get) => ({
      // Default settings
      timeFormat: "24h",
      dateOrder: "MDY",
      dateSeparator: "/",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,

      // Actions
      setTimeFormat: (format: TimeFormat) => set({ timeFormat: format }),
      setDateOrder: (order: DateOrder) => set({ dateOrder: order }),
      setDateSeparator: (separator: DateSeparator) =>
        set({ dateSeparator: separator }),
      setTimezone: (timezone: Timezone) => set({ timezone }),

      formatTime: (date: Date) => {
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const format = get().timeFormat;

        if (format === "24h") {
          return `${hours}:${minutes}`;
        }
        
        const hour12 = date.getHours() % 12 || 12;
        const period = date.getHours() >= 12 ? "PM" : "AM";
        return `${String(hour12).padStart(2, "0")}:${minutes} ${period}`;
      },

      formatDate: (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const separator = get().dateSeparator;
        const order = get().dateOrder;

        const parts: { [key: string]: string } = {
          Y: String(year),
          M: month,
          D: day,
        };

        // Build date string based on order
        const dateParts = order.split("").map((part) => parts[part]);
        return dateParts.join(separator);
      },
    }),
    {
      name: "clock-format-settings",
    },
  ),
);
