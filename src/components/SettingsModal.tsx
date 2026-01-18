import {
  Modal,
  Tabs,
  TextInput,
  Stack,
  Button,
  useMantineColorScheme,
  useComputedColorScheme,
} from "@mantine/core";
import styles from "./SettingsModal.module.css";
import {
  IconAppWindow,
  IconBrandGit,
  IconCalendar,
  IconClock,
  IconHome,
  IconKeyboard,
  IconLanguage,
  IconList,
  IconPalette,
  IconSearch,
  IconSettings,
  IconX,
} from "@tabler/icons-react";
import { getVersion } from "@tauri-apps/api/app";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAdvancedSettingsStore } from "../stores/advancedSettingsStore";
import { useAppSettingsStore } from "../stores/appSettingsStore";
import { useClockFormatStore } from "../stores/clockFormatStore";
import { useGitStore } from "../stores/gitStore";
import { useOutlinerSettingsStore } from "../stores/outlinerSettingsStore";
import { type FontFamily, useThemeStore } from "../stores/themeStore";
import { AboutSettings } from "./settings/AboutSettings";
import { AdvancedSettings } from "./settings/AdvancedSettings";
import { AppearanceSettings } from "./settings/AppearanceSettings";
import { DailyNotesSettings } from "./settings/DailyNotesSettings";
import { DatetimeSettings } from "./settings/DatetimeSettings";
import { GitSettings } from "./settings/GitSettings";
import { HomepageSettings } from "./settings/HomepageSettings";
import { LanguageSettings } from "./settings/LanguageSettings";
import { OutlinerSettings } from "./settings/OutlinerSettings";
import { ShortcutsSettings } from "./settings/ShortcutsSettings";
import type { SettingTabConfig } from "./settings/types";
import { ThemeSettings } from "./settings/ThemeSettings";

const FONT_FAMILY_VALUES: FontFamily[] = [
  "system",
  "inter",
  "sf-pro",
  "roboto",
  "open-sans",
  "lato",
  "source-sans",
  "noto-sans",
  "ibm-plex",
  "jetbrains-mono",
  "fira-code",
  "cascadia",
];

interface SettingsModalProps {
  opened: boolean;
  onClose: () => void;
  workspacePath: string | null;
  pagesById: Record<string, { id: string; title: string }>;
  pageIds: string[];
  vacuumDatabase: () => Promise<void>;
  optimizeDatabase: () => Promise<void>;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export function SettingsModal({
  opened,
  onClose,
  workspacePath,
  pagesById,
  pageIds,
  vacuumDatabase,
  optimizeDatabase,
  t: tFromProps, // Rename t prop to tFromProps to avoid conflict with useTranslation's t
}: SettingsModalProps) {
  const { t, i18n } = useTranslation();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const isDark = useComputedColorScheme("light") === "dark";

  // App version state
  const [appVersion, setAppVersion] = useState<string>("");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string | null>("appearance");

  // Build font options dynamically from i18n
  const fontOptions: Array<{ label: string; value: FontFamily }> =
    FONT_FAMILY_VALUES.map((value) => {
      const keyMap: Record<string, string> = {
        system: "system_default",
        inter: "inter",
        "sf-pro": "sf_pro",
        roboto: "roboto",
        "open-sans": "open_sans",
        lato: "lato",
        "source-sans": "source_sans",
        "noto-sans": "noto_sans",
        "ibm-plex": "ibm_plex",
        "jetbrains-mono": "jetbrains_mono",
        "fira-code": "fira_code",
        cascadia: "cascadia",
      };
      return {
        label: t(`settings.appearance.font_options.${keyMap[value]}`),
        value: value as FontFamily,
      };
    });

  // Load app version from Tauri
  useEffect(() => {
    getVersion()
      .then(setAppVersion)
      .catch((err) => {
        console.error("Failed to get app version:", err);
        setAppVersion("unknown");
      });
  }, []);

  // Advanced settings
  const telemetryEnabled = useAdvancedSettingsStore(
    (state) => state.telemetryEnabled,
  );
  const setTelemetryEnabled = useAdvancedSettingsStore(
    (state) => state.setTelemetryEnabled,
  );
  const resetAllSettings = useAdvancedSettingsStore(
    (state) => state.resetAllSettings,
  );
  const clearCache = useAdvancedSettingsStore((state) => state.clearCache);

  // Theme
  const colorVariant = useThemeStore((state) => state.colorVariant);
  const setColorVariant = useThemeStore((state) => state.setColorVariant);

  // Appearance
  const fontFamily = useThemeStore((state) => state.fontFamily);
  const setFontFamily = useThemeStore((state) => state.setFontFamily);
  const getFontStack = useThemeStore((state) => state.getFontStack);
  const editorFontSize = useThemeStore((state) => state.editorFontSize || 16);
  const setEditorFontSize = useThemeStore((state) => state.setEditorFontSize);
  const editorLineHeight = useThemeStore(
    (state) => state.editorLineHeight || 1.6,
  );
  const setEditorLineHeight = useThemeStore(
    (state) => state.setEditorLineHeight,
  );

  // Clock Format
  const timeFormat = useClockFormatStore((state) => state.timeFormat);
  const dateOrder = useClockFormatStore((state) => state.dateOrder);
  const dateSeparator = useClockFormatStore((state) => state.dateSeparator);
  const setTimeFormat = useClockFormatStore((state) => state.setTimeFormat);
  const setDateOrder = useClockFormatStore((state) => state.setDateOrder);
  const setDateSeparator = useClockFormatStore(
    (state) => state.setDateSeparator,
  );
  const timezone = useClockFormatStore((state) => state.timezone);
  const setTimezone = useClockFormatStore((state) => state.setTimezone);

  // App Settings
  const dailyNotesPath = useAppSettingsStore((state) => state.dailyNotesPath);
  const setDailyNotesPath = useAppSettingsStore(
    (state) => state.setDailyNotesPath,
  );
  const dailyNoteTemplateId = useAppSettingsStore(
    (state) => state.dailyNoteTemplateId,
  );
  const setDailyNoteTemplateId = useAppSettingsStore(
    (state) => state.setDailyNoteTemplateId,
  );
  const homepageType = useAppSettingsStore((state) => state.homepageType);
  const setHomepageType = useAppSettingsStore((state) => state.setHomepageType);
  const customHomepageId = useAppSettingsStore(
    (state) => state.customHomepageId,
  );
  const setCustomHomepageId = useAppSettingsStore(
    (state) => state.setCustomHomepageId,
  );
  const language = useAppSettingsStore((state) => state.language);
  const setLanguage = useAppSettingsStore((state) => state.setLanguage);

  // Outliner
  const showIndentGuides = useOutlinerSettingsStore(
    (state) => state.showIndentGuides,
  );
  const toggleIndentGuides = useOutlinerSettingsStore(
    (state) => state.toggleIndentGuides,
  );
  const autoExpandBlocks = useOutlinerSettingsStore(
    (state) => state.autoExpandBlocks ?? true,
  );
  const setAutoExpandBlocks = useOutlinerSettingsStore(
    (state) => state.setAutoExpandBlocks,
  );
  const showBlockCount = useOutlinerSettingsStore(
    (state) => state.showBlockCount ?? false,
  );
  const setShowBlockCount = useOutlinerSettingsStore(
    (state) => state.setShowBlockCount,
  );
  const showCodeBlockLineNumbers = useOutlinerSettingsStore(
    (state) => state.showCodeBlockLineNumbers ?? true,
  );
  const setShowCodeBlockLineNumbers = useOutlinerSettingsStore(
    (state) => state.setShowCodeBlockLineNumbers,
  );
  const indentSize = useOutlinerSettingsStore((state) => state.indentSize);
  const setIndentSize = useOutlinerSettingsStore(
    (state) => state.setIndentSize,
  );

  // Git
  const isGitRepo = useGitStore((state) => state.isRepo);
  const hasGitChanges = useGitStore((state) => state.hasChanges);
  const autoCommitEnabled = useGitStore((state) => state.autoCommitEnabled);
  const setAutoCommitEnabled = useGitStore(
    (state) => state.setAutoCommitEnabled,
  );
  const autoCommitInterval = useGitStore((state) => state.autoCommitInterval);
  const setAutoCommitInterval = useGitStore(
    (state) => state.setAutoCommitInterval,
  );
  const checkGitStatus = useGitStore((state) => state.checkStatus);
  const gitCommit = useGitStore((state) => state.commit);
  const initGit = useGitStore((state) => state.initGit);
  const remoteUrl = useGitStore((state) => state.remoteUrl);
  const getRemoteUrl = useGitStore((state) => state.getRemoteUrl);
  const setRemoteUrl = useGitStore((state) => state.setRemoteUrl);
  const removeRemote = useGitStore((state) => state.removeRemote);

  const matchesSearch = useCallback(
    (text: string) => {
      if (!searchQuery.trim()) return true;
      return text.toLowerCase().includes(searchQuery.toLowerCase());
    },
    [searchQuery],
  );

  const tabs: SettingTabConfig[] = useMemo(
    () => [
      {
        id: "appearance",
        icon: <IconAppWindow size={16} />,
        labelKey: "settings.tabs.appearance",
        keywords: [
          t("settings.appearance.font_family"),
          t("settings.appearance.editor_font_size"),
          t("settings.appearance.editor_line_height"),
          t("common.search_keywords.typography"),
          "inter",
          "system",
          "roboto",
          t("common.search_keywords.monospace"),
          "preview",
        ],
        component: (
          <AppearanceSettings
            matchesSearch={matchesSearch}
            fontFamily={fontFamily}
            setFontFamily={setFontFamily}
            getFontStack={getFontStack}
            editorFontSize={editorFontSize}
            setEditorFontSize={setEditorFontSize}
            editorLineHeight={editorLineHeight}
            setEditorLineHeight={setEditorLineHeight}
            fontOptions={fontOptions}
          />
        ),
      },
      {
        id: "language",
        icon: <IconLanguage size={16} />,
        labelKey: "settings.tabs.language",
        keywords: [
          t("settings.language.title"),
          t("common.search_keywords.english"),
          t("common.search_keywords.korean"),
          t("common.search_keywords.locale"),
        ],
        component: (
          <LanguageSettings
            matchesSearch={matchesSearch}
            language={language}
            i18nLanguage={i18n.language}
            setLanguage={setLanguage}
          />
        ),
      },
      {
        id: "theme",
        icon: <IconPalette size={16} />,
        labelKey: "settings.tabs.theme",
        keywords: [
          t("settings.theme.color_mode"),
          t("settings.theme.modes.light"),
          t("settings.theme.modes.dark"),
          t("settings.theme.modes.auto"),
          t("settings.theme.color_variant"),
          "accent",
          t("settings.theme.variants.blue"),
          t("settings.theme.variants.purple"),
          t("settings.theme.variants.green"),
          t("settings.theme.variants.amber"),
        ],
        component: (
          <ThemeSettings
            matchesSearch={matchesSearch}
            colorScheme={colorScheme}
            setColorScheme={(scheme) => {
              if (
                scheme === "light" ||
                scheme === "dark" ||
                scheme === "auto"
              ) {
                setColorScheme(scheme);
              }
            }}
            colorVariant={colorVariant}
            setColorVariant={setColorVariant}
          />
        ),
      },
      {
        id: "datetime",
        icon: <IconClock size={16} />,
        labelKey: "settings.tabs.datetime",
        keywords: [
          t("settings.datetime.time_format"),
          "24 hour",
          "12 hour",
          t("settings.datetime.date_order"),
          t("settings.datetime.date_separator"),
          "mdy",
          "dmy",
          "ymd",
          "slash",
          "hyphen",
          "dot",
          "clock",
        ],
        component: (
          <DatetimeSettings
            matchesSearch={matchesSearch}
            timeFormat={timeFormat}
            dateOrder={dateOrder}
            dateSeparator={dateSeparator}
            setTimeFormat={setTimeFormat}
            setDateOrder={setDateOrder}
            setDateSeparator={setDateSeparator}
            timezone={timezone}
            setTimezone={setTimezone}
          />
        ),
      },
      {
        id: "daily",
        icon: <IconCalendar size={16} />,
        labelKey: "settings.tabs.daily_notes",
        keywords: [t("settings.daily_notes.path"), "folder", "path", "daily"],
        component: (
          <DailyNotesSettings
            matchesSearch={matchesSearch}
            dailyNotesPath={dailyNotesPath}
            setDailyNotesPath={setDailyNotesPath}
            dailyNoteTemplateId={dailyNoteTemplateId}
            setDailyNoteTemplateId={setDailyNoteTemplateId}
            pagesById={pagesById}
            pageIds={pageIds}
          />
        ),
      },
      {
        id: "homepage",
        icon: <IconHome size={16} />,
        labelKey: "settings.tabs.homepage",
        keywords: [
          t("settings.homepage.type"),
          t("settings.homepage.types.daily_note"),
          t("settings.homepage.types.index"),
          t("settings.homepage.types.custom_page"),
          t("settings.homepage.custom_page"),
          "start page",
          "default",
        ],
        component: (
          <HomepageSettings
            matchesSearch={matchesSearch}
            homepageType={homepageType}
            setHomepageType={(type) =>
              setHomepageType(type as "daily-note" | "index" | "custom-page")
            }
            customHomepageId={customHomepageId}
            setCustomHomepageId={setCustomHomepageId}
            pagesById={pagesById}
            pageIds={pageIds}
          />
        ),
      },
      {
        id: "outliner",
        icon: <IconList size={16} />,
        labelKey: "settings.tabs.outliner",
        keywords: [
          t("settings.outliner.indent_guides"),
          t("settings.outliner.auto_expand"),
          t("settings.outliner.block_count"),
          t("settings.outliner.code_block_line_numbers"),
          t("settings.outliner.indent_size"),
          t("common.search_keywords.blocks"),
          t("common.search_keywords.code_block"),
          "line numbers",
        ],
        component: (
          <OutlinerSettings
            matchesSearch={matchesSearch}
            showIndentGuides={showIndentGuides}
            toggleIndentGuides={toggleIndentGuides}
            autoExpandBlocks={autoExpandBlocks}
            setAutoExpandBlocks={setAutoExpandBlocks}
            showBlockCount={showBlockCount}
            setShowBlockCount={setShowBlockCount}
            showCodeBlockLineNumbers={showCodeBlockLineNumbers}
            setShowCodeBlockLineNumbers={setShowCodeBlockLineNumbers}
            indentSize={indentSize}
            setIndentSize={setIndentSize}
          />
        ),
      },
      {
        id: "git",
        icon: <IconBrandGit size={16} />,
        labelKey: "settings.tabs.version_control",
        keywords: [
          t("settings.git.title"),
          t("common.search_keywords.git"),
          t("common.search_keywords.repository"),
          t("common.search_keywords.commit"),
          t("settings.git.auto_commit"),
          t("settings.git.remote_repo"),
          t("common.search_keywords.push"),
          t("common.search_keywords.pull"),
          "interval",
          "status",
        ],
        component: (
          <GitSettings
            matchesSearch={matchesSearch}
            isGitRepo={isGitRepo}
            hasGitChanges={hasGitChanges}
            autoCommitEnabled={autoCommitEnabled}
            setAutoCommitEnabled={setAutoCommitEnabled}
            autoCommitInterval={autoCommitInterval}
            setAutoCommitInterval={setAutoCommitInterval}
            checkGitStatus={checkGitStatus}
            gitCommit={gitCommit}
            initGit={initGit}
            remoteUrl={remoteUrl}
            getRemoteUrl={getRemoteUrl}
            setRemoteUrl={setRemoteUrl}
            removeRemote={removeRemote}
            workspacePath={workspacePath}
          />
        ),
      },
      {
        id: "shortcuts",
        icon: <IconKeyboard size={16} />,
        labelKey: "settings.tabs.shortcuts",
        keywords: [
          t("settings.shortcuts.title"),
          t("common.search_keywords.hotkey"),
          t("settings.shortcuts.command_palette"),
          t("settings.shortcuts.search"),
          t("settings.shortcuts.toggle_index"),
          "help",
          "toggle",
        ],
        component: <ShortcutsSettings matchesSearch={matchesSearch} />,
      },
      {
        id: "advanced",
        icon: <IconSettings size={16} />,
        labelKey: "settings.tabs.advanced",
        keywords: [
          t("settings.advanced.updates"),
          "check updates",
          t("settings.advanced.telemetry"),
          t("settings.advanced.developer_options"),
          "reset settings",
          "danger",
          "database",
          "vacuum",
          "optimize",
          t("settings.advanced.vacuum_db_title"),
          t("settings.advanced.optimize_db_title"),
        ],
        component: (
          <AdvancedSettings
            matchesSearch={matchesSearch}
            telemetryEnabled={telemetryEnabled}
            setTelemetryEnabled={setTelemetryEnabled}
            resetAllSettings={resetAllSettings}
            clearCache={clearCache}
            vacuumDatabase={vacuumDatabase}
            optimizeDatabase={optimizeDatabase}
          />
        ),
      },
      {
        id: "about",
        icon: <IconSettings size={16} />,
        labelKey: "settings.tabs.about",
        keywords: [
          t("common.search_keywords.version"),
          t("common.search_keywords.changelog"),
          "oxinot",
          "info",
          "update",
          t("settings.about.updates_title"),
        ],
        component: (
          <AboutSettings
            matchesSearch={matchesSearch}
            appVersion={appVersion}
          />
        ),
      },
    ],
    [
      t,
      matchesSearch,
      fontFamily,
      setFontFamily,
      getFontStack,
      editorFontSize,
      setEditorFontSize,
      editorLineHeight,
      setEditorLineHeight,
      fontOptions,
      language,
      i18n.language,
      setLanguage,
      colorScheme,
      setColorScheme,
      colorVariant,
      setColorVariant,
      timeFormat,
      dateOrder,
      dateSeparator,
      setTimeFormat,
      setDateOrder,
      setDateSeparator,
      timezone,
      setTimezone,
      dailyNotesPath,
      setDailyNotesPath,
      dailyNoteTemplateId,
      setDailyNoteTemplateId,
      pagesById,
      pageIds,
      homepageType,
      setHomepageType,
      customHomepageId,
      setCustomHomepageId,
      showIndentGuides,
      toggleIndentGuides,
      autoExpandBlocks,
      setAutoExpandBlocks,
      showBlockCount,
      setShowBlockCount,
      showCodeBlockLineNumbers,
      setShowCodeBlockLineNumbers,
      indentSize,
      setIndentSize,
      isGitRepo,
      hasGitChanges,
      autoCommitEnabled,
      setAutoCommitEnabled,
      autoCommitInterval,
      setAutoCommitInterval,
      checkGitStatus,
      gitCommit,
      initGit,
      remoteUrl,
      getRemoteUrl,
      setRemoteUrl,
      removeRemote,
      workspacePath,
      telemetryEnabled,
      setTelemetryEnabled,
      resetAllSettings,
      clearCache,
      vacuumDatabase,
      optimizeDatabase,
      appVersion,
    ],
  );

  const filteredTabs = useMemo(() => {
    if (!searchQuery.trim()) return tabs;
    const query = searchQuery.toLowerCase();
    return tabs.filter((tab) => {
      const label = t(tab.labelKey).toLowerCase();
      if (label.includes(query)) return true;
      return tab.keywords.some((keyword) =>
        keyword.toLowerCase().includes(query),
      );
    });
  }, [tabs, searchQuery, t]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={tFromProps("common.settings")}
      size="xl"
      centered
      styles={{
        body: {
          padding: 0,
          height: "75vh",
          maxHeight: "750px",
        },
      }}
    >
      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        orientation="vertical"
        styles={{
          root: {
            display: "flex",
            height: "100%",
          },
          list: {
            borderRight: `1px solid ${
              isDark
                ? "var(--mantine-color-dark-6)"
                : "var(--mantine-color-gray-2)"
            }`,
            minWidth: 200,
            padding: 16,
            height: "auto",
            overflowY: "auto",
          },
          panel: {
            flex: 1,
            padding: "24px",
            height: "100%",
            overflowY: "auto",
          },
        }}
      >
        <Tabs.List>
          <Stack gap={0} w="100%">
            <TextInput
              placeholder={tFromProps("settings.search_placeholder")}
              leftSection={<IconSearch size={16} />}
              rightSection={
                searchQuery ? (
                  <Button
                    variant="subtle"
                    size="xs"
                    p={0}
                    onClick={() => setSearchQuery("")}
                    aria-label={tFromProps("common.clear_search")}
                  >
                    <IconX size={14} />
                  </Button>
                ) : null
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              mb={16}
              w="100%"
            />

            {searchQuery.trim() && filteredTabs.length === 0 && (
              <div className={styles.noResultsContainer}>
                <p className={styles.noResultsText}>
                  {t("settings.search_active")}
                </p>
              </div>
            )}

            {filteredTabs.map((tab) => (
              <Tabs.Tab key={tab.id} value={tab.id} leftSection={tab.icon}>
                {t(tab.labelKey)}
              </Tabs.Tab>
            ))}
          </Stack>
        </Tabs.List>

        <div className={styles.contentWrapper}>
          {tabs.map((tab) => (
            <Tabs.Panel key={tab.id} value={tab.id}>
              {tab.component}
            </Tabs.Panel>
          ))}
        </div>
      </Tabs>
    </Modal>
  );
}
