import type {
  DateOrder,
  DateSeparator,
  TimeFormat,
} from "../../stores/clockFormatStore";
import type { ColorVariant, FontFamily } from "../../stores/themeStore";

export interface SettingsComponentProps {
  matchesSearch: (text: string) => boolean;
}

export interface AppearanceSettingsProps extends SettingsComponentProps {
  fontFamily: FontFamily;
  setFontFamily: (font: FontFamily) => void;
  getFontStack: () => string;
  editorFontSize: number;
  setEditorFontSize: (size: number) => void;
  editorLineHeight: number;
  setEditorLineHeight: (height: number) => void;
  fontOptions: Array<{ label: string; value: FontFamily }>;
}

export interface ThemeSettingsProps extends SettingsComponentProps {
  colorScheme: string | undefined;
  setColorScheme: (scheme: string | undefined) => void;
  colorVariant: ColorVariant;
  setColorVariant: (variant: ColorVariant) => void;
}

export interface DatetimeSettingsProps extends SettingsComponentProps {
  timeFormat: TimeFormat;
  dateOrder: DateOrder;
  dateSeparator: DateSeparator;
  setTimeFormat: (format: TimeFormat) => void;
  setDateOrder: (order: DateOrder) => void;
  setDateSeparator: (separator: DateSeparator) => void;
  timezone: string;
  setTimezone: (tz: string) => void;
}

export interface DailyNotesSettingsProps extends SettingsComponentProps {
  dailyNotesPath: string;
  setDailyNotesPath: (path: string) => void;
}

export interface HomepageSettingsProps extends SettingsComponentProps {
  homepageType: string;
  setHomepageType: (type: "daily-note" | "index" | "custom-page") => void;
  customHomepageId: string | null;
  setCustomHomepageId: (id: string | null) => void;
  pagesById: Record<string, { id: string; title: string }>;
  pageIds: string[];
}

export interface OutlinerSettingsProps extends SettingsComponentProps {
  showIndentGuides: boolean;
  toggleIndentGuides: () => void;
  autoExpandBlocks: boolean;
  setAutoExpandBlocks: (value: boolean) => void;
  showBlockCount: boolean;
  setShowBlockCount: (value: boolean) => void;
  showCodeBlockLineNumbers: boolean;
  setShowCodeBlockLineNumbers: (value: boolean) => void;
  indentSize: number;
  setIndentSize: (size: number) => void;
  metadataDisplayStyle: string;
  setMetadataDisplayStyle: (style: "property" | "box") => void;
}

export interface GitCommitResult {
  success: boolean;
  message: string;
  commit_hash?: string;
}

export interface GitSettingsProps extends SettingsComponentProps {
  isGitRepo: boolean;
  hasGitChanges: boolean;
  autoCommitEnabled: boolean;
  setAutoCommitEnabled: (enabled: boolean) => void;
  autoCommitInterval: number;
  setAutoCommitInterval: (interval: number) => void;
  checkGitStatus: (workspacePath: string) => Promise<void>;
  gitCommit: (
    workspacePath: string,
    message: string
  ) => Promise<GitCommitResult>;
  initGit: (workspacePath: string) => Promise<boolean>;
  remoteUrl: string | null;
  getRemoteUrl: (workspacePath: string) => Promise<string | null>;
  setRemoteUrl: (workspacePath: string, url: string) => Promise<void>;
  removeRemote: (workspacePath: string) => Promise<void>;
  workspacePath: string | null;
}

export interface ShortcutsSettingsProps extends SettingsComponentProps {}

export interface AdvancedSettingsProps extends SettingsComponentProps {
  appVersion?: string;
  telemetryEnabled: boolean;
  setTelemetryEnabled: (enabled: boolean) => void;
  resetAllSettings: () => void;
  clearCache: () => void;
}

export interface AboutSettingsProps extends SettingsComponentProps {
  appVersion: string;
}

export interface LanguageSettingsProps extends SettingsComponentProps {
  language: string | null;
  i18nLanguage: string;
  setLanguage: (lang: string | null) => void;
}
