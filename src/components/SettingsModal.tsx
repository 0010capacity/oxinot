import {
  Modal,
  Tabs,
  TextInput,
  Stack,
  Button,
  useMantineColorScheme,
} from "@mantine/core";
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
import { useEffect, useState } from "react";
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
}

export function SettingsModal({
  opened,
  onClose,
  workspacePath,
  pagesById,
  pageIds,
}: SettingsModalProps) {
  const { t, i18n } = useTranslation();
  const { colorScheme, setColorScheme } = useMantineColorScheme();

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
    (state) => state.telemetryEnabled
  );
  const setTelemetryEnabled = useAdvancedSettingsStore(
    (state) => state.setTelemetryEnabled
  );
  const resetAllSettings = useAdvancedSettingsStore(
    (state) => state.resetAllSettings
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
    (state) => state.editorLineHeight || 1.6
  );
  const setEditorLineHeight = useThemeStore(
    (state) => state.setEditorLineHeight
  );

  // Clock Format
  const timeFormat = useClockFormatStore((state) => state.timeFormat);
  const dateOrder = useClockFormatStore((state) => state.dateOrder);
  const dateSeparator = useClockFormatStore((state) => state.dateSeparator);
  const setTimeFormat = useClockFormatStore((state) => state.setTimeFormat);
  const setDateOrder = useClockFormatStore((state) => state.setDateOrder);
  const setDateSeparator = useClockFormatStore(
    (state) => state.setDateSeparator
  );
  const timezone = useClockFormatStore((state) => state.timezone);
  const setTimezone = useClockFormatStore((state) => state.setTimezone);

  // App Settings
  const dailyNotesPath = useAppSettingsStore((state) => state.dailyNotesPath);
  const setDailyNotesPath = useAppSettingsStore(
    (state) => state.setDailyNotesPath
  );
  const homepageType = useAppSettingsStore((state) => state.homepageType);
  const setHomepageType = useAppSettingsStore((state) => state.setHomepageType);
  const customHomepageId = useAppSettingsStore(
    (state) => state.customHomepageId
  );
  const setCustomHomepageId = useAppSettingsStore(
    (state) => state.setCustomHomepageId
  );
  const language = useAppSettingsStore((state) => state.language);
  const setLanguage = useAppSettingsStore((state) => state.setLanguage);

  // Outliner
  const showIndentGuides = useOutlinerSettingsStore(
    (state) => state.showIndentGuides
  );
  const toggleIndentGuides = useOutlinerSettingsStore(
    (state) => state.toggleIndentGuides
  );
  const autoExpandBlocks = useOutlinerSettingsStore(
    (state) => state.autoExpandBlocks ?? true
  );
  const setAutoExpandBlocks = useOutlinerSettingsStore(
    (state) => state.setAutoExpandBlocks
  );
  const showBlockCount = useOutlinerSettingsStore(
    (state) => state.showBlockCount ?? false
  );
  const setShowBlockCount = useOutlinerSettingsStore(
    (state) => state.setShowBlockCount
  );
  const showCodeBlockLineNumbers = useOutlinerSettingsStore(
    (state) => state.showCodeBlockLineNumbers ?? true
  );
  const setShowCodeBlockLineNumbers = useOutlinerSettingsStore(
    (state) => state.setShowCodeBlockLineNumbers
  );
  const indentSize = useOutlinerSettingsStore((state) => state.indentSize);
  const setIndentSize = useOutlinerSettingsStore(
    (state) => state.setIndentSize
  );
  const metadataDisplayStyle = useOutlinerSettingsStore(
    (state) => state.metadataDisplayStyle
  );
  const setMetadataDisplayStyle = useOutlinerSettingsStore(
    (state) => state.setMetadataDisplayStyle
  );

  // Git
  const isGitRepo = useGitStore((state) => state.isRepo);
  const hasGitChanges = useGitStore((state) => state.hasChanges);
  const autoCommitEnabled = useGitStore((state) => state.autoCommitEnabled);
  const setAutoCommitEnabled = useGitStore(
    (state) => state.setAutoCommitEnabled
  );
  const autoCommitInterval = useGitStore((state) => state.autoCommitInterval);
  const setAutoCommitInterval = useGitStore(
    (state) => state.setAutoCommitInterval
  );
  const checkGitStatus = useGitStore((state) => state.checkStatus);
  const gitCommit = useGitStore((state) => state.commit);
  const initGit = useGitStore((state) => state.initGit);
  const remoteUrl = useGitStore((state) => state.remoteUrl);
  const getRemoteUrl = useGitStore((state) => state.getRemoteUrl);
  const setRemoteUrl = useGitStore((state) => state.setRemoteUrl);
  const removeRemote = useGitStore((state) => state.removeRemote);

  const matchesSearch = (text: string) => {
    if (!searchQuery.trim()) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const hasMatchInTab = (tabValue: string) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();

    // Define searchable content for each tab
    const tabContent: Record<string, string[]> = {
      appearance: [
        t("settings.appearance.font_family").toLowerCase(),
        t("settings.appearance.editor_font_size").toLowerCase(),
        t("settings.appearance.editor_line_height").toLowerCase(),
        t("common.search_keywords.typography").toLowerCase(),
        "inter",
        "system",
        "roboto",
        t("common.search_keywords.monospace").toLowerCase(),
        "preview",
      ],
      theme: [
        t("settings.theme.color_mode").toLowerCase(),
        t("settings.theme.modes.light").toLowerCase(),
        t("settings.theme.modes.dark").toLowerCase(),
        t("settings.theme.modes.auto").toLowerCase(),
        t("settings.theme.color_variant").toLowerCase(),
        "accent",
        t("settings.theme.variants.default").toLowerCase(),
        t("settings.theme.variants.blue").toLowerCase(),
        t("settings.theme.variants.purple").toLowerCase(),
        t("settings.theme.variants.green").toLowerCase(),
        t("settings.theme.variants.amber").toLowerCase(),
      ],
      datetime: [
        t("settings.datetime.time_format").toLowerCase(),
        "24 hour",
        "12 hour",
        t("settings.datetime.date_order").toLowerCase(),
        t("settings.datetime.date_separator").toLowerCase(),
        "mdy",
        "dmy",
        "ymd",
        "slash",
        "hyphen",
        "dot",
        "clock",
      ],
      daily: [
        t("settings.daily_notes.path").toLowerCase(),
        "folder",
        "path",
        "daily",
      ],
      homepage: [
        t("settings.homepage.type").toLowerCase(),
        t("settings.homepage.types.daily_note").toLowerCase(),
        t("settings.homepage.types.index").toLowerCase(),
        t("settings.homepage.types.custom_page").toLowerCase(),
        t("settings.homepage.custom_page").toLowerCase(),
        "start page",
        "default",
      ],
      outliner: [
        t("settings.outliner.indent_guides").toLowerCase(),
        t("settings.outliner.auto_expand").toLowerCase(),
        t("settings.outliner.block_count").toLowerCase(),
        t("settings.outliner.code_block_line_numbers").toLowerCase(),
        t("settings.outliner.indent_size").toLowerCase(),
        t("common.search_keywords.blocks").toLowerCase(),
        t("common.search_keywords.code_block").toLowerCase(),
        "line numbers",
      ],
      git: [
        t("settings.git.title").toLowerCase(),
        t("common.search_keywords.git").toLowerCase(),
        t("common.search_keywords.repository").toLowerCase(),
        t("common.search_keywords.commit").toLowerCase(),
        t("settings.git.auto_commit").toLowerCase(),
        t("settings.git.remote_repo").toLowerCase(),
        t("common.search_keywords.push").toLowerCase(),
        t("common.search_keywords.pull").toLowerCase(),
        "interval",
        "status",
      ],
      shortcuts: [
        t("settings.shortcuts.title").toLowerCase(),
        t("common.search_keywords.hotkey").toLowerCase(),
        t("settings.shortcuts.command_palette").toLowerCase(),
        t("settings.shortcuts.search").toLowerCase(),
        t("settings.shortcuts.toggle_index").toLowerCase(),
        "help",
        "toggle",
      ],
      advanced: [
        t("settings.advanced.updates").toLowerCase(),
        "check updates",
        t("settings.advanced.telemetry").toLowerCase(),
        t("settings.advanced.developer_options").toLowerCase(),
        t("settings.advanced.reset_settings").toLowerCase(),
        "danger",
      ],
      about: [
        t("common.search_keywords.version").toLowerCase(),
        t("common.search_keywords.changelog").toLowerCase(),
        "oxinot",
        "info",
        "update",
        t("settings.about.updates_title").toLowerCase(),
      ],
      language: [
        t("settings.language.title").toLowerCase(),
        t("common.search_keywords.english").toLowerCase(),
        t("common.search_keywords.korean").toLowerCase(),
        t("common.search_keywords.locale").toLowerCase(),
      ],
    };

    return tabContent[tabValue]?.some((item) => item.includes(query)) ?? false;
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("common.settings")}
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
            borderRight: "1px solid var(--mantine-color-gray-2)",
            minWidth: 200,
            padding: 16,
            height: "100%",
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
              placeholder={t("settings.search_placeholder")}
              leftSection={<IconSearch size={16} />}
              rightSection={
                searchQuery ? (
                  <Button
                    variant="subtle"
                    size="xs"
                    p={0}
                    onClick={() => setSearchQuery("")}
                  >
                    <IconX size={14} />
                  </Button>
                ) : null
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              mb={16}
            />

            {searchQuery.trim() &&
              !Object.values({
                appearance: hasMatchInTab("appearance"),
                language: hasMatchInTab("language"),
                theme: hasMatchInTab("theme"),
                datetime: hasMatchInTab("datetime"),
                daily: hasMatchInTab("daily"),
                homepage: hasMatchInTab("homepage"),
                outliner: hasMatchInTab("outliner"),
                git: hasMatchInTab("git"),
                shortcuts: hasMatchInTab("shortcuts"),
                advanced: hasMatchInTab("advanced"),
                about: hasMatchInTab("about"),
              }).some((v) => v) && (
                <div style={{ padding: 8, marginBottom: 12 }}>
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--mantine-color-gray-6)",
                    }}
                  >
                    {t("settings.search_active")}
                  </p>
                </div>
              )}

            {hasMatchInTab("appearance") && (
              <Tabs.Tab
                value="appearance"
                leftSection={<IconAppWindow size={16} />}
              >
                {t("settings.tabs.appearance")}
              </Tabs.Tab>
            )}

            {hasMatchInTab("language") && (
              <Tabs.Tab
                value="language"
                leftSection={<IconLanguage size={16} />}
              >
                {t("settings.tabs.language")}
              </Tabs.Tab>
            )}

            {hasMatchInTab("theme") && (
              <Tabs.Tab value="theme" leftSection={<IconPalette size={16} />}>
                {t("settings.tabs.theme")}
              </Tabs.Tab>
            )}

            {hasMatchInTab("datetime") && (
              <Tabs.Tab value="datetime" leftSection={<IconClock size={16} />}>
                {t("settings.tabs.datetime")}
              </Tabs.Tab>
            )}

            {hasMatchInTab("daily") && (
              <Tabs.Tab value="daily" leftSection={<IconCalendar size={16} />}>
                {t("settings.tabs.daily_notes")}
              </Tabs.Tab>
            )}

            {hasMatchInTab("homepage") && (
              <Tabs.Tab value="homepage" leftSection={<IconHome size={16} />}>
                {t("settings.tabs.homepage")}
              </Tabs.Tab>
            )}

            {hasMatchInTab("outliner") && (
              <Tabs.Tab value="outliner" leftSection={<IconList size={16} />}>
                {t("settings.tabs.outliner")}
              </Tabs.Tab>
            )}

            {hasMatchInTab("git") && (
              <Tabs.Tab value="git" leftSection={<IconBrandGit size={16} />}>
                {t("settings.tabs.version_control")}
              </Tabs.Tab>
            )}

            {hasMatchInTab("shortcuts") && (
              <Tabs.Tab
                value="shortcuts"
                leftSection={<IconKeyboard size={16} />}
              >
                {t("settings.tabs.shortcuts")}
              </Tabs.Tab>
            )}

            {hasMatchInTab("advanced") && (
              <Tabs.Tab
                value="advanced"
                leftSection={<IconSettings size={16} />}
              >
                {t("settings.tabs.advanced")}
              </Tabs.Tab>
            )}

            {hasMatchInTab("about") && (
              <Tabs.Tab value="about" leftSection={<IconSettings size={16} />}>
                {t("settings.tabs.about")}
              </Tabs.Tab>
            )}
          </Stack>
        </Tabs.List>

        <div
          style={{
            flex: 1,
            padding: "24px",
            height: "100%",
            overflowY: "auto",
          }}
        >
          <Tabs.Panel value="appearance">
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
          </Tabs.Panel>

          <Tabs.Panel value="language">
            <LanguageSettings
              matchesSearch={matchesSearch}
              language={language}
              i18nLanguage={i18n.language}
              setLanguage={setLanguage}
            />
          </Tabs.Panel>

          <Tabs.Panel value="theme">
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
          </Tabs.Panel>

          <Tabs.Panel value="datetime">
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
          </Tabs.Panel>

          <Tabs.Panel value="daily">
            <DailyNotesSettings
              matchesSearch={matchesSearch}
              dailyNotesPath={dailyNotesPath}
              setDailyNotesPath={setDailyNotesPath}
            />
          </Tabs.Panel>

          <Tabs.Panel value="homepage">
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
          </Tabs.Panel>

          <Tabs.Panel value="outliner">
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
              metadataDisplayStyle={metadataDisplayStyle}
              setMetadataDisplayStyle={(style) =>
                setMetadataDisplayStyle(style as "property" | "box")
              }
            />
          </Tabs.Panel>

          <Tabs.Panel value="git">
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
          </Tabs.Panel>

          <Tabs.Panel value="shortcuts">
            <ShortcutsSettings matchesSearch={matchesSearch} />
          </Tabs.Panel>

          <Tabs.Panel value="advanced">
            <AdvancedSettings
              matchesSearch={matchesSearch}
              telemetryEnabled={telemetryEnabled}
              setTelemetryEnabled={setTelemetryEnabled}
              resetAllSettings={resetAllSettings}
              clearCache={clearCache}
            />
          </Tabs.Panel>

          <Tabs.Panel value="about">
            <AboutSettings
              matchesSearch={matchesSearch}
              appVersion={appVersion}
            />
          </Tabs.Panel>
        </div>
      </Tabs>
    </Modal>
  );
}
