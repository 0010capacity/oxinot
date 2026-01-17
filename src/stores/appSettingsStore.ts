import { persist } from "zustand/middleware";
import { createWithEqualityFn } from "zustand/traditional";

interface AppSettings {
  dailyNotesPath: string;
  dailyNoteTemplateId: string | null;
  homepageType: "daily-note" | "index" | "custom-page";
  customHomepageId: string | null;
  language: string | null;
}

interface AppSettingsStore extends AppSettings {
  setDailyNotesPath: (path: string) => void;
  setDailyNoteTemplateId: (id: string | null) => void;
  setHomepageType: (type: "daily-note" | "index" | "custom-page") => void;
  setCustomHomepageId: (id: string | null) => void;
  setLanguage: (lang: string | null) => void;
  getDailyNotePath: (date: Date) => string;
}

export const useAppSettingsStore = createWithEqualityFn<AppSettingsStore>()(
  persist(
    (set, get) => ({
      // Default settings
      dailyNotesPath: "Daily",
      dailyNoteTemplateId: null,
      homepageType: "daily-note",
      customHomepageId: null,
      language: null,

      // Actions
      setDailyNotesPath: (path: string) => set({ dailyNotesPath: path }),
      setDailyNoteTemplateId: (id: string | null) =>
        set({ dailyNoteTemplateId: id }),
      setHomepageType: (type: "daily-note" | "index" | "custom-page") =>
        set({ homepageType: type }),
      setCustomHomepageId: (id: string | null) => set({ customHomepageId: id }),
      setLanguage: (lang: string | null) => set({ language: lang }),

      getDailyNotePath: (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const dateStr = `${year}-${month}-${day}`;
        const basePath = get().dailyNotesPath;

        // Return path like "Daily/2025-01-10"
        return basePath ? `${basePath}/${dateStr}` : dateStr;
      },
    }),
    {
      name: "app-settings",
    }
  )
);
