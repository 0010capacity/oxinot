import {
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  Slider,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import {
  IconAppWindow,
  IconBrandGit,
  IconCalendar,
  IconClock,
  IconDownload,
  IconHome,
  IconKeyboard,
  IconLanguage,
  IconList,
  IconPalette,
  IconPlus,
  IconSearch,
  IconSettings,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAdvancedSettingsStore } from "../stores/advancedSettingsStore";
import { useAppSettingsStore } from "../stores/appSettingsStore";
import {
  type DateOrder,
  type DateSeparator,
  type TimeFormat,
  useClockFormatStore,
} from "../stores/clockFormatStore";
import { useGitStore } from "../stores/gitStore";
import { useOutlinerSettingsStore } from "../stores/outlinerSettingsStore";
import {
  type ColorVariant,
  type FontFamily,
  useThemeStore,
} from "../stores/themeStore";

const FONT_OPTIONS: Array<{ label: string; value: FontFamily }> = [
  { label: "System Default", value: "system" },
  { label: "Inter", value: "inter" },
  { label: "SF Pro", value: "sf-pro" },
  { label: "Roboto", value: "roboto" },
  { label: "Open Sans", value: "open-sans" },
  { label: "Lato", value: "lato" },
  { label: "Source Sans Pro", value: "source-sans" },
  { label: "Noto Sans", value: "noto-sans" },
  { label: "IBM Plex Sans", value: "ibm-plex" },
  { label: "JetBrains Mono", value: "jetbrains-mono" },
  { label: "Fira Code", value: "fira-code" },
  { label: "Cascadia Code", value: "cascadia" },
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
  const computedColorScheme = useComputedColorScheme("light");
  const isDark = computedColorScheme === "dark";

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("appearance");

  // Advanced settings
  const autoUpdate = useAdvancedSettingsStore((state) => state.autoUpdate);
  const setAutoUpdate = useAdvancedSettingsStore(
    (state) => state.setAutoUpdate,
  );
  const checkUpdatesOnStartup = useAdvancedSettingsStore(
    (state) => state.checkUpdatesOnStartup,
  );
  const setCheckUpdatesOnStartup = useAdvancedSettingsStore(
    (state) => state.setCheckUpdatesOnStartup,
  );
  const betaUpdates = useAdvancedSettingsStore((state) => state.betaUpdates);
  const setBetaUpdates = useAdvancedSettingsStore(
    (state) => state.setBetaUpdates,
  );
  const telemetryEnabled = useAdvancedSettingsStore(
    (state) => state.telemetryEnabled,
  );
  const setTelemetryEnabled = useAdvancedSettingsStore(
    (state) => state.setTelemetryEnabled,
  );
  const resetAllSettings = useAdvancedSettingsStore(
    (state) => state.resetAllSettings,
  );

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
  const homepageType = useAppSettingsStore((state) => state.homepageType);
  const setHomepageType = useAppSettingsStore((state) => state.setHomepageType);
  const customHomepageId = useAppSettingsStore(
    (state) => state.customHomepageId,
  );
  const setCustomHomepageId = useAppSettingsStore(
    (state) => state.setCustomHomepageId,
  );

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
  const clearCache = useAdvancedSettingsStore((state) => state.clearCache);

  // Remote URL management state
  const [remoteUrlInput, setRemoteUrlInput] = useState("");
  const [isEditingRemote, setIsEditingRemote] = useState(false);

  const handleGitCommit = async () => {
    if (!workspacePath || !hasGitChanges) return;
    const timestamp = new Date().toISOString();
    try {
      await gitCommit(workspacePath, `Auto-save: ${timestamp}`);
    } catch (error) {
      console.error("Commit failed:", error);
    }
  };

  const handleSetRemoteUrl = async () => {
    if (!workspacePath || !remoteUrlInput.trim()) return;
    try {
      await setRemoteUrl(workspacePath, remoteUrlInput.trim());
      setIsEditingRemote(false);
      setRemoteUrlInput("");
    } catch (error) {
      console.error("Failed to set remote URL:", error);
    }
  };

  const handleRemoveRemote = async () => {
    if (!workspacePath) return;
    if (
      window.confirm(t("settings.git.remove_remote_confirm"))
    ) {
      try {
        await removeRemote(workspacePath);
      } catch (error) {
        console.error("Failed to remove remote:", error);
      }
    }
  };

  // Load remote URL when opening settings
  useEffect(() => {
    if (workspacePath && isGitRepo) {
      getRemoteUrl(workspacePath);
    }
  }, [workspacePath, isGitRepo, getRemoteUrl]);

  // Search functionality - search within actual setting items
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
        "typography",
        "inter",
        "system",
        "roboto",
        "monospace",
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
        "blocks",
        "code block",
        "line numbers",
      ],
      git: [
        t("settings.git.title").toLowerCase(),
        "git",
        "repository",
        "commit",
        t("settings.git.auto_commit").toLowerCase(),
        t("settings.git.remote_repo").toLowerCase(),
        "push",
        "pull",
        "interval",
        "status",
      ],
      shortcuts: [
        t("settings.shortcuts.title").toLowerCase(),
        "hotkey",
        t("settings.shortcuts.command_palette").toLowerCase(),
        t("settings.shortcuts.search").toLowerCase(),
        t("settings.shortcuts.toggle_index").toLowerCase(),
        "help",
        "toggle",
      ],
      advanced: [
        t("settings.advanced.updates").toLowerCase(),
        t("settings.advanced.beta_updates").toLowerCase(),
        "check updates",
        t("settings.advanced.telemetry").toLowerCase(),
        t("settings.advanced.developer_options").toLowerCase(),
        t("settings.advanced.reset_settings").toLowerCase(),
        "danger",
      ],
      about: [
        "version",
        "changelog",
        "beta",
        "oxinot",
        "info",
        "update",
        t("settings.about.updates_title").toLowerCase(),
      ],
      language: [
        t("settings.language.title").toLowerCase(),
        "english",
        "korean",
        "locale",
      ],
    };

    return tabContent[tabValue]?.some((item) => item.includes(query)) ?? false;
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <Text size="lg" fw={600}>
            {t("settings.title")}
          </Text>
          <Badge size="sm" variant="light" color="blue">
            {t("settings.beta")}
          </Badge>
        </Group>
      }
      size="xl"
      styles={{
        body: {
          padding: 0,
          height: "75vh",
          maxHeight: "750px",
        },
      }}
    >
      {/* Search Bar */}
      <div
        style={{
          padding: "16px 24px",
          borderBottom: `1px solid ${isDark ? "#2C2E33" : "#DEE2E6"}`,
        }}
      >
        <TextInput
          placeholder={t("settings.search_placeholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          leftSection={<IconSearch size={16} />}
          rightSection={
            searchQuery && (
              <IconX
                size={16}
                style={{ cursor: "pointer" }}
                onClick={() => setSearchQuery("")}
              />
            )
          }
        />
        {searchQuery && (
          <Text size="xs" c="dimmed" mt={8}>
            {t("settings.search_active")}
          </Text>
        )}
      </div>
      <Tabs
        value={activeTab}
        onChange={(value) => setActiveTab(value || "appearance")}
        orientation="vertical"
        style={{ height: "calc(100% - 70px)" }}
      >
        <Tabs.List
          style={{
            borderRight: `1px solid ${isDark ? "#2C2E33" : "#DEE2E6"}`,
            minWidth: 200,
            padding: "12px 8px",
            height: "100%",
            overflowY: "auto",
          }}
        >
          {hasMatchInTab("appearance") && (
            <Tabs.Tab
              value="appearance"
              leftSection={<IconAppWindow size={16} />}
            >
              {t("settings.tabs.appearance")}
            </Tabs.Tab>
          )}
          {hasMatchInTab("language") && (
            <Tabs.Tab value="language" leftSection={<IconLanguage size={16} />}>
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
            <Tabs.Tab value="advanced" leftSection={<IconSettings size={16} />}>
              {t("settings.tabs.advanced")}
            </Tabs.Tab>
          )}
          {hasMatchInTab("about") && (
            <Tabs.Tab value="about" leftSection={<IconSettings size={16} />}>
              {t("settings.tabs.about")}
            </Tabs.Tab>
          )}
        </Tabs.List>

        <div
          style={{
            flex: 1,
            padding: "24px",
            height: "100%",
            overflowY: "auto",
          }}
        >
          {/* Appearance Tab */}
          <Tabs.Panel value="appearance">
            <Stack gap="xl">
              <div>
                <Text size="xl" fw={600} mb="lg">
                  {t("settings.appearance.title")}
                </Text>
                <Text size="sm" c="dimmed" mb="xl">
                  {t("settings.appearance.description")}
                </Text>

                <Stack gap="lg">
                  {matchesSearch(t("settings.appearance.font_family")) && (
                    <div>
                      <Text size="sm" fw={500} mb={8}>
                        {t("settings.appearance.font_family")}
                      </Text>
                      <Select
                        value={fontFamily}
                        onChange={(value) => {
                          if (value) setFontFamily(value as FontFamily);
                        }}
                        data={FONT_OPTIONS}
                        placeholder={t("settings.appearance.font_family")}
                        searchable
                      />
                      <Text size="xs" c="dimmed" mt={4}>
                        {t("settings.appearance.font_family_desc")}
                      </Text>
                      <div
                        style={{
                          marginTop: 12,
                          padding: 16,
                          borderRadius: 6,
                          backgroundColor: isDark ? "#2C2E33" : "#F1F3F5",
                          fontFamily: getFontStack(),
                        }}
                      >
                        <Text size="sm" style={{ fontFamily: getFontStack() }}>
                          The quick brown fox jumps over the lazy dog
                        </Text>
                        <Text
                          size="xs"
                          c="dimmed"
                          mt={4}
                          style={{ fontFamily: getFontStack() }}
                        >
                          0123456789 !@#$%^&*()
                        </Text>
                      </div>
                    </div>
                  )}

                  {matchesSearch(t("settings.appearance.editor_font_size")) && (
                    <div>
                      <Text size="sm" fw={500} mb={8}>
                        {t("settings.appearance.editor_font_size")}
                      </Text>
                      <Group gap="md" align="center">
                        <Slider
                          value={editorFontSize}
                          onChange={setEditorFontSize}
                          min={12}
                          max={24}
                          step={1}
                          marks={[
                            { value: 12, label: "12" },
                            { value: 16, label: "16" },
                            { value: 20, label: "20" },
                            { value: 24, label: "24" },
                          ]}
                          style={{ flex: 1 }}
                        />
                        <Text
                          size="sm"
                          fw={500}
                          style={{ minWidth: 50, textAlign: "right" }}
                        >
                          {editorFontSize}px
                        </Text>
                      </Group>
                      <Text size="xs" c="dimmed" mt={4}>
                        {t("settings.appearance.editor_font_size_desc")}
                      </Text>
                    </div>
                  )}

                  {matchesSearch(
                    t("settings.appearance.editor_line_height"),
                  ) && (
                    <div>
                      <Text size="sm" fw={500} mb={8}>
                        {t("settings.appearance.editor_line_height")}
                      </Text>
                      <Group gap="md" align="center">
                        <Slider
                          value={editorLineHeight}
                          onChange={setEditorLineHeight}
                          min={1.2}
                          max={2.0}
                          step={0.1}
                          marks={[
                            { value: 1.2, label: "1.2" },
                            { value: 1.6, label: "1.6" },
                            { value: 2.0, label: "2.0" },
                          ]}
                          style={{ flex: 1 }}
                        />
                        <Text
                          size="sm"
                          fw={500}
                          style={{ minWidth: 50, textAlign: "right" }}
                        >
                          {editorLineHeight.toFixed(1)}
                        </Text>
                      </Group>
                      <Text size="xs" c="dimmed" mt={4}>
                        {t("settings.appearance.editor_line_height_desc")}
                      </Text>
                    </div>
                  )}
                </Stack>
              </div>
            </Stack>
          </Tabs.Panel>

          {/* Language Tab */}
          <Tabs.Panel value="language">
            <Stack gap="xl">
              <div>
                <Text size="xl" fw={600} mb="lg">
                  {t("settings.tabs.language")}
                </Text>
                <Text size="sm" c="dimmed" mb="xl">
                  {t("settings.language.description")}
                </Text>

                <Stack gap="lg">
                  <div>
                    <Text size="sm" fw={500} mb={8}>
                      {t("settings.language.select")}
                    </Text>
                    <Select
                      value={i18n.language}
                      onChange={(value) => i18n.changeLanguage(value || "en")}
                      data={[
                        { label: "English", value: "en" },
                        { label: "한국어", value: "ko" },
                      ]}
                      allowDeselect={false}
                    />
                  </div>
                </Stack>
              </div>
            </Stack>
          </Tabs.Panel>

          {/* Theme Tab */}
          <Tabs.Panel value="theme">
            <Stack gap="xl">
              <div>
                <Text size="xl" fw={600} mb="lg">
                  {t("settings.theme.title")}
                </Text>

                <Stack gap="lg">
                  {matchesSearch(t("settings.theme.color_mode")) && (
                    <div>
                      <Text size="sm" fw={500} mb={8}>
                        {t("settings.theme.color_mode")}
                      </Text>
                      <SegmentedControl
                        value={colorScheme}
                        onChange={(value) => {
                          if (
                            value === "light" ||
                            value === "dark" ||
                            value === "auto"
                          ) {
                            setColorScheme(value);
                          }
                        }}
                        data={[
                          {
                            label: t("settings.theme.modes.light"),
                            value: "light",
                          },
                          {
                            label: t("settings.theme.modes.dark"),
                            value: "dark",
                          },
                          {
                            label: t("settings.theme.modes.auto"),
                            value: "auto",
                          },
                        ]}
                        fullWidth
                      />
                    </div>
                  )}

                  {matchesSearch(t("settings.theme.color_variant")) && (
                    <div>
                      <Text size="sm" fw={500} mb={8}>
                        {t("settings.theme.color_variant")}
                      </Text>
                      <SegmentedControl
                        value={colorVariant}
                        onChange={(value) =>
                          setColorVariant(value as ColorVariant)
                        }
                        data={[
                          {
                            label: t("settings.theme.variants.default"),
                            value: "default",
                          },
                          {
                            label: t("settings.theme.variants.blue"),
                            value: "blue",
                          },
                          {
                            label: t("settings.theme.variants.purple"),
                            value: "purple",
                          },
                          {
                            label: t("settings.theme.variants.green"),
                            value: "green",
                          },
                          {
                            label: t("settings.theme.variants.amber"),
                            value: "amber",
                          },
                        ]}
                        fullWidth
                      />
                    </div>
                  )}
                </Stack>
              </div>
            </Stack>
          </Tabs.Panel>

          {/* DateTime Tab */}

          {/* Date & Time Tab */}
          <Tabs.Panel value="datetime">
            <Stack gap="xl">
              <div>
                <Text size="xl" fw={600} mb="lg">
                  {t("settings.datetime.title")}
                </Text>
                <Text size="sm" c="dimmed" mb="xl">
                  {t("settings.datetime.description")}
                </Text>

                <Stack gap="lg">
                  {matchesSearch(t("settings.datetime.time_format")) && (
                    <div>
                      <Text size="sm" fw={500} mb={8}>
                        {t("settings.datetime.time_format")}
                      </Text>
                      <Select
                        value={timeFormat}
                        onChange={(value) => setTimeFormat(value as TimeFormat)}
                        data={[
                          { label: "24-Hour (13:34)", value: "24h" },
                          { label: "12-Hour (01:34 PM)", value: "12h" },
                        ]}
                        placeholder={t("settings.datetime.time_format")}
                      />
                    </div>
                  )}

                  {matchesSearch(t("settings.datetime.date_order")) && (
                    <div>
                      <Text size="sm" fw={500} mb={8}>
                        {t("settings.datetime.date_order")}
                      </Text>
                      <Select
                        value={dateOrder}
                        onChange={(value) => setDateOrder(value as DateOrder)}
                        data={[
                          { label: "Month/Day/Year (MDY)", value: "MDY" },
                          { label: "Day/Month/Year (DMY)", value: "DMY" },
                          { label: "Year/Month/Day (YMD)", value: "YMD" },
                        ]}
                        placeholder={t("settings.datetime.date_order")}
                      />
                      <Text size="xs" c="dimmed" mt={4}>
                        {t("settings.datetime.date_separator_desc")}
                      </Text>
                    </div>
                  )}

                  {matchesSearch(t("settings.datetime.date_separator")) && (
                    <div>
                      <Text size="sm" fw={500} mb={8}>
                        {t("settings.datetime.date_separator")}
                      </Text>
                      <Select
                        value={dateSeparator}
                        onChange={(value) =>
                          setDateSeparator(value as DateSeparator)
                        }
                        data={[
                          { label: "Slash (/)", value: "/" },
                          { label: "Hyphen (-)", value: "-" },
                          { label: "Dot (.)", value: "." },
                        ]}
                        placeholder={t("settings.datetime.date_separator")}
                      />
                    </div>
                  )}

                  {matchesSearch(t("settings.datetime.timezone")) && (
                    <div>
                      <Text size="sm" fw={500} mb={8}>
                        {t("settings.datetime.timezone")}
                      </Text>
                      <Select
                        value={timezone}
                        onChange={(value) => {
                          if (value) setTimezone(value);
                        }}
                        data={(() => {
                          const systemTz =
                            Intl.DateTimeFormat().resolvedOptions().timeZone;
                          const timezones = [
                            { label: "UTC", value: "UTC" },
                            {
                              label: "America/New_York (EST)",
                              value: "America/New_York",
                            },
                            {
                              label: "America/Chicago (CST)",
                              value: "America/Chicago",
                            },
                            {
                              label: "America/Denver (MST)",
                              value: "America/Denver",
                            },
                            {
                              label: "America/Los_Angeles (PST)",
                              value: "America/Los_Angeles",
                            },
                            {
                              label: "Europe/London (GMT)",
                              value: "Europe/London",
                            },
                            {
                              label: "Europe/Paris (CET)",
                              value: "Europe/Paris",
                            },
                            {
                              label: "Europe/Berlin (CET)",
                              value: "Europe/Berlin",
                            },
                            {
                              label: "Asia/Seoul (KST)",
                              value: "Asia/Seoul",
                            },
                            {
                              label: "Asia/Tokyo (JST)",
                              value: "Asia/Tokyo",
                            },
                            {
                              label: "Asia/Shanghai (CST)",
                              value: "Asia/Shanghai",
                            },
                            {
                              label: "Asia/Hong_Kong (HKT)",
                              value: "Asia/Hong_Kong",
                            },
                            {
                              label: "Asia/Singapore (SGT)",
                              value: "Asia/Singapore",
                            },
                            {
                              label: "Australia/Sydney (AEDT)",
                              value: "Australia/Sydney",
                            },
                          ];
                          const systemTzExists = timezones.some(
                            (tz) => tz.value === systemTz,
                          );
                          return systemTzExists
                            ? timezones
                            : [
                                {
                                  label: `System Default (${systemTz})`,
                                  value: systemTz,
                                },
                                ...timezones,
                              ];
                        })()}
                        placeholder={t("settings.datetime.timezone")}
                        searchable
                      />
                    </div>
                  )}

                  {matchesSearch(t("settings.datetime.preview")) && (
                    <div
                      style={{
                        padding: 16,
                        borderRadius: 6,
                        backgroundColor: isDark ? "#2C2E33" : "#F1F3F5",
                      }}
                    >
                      <Text size="sm" fw={500} mb={4}>
                        {t("settings.datetime.preview")}
                      </Text>
                      <Text size="sm">
                        {useClockFormatStore.getState().formatDate(new Date())}{" "}
                        |{" "}
                        {useClockFormatStore.getState().formatTime(new Date())}
                      </Text>
                    </div>
                  )}
                </Stack>
              </div>
            </Stack>
          </Tabs.Panel>

          {/* Daily Notes Tab */}
          <Tabs.Panel value="daily">
            <Stack gap="xl">
              <div>
                <Text size="xl" fw={600} mb="lg">
                  {t("settings.daily_notes.title")}
                </Text>
                <Text size="sm" c="dimmed" mb="xl">
                  {t("settings.daily_notes.description")}
                </Text>

                <Stack gap="lg">
                  {matchesSearch("Daily Notes Path folder") && (
                    <div>
                      <Text size="sm" fw={500} mb={8}>
                        {t("settings.daily_notes.path")}
                      </Text>
                      <TextInput
                        value={dailyNotesPath}
                        onChange={(event) =>
                          setDailyNotesPath(event.currentTarget.value)
                        }
                        placeholder={t("settings.daily_notes.path_placeholder")}
                        description={t("settings.daily_notes.path_desc")}
                      />
                    </div>
                  )}
                </Stack>
              </div>
            </Stack>
          </Tabs.Panel>

          {/* Homepage Tab */}
          <Tabs.Panel value="homepage">
            <Stack gap="xl">
              <div>
                <Text size="xl" fw={600} mb="lg">
                  {t("settings.homepage.title")}
                </Text>
                <Text size="sm" c="dimmed" mb="xl">
                  {t("settings.homepage.description")}
                </Text>

                <Stack gap="lg">
                  {matchesSearch("Homepage Type start default") && (
                    <div>
                      <Text size="sm" fw={500} mb={8}>
                        {t("settings.homepage.type")}
                      </Text>
                      <Select
                        value={homepageType}
                        onChange={(value) =>
                          setHomepageType(
                            value as "daily-note" | "index" | "custom-page",
                          )
                        }
                        data={[
                          { label: t("settings.homepage.types.daily_note"), value: "daily-note" },
                          { label: t("settings.homepage.types.index"), value: "index" },
                          { label: t("settings.homepage.types.custom_page"), value: "custom-page" },
                        ]}
                        placeholder={t("settings.homepage.type_placeholder")}
                      />
                      <Text size="xs" c="dimmed" mt={4}>
                        {t("settings.homepage.type_desc")}
                      </Text>
                    </div>
                  )}

                  {homepageType === "custom-page" && (
                    <div>
                      <Text size="sm" fw={500} mb={8}>
                        {t("settings.homepage.custom_page")}
                      </Text>
                      <Select
                        value={customHomepageId || ""}
                        onChange={(value) => setCustomHomepageId(value || null)}
                        data={pageIds.map((id) => ({
                          label: pagesById[id]?.title || id,
                          value: id,
                        }))}
                        placeholder={t("settings.homepage.custom_page_placeholder")}
                        searchable
                      />
                    </div>
                  )}
                </Stack>
              </div>
            </Stack>
          </Tabs.Panel>

          {/* Outliner Tab */}
          <Tabs.Panel value="outliner">
            <Stack gap="xl">
              <div>
                <Text size="xl" fw={600} mb="lg">
                  {t("settings.outliner.title")}
                </Text>
                <Text size="sm" c="dimmed" mb="xl">
                  {t("settings.outliner.description")}
                </Text>

                <Stack gap="lg">
                  {matchesSearch("indent guides") && (
                    <Switch
                      label={t("settings.outliner.indent_guides")}
                      description={t("settings.outliner.indent_guides_desc")}
                      checked={showIndentGuides}
                      onChange={toggleIndentGuides}
                    />
                  )}

                  {matchesSearch("auto expand blocks") && (
                    <Switch
                      label={t("settings.outliner.auto_expand")}
                      description={t("settings.outliner.auto_expand_desc")}
                      checked={autoExpandBlocks}
                      onChange={(event) =>
                        setAutoExpandBlocks?.(event.currentTarget.checked)
                      }
                    />
                  )}

                  {matchesSearch("block count") && (
                    <Switch
                      label={t("settings.outliner.block_count")}
                      description={t("settings.outliner.block_count_desc")}
                      checked={showBlockCount}
                      onChange={(event) =>
                        setShowBlockCount?.(event.currentTarget.checked)
                      }
                    />
                  )}

                  {matchesSearch("code block line numbers") && (
                    <Switch
                      label={t("settings.outliner.code_block_line_numbers")}
                      description={t("settings.outliner.code_block_line_numbers_desc")}
                      checked={showCodeBlockLineNumbers}
                      onChange={(event) =>
                        setShowCodeBlockLineNumbers?.(
                          event.currentTarget.checked,
                        )
                      }
                    />
                  )}

                  {matchesSearch("indent size") && (
                    <div>
                      <Text size="sm" fw={500} mb={8}>
                        {t("settings.outliner.indent_size")}
                      </Text>
                      <NumberInput
                        value={indentSize}
                        onChange={(value) => {
                          if (typeof value === "number") {
                            setIndentSize(value);
                          }
                        }}
                        min={12}
                        max={48}
                        step={2}
                      />
                    </div>
                  )}
                </Stack>
              </div>
            </Stack>
          </Tabs.Panel>

          {/* Git Tab */}
          <Tabs.Panel value="git">
            <Stack gap="xl">
              <div>
                <Text size="xl" fw={600} mb="lg">
                  {t("settings.git.title")}
                </Text>
                <Text size="sm" c="dimmed" mb="xl">
                  {t("settings.git.description")}
                </Text>

                <Stack gap="lg">
                  {!isGitRepo ? (
                    matchesSearch("initialize git repository") && (
                      <>
                        <Button
                          leftSection={<IconBrandGit size={16} />}
                          onClick={() =>
                            workspacePath && initGit(workspacePath)
                          }
                          variant="filled"
                          color="blue"
                        >
                          {t("settings.git.init_button")}
                        </Button>

                        <div
                          style={{
                            padding: 16,
                            borderRadius: 6,
                            backgroundColor: isDark ? "#2C2E33" : "#F1F3F5",
                          }}
                        >
                          <Text size="sm" fw={500} mb={8}>
                            {t("settings.git.why_git")}
                          </Text>
                          <Text size="sm" c="dimmed">
                            • Track all changes to your notes
                            <br />• Never lose work - full history available
                            <br />• Sync across devices with remote repositories
                            <br />• Collaborate with others using GitHub,
                            GitLab, etc.
                            {t("settings.git.why_git_desc")}
                          </Text>
                        </div>
                      </>
                    )
                  ) : (
                    <>
                      {matchesSearch("repository location path") && (
                        <div>
                          <Text size="sm" fw={500} mb={8}>
                            {t("settings.git.repo_location")}
                          </Text>
                          <Text
                            size="sm"
                            c="dimmed"
                            style={{
                              fontFamily: "monospace",
                              backgroundColor: isDark ? "#2C2E33" : "#F1F3F5",
                              padding: "8px 12px",
                              borderRadius: "4px",
                              wordBreak: "break-all",
                            }}
                          >
                            {workspacePath}
                          </Text>
                        </div>
                      )}

                      {matchesSearch("current status commit changes") && (
                        <div>
                          <Text size="sm" fw={500} mb={8}>
                            {t("settings.git.current_status")}
                          </Text>
                          <Group gap="xs" mb={8}>
                            <Button
                              size="sm"
                              variant="light"
                              color={hasGitChanges ? "yellow" : "gray"}
                              onClick={handleGitCommit}
                              disabled={!hasGitChanges}
                            >
                              {hasGitChanges ? t("settings.git.commit_changes") : t("settings.git.no_changes")}
                            </Button>
                            <Button
                              size="sm"
                              variant="subtle"
                              onClick={() =>
                                workspacePath && checkGitStatus(workspacePath)
                              }
                            >
                              {t("settings.git.refresh")}
                            </Button>
                          </Group>
                          <Text
                            size="xs"
                            c={hasGitChanges ? "yellow" : "dimmed"}
                          >
                            {hasGitChanges
                              ? t("settings.git.uncommitted_changes")
                              : t("settings.git.all_committed")}
                          </Text>
                        </div>
                      )}

                      {matchesSearch("auto commit interval") && (
                        <div
                          style={{
                            padding: 16,
                            borderRadius: 6,
                            backgroundColor: isDark ? "#2C2E33" : "#F1F3F5",
                            borderLeft: `3px solid ${isDark ? "#4C6EF5" : "#5C7CFA"}`,
                          }}
                        >
                          <Text size="sm" fw={500} mb={8}>
                            {t("settings.git.auto_commit")}
                          </Text>
                          <Switch
                            label={t("settings.git.enable_auto_commit")}
                            description={t("settings.git.enable_auto_commit_desc")}
                            checked={autoCommitEnabled}
                            onChange={(event) =>
                              setAutoCommitEnabled(event.currentTarget.checked)
                            }
                            mb={autoCommitEnabled ? 12 : 0}
                          />

                          {autoCommitEnabled && (
                            <>
                              <Text size="sm" fw={500} mb={8}>
                                {t("settings.git.commit_interval")}
                              </Text>
                              <NumberInput
                                value={autoCommitInterval}
                                onChange={(value) =>
                                  setAutoCommitInterval(
                                    typeof value === "number" ? value : 5,
                                  )
                                }
                                min={1}
                                max={60}
                                step={1}
                                suffix=" min"
                              />
                              <Text size="xs" c="dimmed" mt={8}>
                                {t("settings.git.commit_interval_desc", { interval: autoCommitInterval })}
                              </Text>
                            </>
                          )}
                        </div>
                      )}

                      {matchesSearch("remote repository url push pull") && (
                        <div
                          style={{
                            padding: 16,
                            borderRadius: 6,
                            backgroundColor: isDark ? "#2C2E33" : "#F1F3F5",
                            borderLeft: `3px solid ${isDark ? "#4C6EF5" : "#5C7CFA"}`,
                          }}
                        >
                          <Text size="sm" fw={500} mb={8}>
                            {t("settings.git.remote_repo")}
                          </Text>
                          {remoteUrl ? (
                            <Stack gap="xs">
                              <Group gap="xs" align="flex-start">
                                <Text
                                  size="sm"
                                  c="dimmed"
                                  style={{
                                    fontFamily: "monospace",
                                    flex: 1,
                                    wordBreak: "break-all",
                                  }}
                                >
                                  {remoteUrl}
                                </Text>
                                <Tooltip label={t("tooltips.remove_remote")}>
                                  <Button
                                    size="xs"
                                    variant="subtle"
                                    color="red"
                                    onClick={handleRemoveRemote}
                                  >
                                    <IconX size={14} />
                                  </Button>
                                </Tooltip>
                              </Group>
                              <Text size="xs" c="dimmed">
                                {t("settings.git.push_pull_hint")}
                              </Text>
                            </Stack>
                          ) : isEditingRemote ? (
                            <Stack gap="xs">
                              <TextInput
                                placeholder={t("settings.git.remote_url_placeholder")}
                                value={remoteUrlInput}
                                onChange={(e) =>
                                  setRemoteUrlInput(e.currentTarget.value)
                                }
                                size="sm"
                              />
                              <Group gap="xs">
                                <Button
                                  size="xs"
                                  variant="light"
                                  onClick={handleSetRemoteUrl}
                                  disabled={!remoteUrlInput.trim()}
                                >
                                  {t("common.save")}
                                </Button>
                                <Button
                                  size="xs"
                                  variant="subtle"
                                  onClick={() => {
                                    setIsEditingRemote(false);
                                    setRemoteUrlInput("");
                                  }}
                                >
                                  {t("common.cancel")}
                                </Button>
                              </Group>
                            </Stack>
                          ) : (
                            <Button
                              size="sm"
                              variant="light"
                              leftSection={<IconPlus size={16} />}
                              onClick={() => setIsEditingRemote(true)}
                            >
                              {t("settings.git.add_remote")}
                            </Button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </Stack>
              </div>
            </Stack>
          </Tabs.Panel>

          {/* Shortcuts Tab */}
          <Tabs.Panel value="shortcuts">
            <Stack gap="xl">
              <div>
                <Text size="xl" fw={600} mb="lg">
                  {t("settings.shortcuts.title")}
                </Text>
                <Text size="sm" c="dimmed" mb="xl">
                  {t("settings.shortcuts.description")}
                </Text>

                <Stack gap="md">
                  {matchesSearch("keyboard shortcuts hotkey command") && (
                    <div
                      style={{
                        padding: 16,
                        borderRadius: 6,
                        backgroundColor: isDark ? "#2C2E33" : "#F1F3F5",
                      }}
                    >
                      <Group justify="space-between" mb={8}>
                        <Text size="sm" fw={500}>
                          {t("settings.shortcuts.command_palette")}
                        </Text>
                        <Badge variant="light">Cmd+K</Badge>
                      </Group>
                      <Group justify="space-between" mb={8}>
                        <Text size="sm" fw={500}>
                          {t("settings.shortcuts.search")}
                        </Text>
                        <Badge variant="light">Cmd+P</Badge>
                      </Group>
                      <Group justify="space-between" mb={8}>
                        <Text size="sm" fw={500}>
                          {t("common.settings")}
                        </Text>
                        <Badge variant="light">Cmd+,</Badge>
                      </Group>
                      <Group justify="space-between" mb={8}>
                        <Text size="sm" fw={500}>
                          {t("settings.shortcuts.help")}
                        </Text>
                        <Badge variant="light">Cmd+?</Badge>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm" fw={500}>
                          {t("settings.shortcuts.toggle_index")}
                        </Text>
                        <Badge variant="light">Cmd+\</Badge>
                      </Group>
                    </div>
                  )}
                </Stack>
              </div>
            </Stack>
          </Tabs.Panel>

          {/* Advanced Tab */}
          <Tabs.Panel value="advanced">
            <Stack gap="xl">
              <div>
                <Text size="xl" fw={600} mb="lg">
                  {t("settings.advanced.title")}
                </Text>
                <Text size="sm" c="dimmed" mb="xl">
                  {t("settings.advanced.description")}
                </Text>

                <Stack gap="lg">
                  {matchesSearch("cache clear") && (
                    <div>
                      <Text size="sm" fw={500} mb={12}>
                        {t("settings.advanced.cache")}
                      </Text>
                      <Button
                        size="sm"
                        variant="light"
                        onClick={() => {
                          if (window.confirm(t("settings.advanced.clear_cache_confirm"))) {
                            clearCache();
                          }
                        }}
                      >
                        {t("settings.advanced.clear_cache")}
                      </Button>
                    </div>
                  )}

                  {matchesSearch("updates automatic beta check") && (
                    <div>
                      <Text size="sm" fw={500} mb={12}>
                        {t("settings.advanced.updates")}
                      </Text>
                      <Stack gap="md">
                        <Switch
                          label={t("settings.advanced.auto_updates")}
                          description={t("settings.advanced.auto_updates_desc")}
                          checked={autoUpdate}
                          onChange={(event) =>
                            setAutoUpdate(event.currentTarget.checked)
                          }
                          disabled
                        />

                        <Switch
                          label={t("settings.advanced.check_startup")}
                          description={t("settings.advanced.check_startup_desc")}
                          checked={checkUpdatesOnStartup}
                          onChange={(event) =>
                            setCheckUpdatesOnStartup(
                              event.currentTarget.checked,
                            )
                          }
                          disabled
                        />

                        <Switch
                          label={t("settings.advanced.beta_updates")}
                          description={t("settings.advanced.beta_updates_desc")}
                          checked={betaUpdates}
                          onChange={(event) =>
                            setBetaUpdates(event.currentTarget.checked)
                          }
                          disabled
                        />

                        <Group gap="xs">
                          <Button
                            size="sm"
                            variant="light"
                            leftSection={<IconDownload size={16} />}
                            disabled
                          >
                            {t("settings.advanced.check_updates_btn")}
                          </Button>
                        </Group>
                        <Text size="xs" c="dimmed">
                          {t("settings.advanced.current_version", { version: "0.1.0 (Beta)" })}
                        </Text>
                      </Stack>
                    </div>
                  )}

                  {matchesSearch("developer telemetry anonymous") && (
                    <div
                      style={{
                        padding: 16,
                        borderRadius: 6,
                        backgroundColor: isDark ? "#2C2E33" : "#F1F3F5",
                        borderLeft: `3px solid ${isDark ? "#4C6EF5" : "#5C7CFA"}`,
                      }}
                    >
                      <Text size="sm" fw={500} mb={12}>
                        {t("settings.advanced.developer_options")}
                      </Text>
                      <Stack gap="md">
                        <Switch
                          label={t("settings.advanced.telemetry")}
                          description={t("settings.advanced.telemetry_desc")}
                          checked={telemetryEnabled}
                          onChange={(event) =>
                            setTelemetryEnabled(event.currentTarget.checked)
                          }
                        />
                      </Stack>
                    </div>
                  )}

                  {matchesSearch("reset settings danger") && (
                    <div
                      style={{
                        padding: 16,
                        borderRadius: 6,
                        backgroundColor: isDark ? "#2C2E33" : "#F1F3F5",
                        borderLeft: `3px solid ${isDark ? "#FA5252" : "#FF6B6B"}`,
                      }}
                    >
                      <Text size="sm" fw={500} mb={12} c="red">
                        {t("settings.advanced.danger_zone")}
                      </Text>
                      <Stack gap="md">
                        <div>
                          <Text size="sm" fw={500} mb={4}>
                            {t("settings.advanced.reset_settings")}
                          </Text>
                          <Text size="xs" c="dimmed" mb={8}>
                            {t("settings.advanced.reset_settings_desc")}
                          </Text>
                          <Button
                            size="sm"
                            variant="light"
                            color="red"
                            leftSection={<IconTrash size={16} />}
                            onClick={() => {
                              if (
                                window.confirm(
                                  t("settings.advanced.reset_confirm")
                                )
                              ) {
                                resetAllSettings();
                              }
                            }}
                          >
                            {t("settings.advanced.reset_settings")}
                          </Button>
                        </div>
                      </Stack>
                    </div>
                  )}
                </Stack>
              </div>
            </Stack>
          </Tabs.Panel>

          {/* About Tab */}
          <Tabs.Panel value="about">
            <Stack gap="xl">
              <div>
                <Text size="xl" fw={600} mb="lg">
                  {t("settings.about.title")}
                </Text>

                <Stack gap="lg">
                  <div>
                    <Group gap="xs" mb={8}>
                      <Text size="lg" fw={600}>
                        {t("settings.about.app_name")}
                      </Text>
                      <Badge size="lg" variant="light" color="blue">
                        {t("settings.beta")}
                      </Badge>
                    </Group>
                    <Text size="sm" c="dimmed">
                      {t("settings.about.version", { version: "0.1.0" })}
                    </Text>
                  </div>

                  <div
                    style={{
                      padding: 12,
                      borderRadius: 6,
                      backgroundColor: isDark ? "#2C2E33" : "#F1F3F5",
                    }}
                  >
                    <Text size="sm" fw={500} mb={8}>
                      {t("settings.about.updates_title")}
                    </Text>
                    <Stack gap="xs">
                      <Text size="xs" c="dimmed">
                        {t("settings.about.updates_desc")}
                      </Text>
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => {
                          alert(
                            t("settings.about.check_update_msg")
                          );
                        }}
                      >
                        {t("settings.about.check_updates_btn")}
                      </Button>
                    </Stack>
                  </div>
                </Stack>
              </div>
            </Stack>
          </Tabs.Panel>
        </div>
      </Tabs>
    </Modal>
  );
}
