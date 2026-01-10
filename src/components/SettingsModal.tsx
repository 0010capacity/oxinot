import { useState, useMemo } from "react";
import {
  Modal,
  Stack,
  Text,
  Select,
  SegmentedControl,
  Switch,
  TextInput,
  NumberInput,
  Button,
  Group,
  Tabs,
  Badge,
  Slider,
  Alert,
  Tooltip,
} from "@mantine/core";
import {
  IconPalette,
  IconAppWindow,
  IconClock,
  IconCalendar,
  IconHome,
  IconList,
  IconBrandGit,
  IconInfoCircle,
  IconKeyboard,
  IconSettings,
  IconDownload,
  IconAlertTriangle,
  IconTrash,
  IconSearch,
  IconPlus,
  IconX,
} from "@tabler/icons-react";
import { useThemeStore, type ColorVariant } from "../stores/themeStore";
import { useAppSettingsStore } from "../stores/appSettingsStore";
import {
  useClockFormatStore,
  type TimeFormat,
  type DateOrder,
  type DateSeparator,
} from "../stores/clockFormatStore";
import { useOutlinerSettingsStore } from "../stores/outlinerSettingsStore";
import { useGitStore } from "../stores/gitStore";
import { useAdvancedSettingsStore } from "../stores/advancedSettingsStore";
import { useColorScheme } from "@mantine/hooks";

const FONT_OPTIONS = [
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

type FontFamily = (typeof FONT_OPTIONS)[number]["value"];

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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

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

  // Git
  const isGitRepo = useGitStore((state) => state.isGitRepo);
  const hasGitChanges = useGitStore((state) => state.hasGitChanges);
  const autoCommitEnabled = useGitStore((state) => state.autoCommitEnabled);
  const setAutoCommitEnabled = useGitStore(
    (state) => state.setAutoCommitEnabled,
  );
  const autoCommitInterval = useGitStore((state) => state.autoCommitInterval);
  const setAutoCommitInterval = useGitStore(
    (state) => state.setAutoCommitInterval,
  );
  const checkGitStatus = useGitStore((state) => state.checkGitStatus);
  const gitCommit = useGitStore((state) => state.gitCommit);
  const initGit = useGitStore((state) => state.initGit);
  const remoteUrl = useGitStore((state) => state.remoteUrl);
  const getRemoteUrl = useGitStore((state) => state.getRemoteUrl);
  const setRemoteUrl = useGitStore((state) => state.setRemoteUrl);
  const removeRemote = useGitStore((state) => state.removeRemote);

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
      window.confirm("Are you sure you want to remove the remote repository?")
    ) {
      try {
        await removeRemote(workspacePath);
      } catch (error) {
        console.error("Failed to remove remote:", error);
      }
    }
  };

  // Load remote URL when opening settings
  useState(() => {
    if (workspacePath && isGitRepo) {
      getRemoteUrl(workspacePath);
    }
  });

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
        "font family",
        "editor font size",
        "line height",
        "typography",
        "inter",
        "system",
        "roboto",
        "monospace",
        "preview",
      ],
      theme: [
        "color variant",
        "accent color",
        "default",
        "blue",
        "purple",
        "green",
        "amber",
        "dark mode",
      ],
      datetime: [
        "time format",
        "24 hour",
        "12 hour",
        "date order",
        "date separator",
        "mdy",
        "dmy",
        "ymd",
        "slash",
        "hyphen",
        "dot",
        "clock",
      ],
      daily: ["daily notes path", "folder", "path", "daily"],
      homepage: [
        "homepage type",
        "daily note",
        "file tree",
        "index",
        "custom page",
        "start page",
        "default",
      ],
      outliner: ["indent guides", "auto expand", "block count", "blocks"],
      git: [
        "version control",
        "git",
        "repository",
        "commit",
        "auto commit",
        "remote",
        "push",
        "pull",
        "interval",
        "status",
      ],
      shortcuts: [
        "keyboard shortcuts",
        "hotkey",
        "command palette",
        "search",
        "settings",
        "help",
        "toggle",
      ],
      advanced: [
        "automatic updates",
        "beta updates",
        "check updates",
        "telemetry",
        "developer",
        "reset settings",
        "danger",
      ],
      about: ["version", "changelog", "beta", "oxinot", "info"],
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
            Settings
          </Text>
          <Badge size="sm" variant="light" color="blue">
            Beta
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
          placeholder="Search settings..."
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
        {searchQuery && filteredTabs && filteredTabs.length === 0 && (
          <Text size="xs" c="dimmed" mt={8}>
            No settings found for "{searchQuery}"
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
              Appearance
            </Tabs.Tab>
          )}
          {hasMatchInTab("theme") && (
            <Tabs.Tab value="theme" leftSection={<IconPalette size={16} />}>
              Theme
            </Tabs.Tab>
          )}
          {hasMatchInTab("datetime") && (
            <Tabs.Tab value="datetime" leftSection={<IconClock size={16} />}>
              Date & Time
            </Tabs.Tab>
          )}
          {hasMatchInTab("daily") && (
            <Tabs.Tab value="daily" leftSection={<IconCalendar size={16} />}>
              Daily Notes
            </Tabs.Tab>
          )}
          {hasMatchInTab("homepage") && (
            <Tabs.Tab value="homepage" leftSection={<IconHome size={16} />}>
              Homepage
            </Tabs.Tab>
          )}
          {hasMatchInTab("outliner") && (
            <Tabs.Tab value="outliner" leftSection={<IconList size={16} />}>
              Outliner
            </Tabs.Tab>
          )}
          {hasMatchInTab("git") && (
            <Tabs.Tab value="git" leftSection={<IconBrandGit size={16} />}>
              Version Control
            </Tabs.Tab>
          )}
          {hasMatchInTab("shortcuts") && (
            <Tabs.Tab
              value="shortcuts"
              leftSection={<IconKeyboard size={16} />}
            >
              Shortcuts
            </Tabs.Tab>
          )}
          {hasMatchInTab("advanced") && (
            <Tabs.Tab value="advanced" leftSection={<IconSettings size={16} />}>
              Advanced
            </Tabs.Tab>
          )}
          {hasMatchInTab("about") && (
            <Tabs.Tab value="about" leftSection={<IconInfoCircle size={16} />}>
              About
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
                  Appearance
                </Text>
                <Text size="sm" c="dimmed" mb="xl">
                  Customize the look and feel of the editor
                </Text>

                <Stack gap="lg">
                  {matchesSearch("Font Family") && (
                    <div>
                      <Text size="sm" fw={500} mb={8}>
                        Font Family
                      </Text>
                      <Select
                        value={fontFamily}
                        onChange={(value) => setFontFamily(value as FontFamily)}
                        data={FONT_OPTIONS}
                        placeholder="Select font"
                        searchable
                      />
                      <Text size="xs" c="dimmed" mt={4}>
                        Choose the font used throughout the application
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

                  {matchesSearch("Editor Font Size") && (
                    <div>
                      <Text size="sm" fw={500} mb={8}>
                        Editor Font Size
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
                        Adjust the font size in the editor
                      </Text>
                    </div>
                  )}

                  {matchesSearch("Editor Line Height") && (
                    <div>
                      <Text size="sm" fw={500} mb={8}>
                        Editor Line Height
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
                        Adjust spacing between lines
                      </Text>
                    </div>
                  )}
                </Stack>
              </div>
            </Stack>
          </Tabs.Panel>

          {/* Theme Tab */}
          <Tabs.Panel value="theme">
            <Stack gap="xl">
              <div>
                <Text size="xl" fw={600} mb="lg">
                  Theme
                </Text>
                <Text size="sm" c="dimmed" mb="xl">
                  Personalize your color scheme
                </Text>

                <Stack gap="lg">
                  {matchesSearch("Color Variant accent") && (
                    <div>
                      <Text size="sm" fw={500} mb={8}>
                        Color Variant
                      </Text>
                      <SegmentedControl
                        value={colorVariant}
                        onChange={(value) =>
                          setColorVariant(value as ColorVariant)
                        }
                        data={[
                          { label: "Default", value: "default" },
                          { label: "Blue", value: "blue" },
                          { label: "Purple", value: "purple" },
                          { label: "Green", value: "green" },
                          { label: "Amber", value: "amber" },
                        ]}
                        fullWidth
                      />
                      <Text size="xs" c="dimmed" mt={4}>
                        Choose your preferred accent color theme
                      </Text>
                    </div>
                  )}

                  <Alert
                    icon={<IconInfoCircle size={16} />}
                    color="blue"
                    variant="light"
                  >
                    The theme automatically adapts to your system's dark mode
                    setting
                  </Alert>
                </Stack>
              </div>
            </Stack>
          </Tabs.Panel>

          {/* Date & Time Tab */}
          <Tabs.Panel value="datetime">
            <Stack gap="xl">
              <div>
                <Text size="xl" fw={600} mb="lg">
                  Date & Time
                </Text>
                <Text size="sm" c="dimmed" mb="xl">
                  Configure how dates and times are displayed
                </Text>

                <Stack gap="lg">
                  {matchesSearch("Time Format 24 12 hour clock") && (
                    <div>
                      <Text size="sm" fw={500} mb={8}>
                        Time Format
                      </Text>
                      <Select
                        value={timeFormat}
                        onChange={(value) => setTimeFormat(value as TimeFormat)}
                        data={[
                          { label: "24-Hour (13:34)", value: "24h" },
                          { label: "12-Hour (01:34 PM)", value: "12h" },
                        ]}
                        placeholder="Select time format"
                      />
                    </div>
                  )}

                  {matchesSearch("Date Order MDY DMY YMD") && (
                    <div>
                      <Text size="sm" fw={500} mb={8}>
                        Date Order
                      </Text>
                      <Select
                        value={dateOrder}
                        onChange={(value) => setDateOrder(value as DateOrder)}
                        data={[
                          { label: "Month/Day/Year (MDY)", value: "MDY" },
                          { label: "Day/Month/Year (DMY)", value: "DMY" },
                          { label: "Year/Month/Day (YMD)", value: "YMD" },
                        ]}
                        placeholder="Select date order"
                      />
                      <Text size="xs" c="dimmed" mt={4}>
                        Choose the order of year, month, and day
                      </Text>
                    </div>
                  )}

                  {matchesSearch("Date Separator slash hyphen dot") && (
                    <div>
                      <Text size="sm" fw={500} mb={8}>
                        Date Separator
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
                        placeholder="Select separator"
                      />
                    </div>
                  )}

                  {matchesSearch("preview") && (
                    <div
                      style={{
                        padding: 16,
                        borderRadius: 6,
                        backgroundColor: isDark ? "#2C2E33" : "#F1F3F5",
                      }}
                    >
                      <Text size="sm" fw={500} mb={4}>
                        Preview
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
                  Daily Notes
                </Text>
                <Text size="sm" c="dimmed" mb="xl">
                  Configure automatic daily note creation
                </Text>

                <Stack gap="lg">
                  {matchesSearch("Daily Notes Path folder") && (
                    <div>
                      <Text size="sm" fw={500} mb={8}>
                        Daily Notes Path
                      </Text>
                      <TextInput
                        value={dailyNotesPath}
                        onChange={(event) =>
                          setDailyNotesPath(event.currentTarget.value)
                        }
                        placeholder="Daily"
                        description="Path where daily notes will be created (e.g., 'Daily' or 'Notes/Daily')"
                      />
                    </div>
                  )}

                  <Alert
                    icon={<IconInfoCircle size={16} />}
                    color="blue"
                    variant="light"
                  >
                    Daily notes are automatically created with today's date when
                    you click the home button
                  </Alert>
                </Stack>
              </div>
            </Stack>
          </Tabs.Panel>

          {/* Homepage Tab */}
          <Tabs.Panel value="homepage">
            <Stack gap="xl">
              <div>
                <Text size="xl" fw={600} mb="lg">
                  Homepage
                </Text>
                <Text size="sm" c="dimmed" mb="xl">
                  Choose what to display when opening the app
                </Text>

                <Stack gap="lg">
                  {matchesSearch("Homepage Type start default") && (
                    <div>
                      <Text size="sm" fw={500} mb={8}>
                        Homepage Type
                      </Text>
                      <Select
                        value={homepageType}
                        onChange={(value) =>
                          setHomepageType(
                            value as "daily-note" | "index" | "custom-page",
                          )
                        }
                        data={[
                          { label: "Today's Daily Note", value: "daily-note" },
                          { label: "File Tree", value: "index" },
                          { label: "Custom Page", value: "custom-page" },
                        ]}
                        placeholder="Select homepage type"
                      />
                      <Text size="xs" c="dimmed" mt={4}>
                        Choose what to show when opening the app
                      </Text>
                    </div>
                  )}

                  {homepageType === "custom-page" && (
                    <div>
                      <Text size="sm" fw={500} mb={8}>
                        Custom Homepage
                      </Text>
                      <Select
                        value={customHomepageId || ""}
                        onChange={(value) => setCustomHomepageId(value || null)}
                        data={pageIds.map((id) => ({
                          label: pagesById[id]?.title || id,
                          value: id,
                        }))}
                        placeholder="Select a page"
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
                  Outliner
                </Text>
                <Text size="sm" c="dimmed" mb="xl">
                  Customize the block editor behavior
                </Text>

                <Stack gap="lg">
                  {matchesSearch("indent guides") && (
                    <Switch
                      label="Show indent guides"
                      description="Display vertical lines to show indentation levels"
                      checked={showIndentGuides}
                      onChange={toggleIndentGuides}
                    />
                  )}

                  {matchesSearch("auto expand blocks") && (
                    <Switch
                      label="Auto-expand blocks"
                      description="Automatically expand collapsed blocks when navigating"
                      checked={autoExpandBlocks}
                      onChange={(event) =>
                        setAutoExpandBlocks?.(event.currentTarget.checked)
                      }
                    />
                  )}

                  {matchesSearch("block count") && (
                    <Switch
                      label="Show block count"
                      description="Display the number of child blocks for each parent"
                      checked={showBlockCount}
                      onChange={(event) =>
                        setShowBlockCount?.(event.currentTarget.checked)
                      }
                    />
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
                  Version Control
                </Text>
                <Text size="sm" c="dimmed" mb="xl">
                  Git-based version control for your workspace
                </Text>

                <Stack gap="lg">
                  {!isGitRepo ? (
                    matchesSearch("initialize git repository") && (
                      <>
                        <Alert
                          icon={<IconAlertTriangle size={16} />}
                          color="yellow"
                          variant="light"
                        >
                          <Text size="sm" fw={500} mb={4}>
                            Git Not Initialized
                          </Text>
                          <Text size="sm">
                            This workspace is not a Git repository yet.
                            Initialize Git to enable version control and
                            automatic backups.
                          </Text>
                        </Alert>

                        <Button
                          leftSection={<IconBrandGit size={16} />}
                          onClick={() =>
                            workspacePath && initGit(workspacePath)
                          }
                          variant="filled"
                          color="blue"
                        >
                          Initialize Git Repository
                        </Button>

                        <div
                          style={{
                            padding: 16,
                            borderRadius: 6,
                            backgroundColor: isDark ? "#2C2E33" : "#F1F3F5",
                          }}
                        >
                          <Text size="sm" fw={500} mb={8}>
                            Why Use Git?
                          </Text>
                          <Text size="sm" c="dimmed">
                            • Track all changes to your notes
                            <br />
                            • Never lose work - full history available
                            <br />
                            • Sync across devices with remote repositories
                            <br />• Collaborate with others using GitHub,
                            GitLab, etc.
                          </Text>
                        </div>
                      </>
                    )
                  ) : (
                    <>
                      {matchesSearch("git repository tracked") && (
                        <Alert
                          icon={<IconInfoCircle size={16} />}
                          color="blue"
                          variant="light"
                        >
                          Your workspace is a Git repository. All changes are
                          tracked locally and can be synced to remote
                          repositories.
                        </Alert>
                      )}

                      {matchesSearch("repository location path") && (
                        <div>
                          <Text size="sm" fw={500} mb={8}>
                            Repository Location
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
                            Current Status
                          </Text>
                          <Group gap="xs" mb={8}>
                            <Button
                              size="sm"
                              variant="light"
                              color={hasGitChanges ? "yellow" : "gray"}
                              onClick={handleGitCommit}
                              disabled={!hasGitChanges}
                            >
                              {hasGitChanges ? "Commit Changes" : "No Changes"}
                            </Button>
                            <Button
                              size="sm"
                              variant="subtle"
                              onClick={() =>
                                workspacePath && checkGitStatus(workspacePath)
                              }
                            >
                              Refresh
                            </Button>
                          </Group>
                          <Text
                            size="xs"
                            c={hasGitChanges ? "yellow" : "dimmed"}
                          >
                            {hasGitChanges
                              ? "⚠️ You have uncommitted changes"
                              : "✓ All changes committed"}
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
                            Auto-commit
                          </Text>
                          <Switch
                            label="Enable auto-commit"
                            description="Automatically commit changes at regular intervals"
                            checked={autoCommitEnabled}
                            onChange={(event) =>
                              setAutoCommitEnabled(event.currentTarget.checked)
                            }
                            mb={autoCommitEnabled ? 12 : 0}
                          />

                          {autoCommitEnabled && (
                            <>
                              <Text size="sm" fw={500} mb={8}>
                                Commit Interval
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
                                Automatic commits occur every{" "}
                                {autoCommitInterval} minute
                                {autoCommitInterval !== 1 ? "s" : ""}
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
                            Remote Repository
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
                                <Tooltip label="Remove remote">
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
                                Push and pull buttons are available in the
                                bottom-right corner
                              </Text>
                            </Stack>
                          ) : isEditingRemote ? (
                            <Stack gap="xs">
                              <TextInput
                                placeholder="https://github.com/user/repo.git"
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
                                  Save
                                </Button>
                                <Button
                                  size="xs"
                                  variant="subtle"
                                  onClick={() => {
                                    setIsEditingRemote(false);
                                    setRemoteUrlInput("");
                                  }}
                                >
                                  Cancel
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
                              Add Remote URL
                            </Button>
                          )}
                        </div>
                      )}

                      {matchesSearch("tip using git backup") && (
                        <Alert
                          icon={<IconInfoCircle size={16} />}
                          color="grape"
                          variant="light"
                        >
                          <Text size="sm" fw={500} mb={4}>
                            Tip: Using Git with Oxinot
                          </Text>
                          <Text size="xs">
                            • All markdown files and changes are tracked
                            automatically
                            <br />
                            • Use auto-commit for continuous backup
                            <br />
                            • Push to remote repositories (GitHub, GitLab, etc.)
                            for cloud backup
                            <br />• Click the yellow dot in bottom-right corner
                            for quick commits
                          </Text>
                        </Alert>
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
                  Keyboard Shortcuts
                </Text>
                <Text size="sm" c="dimmed" mb="xl">
                  View and customize keyboard shortcuts
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
                          Command Palette
                        </Text>
                        <Badge variant="light">Cmd+K</Badge>
                      </Group>
                      <Group justify="space-between" mb={8}>
                        <Text size="sm" fw={500}>
                          Search
                        </Text>
                        <Badge variant="light">Cmd+P</Badge>
                      </Group>
                      <Group justify="space-between" mb={8}>
                        <Text size="sm" fw={500}>
                          Settings
                        </Text>
                        <Badge variant="light">Cmd+,</Badge>
                      </Group>
                      <Group justify="space-between" mb={8}>
                        <Text size="sm" fw={500}>
                          Help
                        </Text>
                        <Badge variant="light">Cmd+?</Badge>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm" fw={500}>
                          Toggle Index
                        </Text>
                        <Badge variant="light">Cmd+\</Badge>
                      </Group>
                    </div>
                  )}

                  <Alert
                    icon={<IconInfoCircle size={16} />}
                    color="blue"
                    variant="light"
                  >
                    Custom keyboard shortcuts will be available in a future
                    update
                  </Alert>
                </Stack>
              </div>
            </Stack>
          </Tabs.Panel>

          {/* Advanced Tab */}
          <Tabs.Panel value="advanced">
            <Stack gap="xl">
              <div>
                <Text size="xl" fw={600} mb="lg">
                  Advanced
                </Text>
                <Text size="sm" c="dimmed" mb="xl">
                  Advanced settings and developer options
                </Text>

                <Stack gap="lg">
                  {matchesSearch("updates automatic beta check") && (
                    <div>
                      <Text size="sm" fw={500} mb={12}>
                        Updates
                      </Text>
                      <Stack gap="md">
                        <Alert
                          icon={<IconInfoCircle size={16} />}
                          color="blue"
                          variant="light"
                        >
                          Auto-update functionality will be available in a
                          future release.
                        </Alert>

                        <Switch
                          label="Automatic updates"
                          description="Automatically download and install updates (coming soon)"
                          checked={autoUpdate}
                          onChange={(event) =>
                            setAutoUpdate(event.currentTarget.checked)
                          }
                          disabled
                        />

                        <Switch
                          label="Check for updates on startup"
                          description="Check for new versions when the app starts (coming soon)"
                          checked={checkUpdatesOnStartup}
                          onChange={(event) =>
                            setCheckUpdatesOnStartup(
                              event.currentTarget.checked,
                            )
                          }
                          disabled
                        />

                        <Switch
                          label="Beta updates"
                          description="Receive beta versions with experimental features (coming soon)"
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
                            Check for Updates
                          </Button>
                        </Group>
                        <Text size="xs" c="dimmed">
                          Current version: 0.1.0 (Beta)
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
                        Developer Options
                      </Text>
                      <Stack gap="md">
                        <Switch
                          label="Anonymous telemetry"
                          description="Help improve Oxinot by sending anonymous usage data"
                          checked={telemetryEnabled}
                          onChange={(event) =>
                            setTelemetryEnabled(event.currentTarget.checked)
                          }
                        />
                        <Alert
                          icon={<IconInfoCircle size={16} />}
                          color="gray"
                          variant="light"
                        >
                          Telemetry is disabled by default. No personal data is
                          collected.
                        </Alert>
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
                        Danger Zone
                      </Text>
                      <Stack gap="md">
                        <div>
                          <Text size="sm" fw={500} mb={4}>
                            Reset All Settings
                          </Text>
                          <Text size="xs" c="dimmed" mb={8}>
                            This will reset all settings to their default values
                            and reload the application.
                          </Text>
                          <Button
                            size="sm"
                            variant="light"
                            color="red"
                            leftSection={<IconTrash size={16} />}
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Are you sure you want to reset all settings? This action cannot be undone.",
                                )
                              ) {
                                resetAllSettings();
                              }
                            }}
                          >
                            Reset All Settings
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
                  About
                </Text>
                <Text size="sm" c="dimmed" mb="xl">
                  Application information
                </Text>

                <Stack gap="lg">
                  <div>
                    <Group gap="xs" mb={8}>
                      <Text size="lg" fw={600}>
                        Oxinot
                      </Text>
                      <Badge size="lg" variant="light" color="blue">
                        Beta
                      </Badge>
                    </Group>
                    <Text size="sm" c="dimmed">
                      Version 0.1.0
                    </Text>
                  </div>

                  <div
                    style={{
                      padding: 16,
                      borderRadius: 6,
                      backgroundColor: isDark ? "#2C2E33" : "#F1F3F5",
                    }}
                  >
                    <Text size="sm" fw={500} mb={12}>
                      What's New in v0.1.0
                    </Text>
                    <Text size="sm" c="dimmed" mb={8}>
                      <strong>Settings Redesign</strong>
                    </Text>
                    <Text size="sm" c="dimmed" mb={12}>
                      • Modern tabbed interface with 10 categories
                      <br />
                      • Better organization and discoverability
                      <br />• Beta badge to indicate development status
                    </Text>
                    <Text size="sm" c="dimmed" mb={8}>
                      <strong>Appearance Enhancements</strong>
                    </Text>
                    <Text size="sm" c="dimmed" mb={12}>
                      • Editor font size control (12-24px)
                      <br />
                      • Line height adjustment (1.2-2.0)
                      <br />
                      • 12 font family options including monospace
                      <br />• Live preview for typography settings
                    </Text>
                    <Text size="sm" c="dimmed" mb={8}>
                      <strong>Outliner Improvements</strong>
                    </Text>
                    <Text size="sm" c="dimmed" mb={12}>
                      • Auto-expand blocks option
                      <br />
                      • Show block count toggle
                      <br />• Enhanced indent guides
                    </Text>
                    <Text size="sm" c="dimmed" mb={8}>
                      <strong>Keyboard Shortcuts</strong>
                    </Text>
                    <Text size="sm" c="dimmed">
                      • Cmd+, to open Settings
                      <br />
                      • Cmd+? to open Help
                      <br />• Complete shortcuts reference in Settings
                    </Text>
                  </div>

                  <Alert
                    icon={<IconInfoCircle size={16} />}
                    color="blue"
                    variant="light"
                  >
                    This is a beta version. Some features are still in
                    development.
                  </Alert>
                </Stack>
              </div>
            </Stack>
          </Tabs.Panel>
        </div>
      </Tabs>
    </Modal>
  );
}
