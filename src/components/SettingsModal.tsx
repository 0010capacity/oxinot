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
  IconCloud,
  IconShieldLock,
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

  const handleGitCommit = async () => {
    if (!workspacePath || !hasGitChanges) return;
    const timestamp = new Date().toISOString();
    try {
      await gitCommit(workspacePath, `Auto-save: ${timestamp}`);
    } catch (error) {
      console.error("Commit failed:", error);
    }
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
        },
      }}
    >
      <Tabs defaultValue="appearance" orientation="vertical">
        <Tabs.List
          style={{
            borderRight: `1px solid ${isDark ? "#2C2E33" : "#DEE2E6"}`,
            minWidth: 200,
            padding: "12px 8px",
          }}
        >
          <Tabs.Tab
            value="appearance"
            leftSection={<IconAppWindow size={16} />}
          >
            Appearance
          </Tabs.Tab>
          <Tabs.Tab value="theme" leftSection={<IconPalette size={16} />}>
            Theme
          </Tabs.Tab>
          <Tabs.Tab value="datetime" leftSection={<IconClock size={16} />}>
            Date & Time
          </Tabs.Tab>
          <Tabs.Tab value="daily" leftSection={<IconCalendar size={16} />}>
            Daily Notes
          </Tabs.Tab>
          <Tabs.Tab value="homepage" leftSection={<IconHome size={16} />}>
            Homepage
          </Tabs.Tab>
          <Tabs.Tab value="outliner" leftSection={<IconList size={16} />}>
            Outliner
          </Tabs.Tab>
          {isGitRepo && (
            <Tabs.Tab value="git" leftSection={<IconBrandGit size={16} />}>
              Version Control
            </Tabs.Tab>
          )}
          <Tabs.Tab value="shortcuts" leftSection={<IconKeyboard size={16} />}>
            Shortcuts
          </Tabs.Tab>
          <Tabs.Tab value="sync" leftSection={<IconCloud size={16} />}>
            Sync
          </Tabs.Tab>
          <Tabs.Tab value="privacy" leftSection={<IconShieldLock size={16} />}>
            Privacy
          </Tabs.Tab>
          <Tabs.Tab value="about" leftSection={<IconInfoCircle size={16} />}>
            About
          </Tabs.Tab>
        </Tabs.List>

        <div
          style={{
            flex: 1,
            padding: "24px",
            maxHeight: "70vh",
            overflow: "auto",
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
                      {useClockFormatStore.getState().formatDate(new Date())} |{" "}
                      {useClockFormatStore.getState().formatTime(new Date())}
                    </Text>
                  </div>
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
                  <Switch
                    label="Show indent guides"
                    description="Display vertical lines to show indentation levels"
                    checked={showIndentGuides}
                    onChange={toggleIndentGuides}
                  />

                  <Switch
                    label="Auto-expand blocks"
                    description="Automatically expand collapsed blocks when navigating"
                    checked={autoExpandBlocks}
                    onChange={(event) =>
                      setAutoExpandBlocks?.(event.currentTarget.checked)
                    }
                  />

                  <Switch
                    label="Show block count"
                    description="Display the number of child blocks for each parent"
                    checked={showBlockCount}
                    onChange={(event) =>
                      setShowBlockCount?.(event.currentTarget.checked)
                    }
                  />
                </Stack>
              </div>
            </Stack>
          </Tabs.Panel>

          {/* Git Tab */}
          {isGitRepo && (
            <Tabs.Panel value="git">
              <Stack gap="xl">
                <div>
                  <Text size="xl" fw={600} mb="lg">
                    Version Control
                  </Text>
                  <Text size="sm" c="dimmed" mb="xl">
                    Manage Git integration and automatic commits
                  </Text>

                  <Stack gap="lg">
                    <Switch
                      label="Auto-commit"
                      description="Automatically commit changes at regular intervals"
                      checked={autoCommitEnabled}
                      onChange={(event) =>
                        setAutoCommitEnabled(event.currentTarget.checked)
                      }
                    />

                    {autoCommitEnabled && (
                      <div>
                        <Text size="sm" fw={500} mb={8}>
                          Auto-commit Interval (minutes)
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
                        />
                        <Text size="xs" c="dimmed" mt={4}>
                          Changes will be committed every {autoCommitInterval}{" "}
                          minute
                          {autoCommitInterval !== 1 ? "s" : ""}
                        </Text>
                      </div>
                    )}

                    <div>
                      <Text size="sm" fw={500} mb={8}>
                        Git Status
                      </Text>
                      <Group gap="xs">
                        <Button
                          size="sm"
                          variant="light"
                          onClick={handleGitCommit}
                          disabled={!hasGitChanges}
                        >
                          Commit Changes
                        </Button>
                        <Button
                          size="sm"
                          variant="light"
                          onClick={() =>
                            workspacePath && checkGitStatus(workspacePath)
                          }
                        >
                          Refresh Status
                        </Button>
                      </Group>
                      <Text size="xs" c="dimmed" mt={8}>
                        {hasGitChanges
                          ? "You have uncommitted changes"
                          : "No changes to commit"}
                      </Text>
                    </div>
                  </Stack>
                </div>
              </Stack>
            </Tabs.Panel>
          )}

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

          {/* Sync Tab */}
          <Tabs.Panel value="sync">
            <Stack gap="xl">
              <div>
                <Text size="xl" fw={600} mb="lg">
                  Sync
                </Text>
                <Text size="sm" c="dimmed" mb="xl">
                  Cloud synchronization settings
                </Text>

                <Alert
                  icon={<IconInfoCircle size={16} />}
                  color="blue"
                  variant="light"
                >
                  Cloud sync is coming soon in a future update. For now, you can
                  use Git for version control.
                </Alert>
              </div>
            </Stack>
          </Tabs.Panel>

          {/* Privacy Tab */}
          <Tabs.Panel value="privacy">
            <Stack gap="xl">
              <div>
                <Text size="xl" fw={600} mb="lg">
                  Privacy & Security
                </Text>
                <Text size="sm" c="dimmed" mb="xl">
                  Manage your data and privacy settings
                </Text>

                <Stack gap="lg">
                  <Alert
                    icon={<IconShieldLock size={16} />}
                    color="green"
                    variant="light"
                  >
                    Your data is stored locally on your device. We don't collect
                    any personal information.
                  </Alert>

                  <div>
                    <Text size="sm" fw={500} mb={8}>
                      Data Location
                    </Text>
                    <Text size="sm" c="dimmed">
                      {workspacePath || "No workspace selected"}
                    </Text>
                  </div>
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
                    <Text size="sm" fw={500} mb={8}>
                      What's New
                    </Text>
                    <Text size="sm" c="dimmed">
                      • Modern settings interface with categorized tabs
                      <br />
                      • Enhanced appearance customization
                      <br />
                      • Improved Git integration
                      <br />• Better outliner controls
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
