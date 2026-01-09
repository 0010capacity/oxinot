import { useEffect, useState } from "react";
import {
  MantineProvider,
  AppShell,
  Container,
  useMantineColorScheme,
  createTheme,
  Stack,
  Text,
  Modal,
  Switch,
  Select,
  Button,
  Group,
  NumberInput,
} from "@mantine/core";

import { invoke } from "@tauri-apps/api/core";
import { useWorkspaceStore } from "./stores/workspaceStore";
import { useViewStore, useViewMode, useBreadcrumb } from "./stores/viewStore";
import { usePageStore } from "./stores/pageStore";
import {
  useOutlinerSettingsStore,
  FONT_OPTIONS,
  type FontFamily,
} from "./stores/outlinerSettingsStore";
import { useGitStore } from "./stores/gitStore";
import { MigrationDialog } from "./components/MigrationDialog";
import { TitleBar } from "./components/TitleBar";
import { FileTreeIndex } from "./components/FileTreeIndex";
import { BlockEditor } from "./outliner/BlockEditor";
import { SearchModal } from "./components/SearchModal";
import { CalendarModal } from "./components/CalendarModal";
import { HelpModal } from "./components/HelpModal";
import { CommandPalette } from "./components/CommandPalette";

import { ThemeProvider } from "./theme/ThemeProvider";
import { useThemeStore } from "./stores/themeStore";
import { SegmentedControl } from "@mantine/core";
import type { ColorVariant } from "./theme/types";

const theme = createTheme({
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
});

function WorkspaceSelector() {
  const { selectWorkspace, openWorkspace, getWorkspaces } = useWorkspaceStore();

  useEffect(() => {
    const workspaces = getWorkspaces();
    if (workspaces.length > 0) {
      // Auto-open last workspace
      openWorkspace(workspaces[0].path);
    } else {
      // No workspaces, open file picker
      selectWorkspace();
    }
  }, []);

  return (
    <Container size="xs" py="xl">
      <Stack align="center" gap="lg" style={{ marginTop: "25vh" }}>
        <Text size="sm" c="dimmed">
          Opening workspace...
        </Text>
      </Stack>
    </Container>
  );
}

interface AppContentProps {
  workspacePath: string;
}

function AppContent({ workspacePath }: AppContentProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";
  const { selectWorkspace } = useWorkspaceStore();
  const { loadPages } = usePageStore();
  const currentPageId = usePageStore((state) => state.currentPageId);
  const viewMode = useViewMode();
  const breadcrumb = useBreadcrumb();
  const { showIndex, setWorkspaceName } = useViewStore();

  const showIndentGuides = useOutlinerSettingsStore(
    (state) => state.showIndentGuides,
  );
  const toggleIndentGuides = useOutlinerSettingsStore(
    (state) => state.toggleIndentGuides,
  );
  const fontFamily = useOutlinerSettingsStore((state) => state.fontFamily);
  const setFontFamily = useOutlinerSettingsStore(
    (state) => state.setFontFamily,
  );
  const getFontStack = useOutlinerSettingsStore((state) => state.getFontStack);

  const colorVariant = useThemeStore((state) => state.colorVariant);
  const setColorVariant = useThemeStore((state) => state.setColorVariant);

  const [showMigration, setShowMigration] = useState(false);
  const [dbInitialized, setDbInitialized] = useState(false);
  const [checkingDb, setCheckingDb] = useState(true);
  const [settingsOpened, setSettingsOpened] = useState(false);
  const [searchOpened, setSearchOpened] = useState(false);
  const [calendarOpened, setCalendarOpened] = useState(false);
  const [helpOpened, setHelpOpened] = useState(false);
  const [commandPaletteOpened, setCommandPaletteOpened] = useState(false);

  // Git state
  const hasGitChanges = useGitStore((state) => state.hasChanges);
  const isGitRepo = useGitStore((state) => state.isRepo);
  const checkGitStatus = useGitStore((state) => state.checkStatus);
  const gitCommit = useGitStore((state) => state.commit);
  const autoCommitEnabled = useGitStore((state) => state.autoCommitEnabled);
  const setAutoCommitEnabled = useGitStore(
    (state) => state.setAutoCommitEnabled,
  );
  const autoCommitInterval = useGitStore((state) => state.autoCommitInterval);
  const setAutoCommitInterval = useGitStore(
    (state) => state.setAutoCommitInterval,
  );
  const autoCommit = useGitStore((state) => state.autoCommit);

  const workspaceName = workspacePath.split("/").pop() || "Workspace";

  // Git commit handler
  const handleGitCommit = async () => {
    if (!workspacePath || !hasGitChanges) return;
    const message = prompt("Commit message:");
    if (message) {
      await gitCommit(workspacePath, message);
    }
  };

  // Check git status on workspace load
  useEffect(() => {
    if (workspacePath && isGitRepo) {
      checkGitStatus(workspacePath);
    }
  }, [workspacePath, isGitRepo, checkGitStatus]);

  // Auto-commit interval
  useEffect(() => {
    if (!workspacePath || !autoCommitEnabled) return;

    const intervalId = setInterval(
      () => {
        autoCommit(workspacePath);
      },
      autoCommitInterval * 60 * 1000,
    );

    return () => clearInterval(intervalId);
  }, [workspacePath, autoCommitEnabled, autoCommitInterval, autoCommit]);

  // Command Palette keyboard shortcut (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpened(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Apply saved font on mount
  useEffect(() => {
    const fontStack = getFontStack();
    document.documentElement.style.setProperty("--font-family", fontStack);
  }, [getFontStack]);

  useEffect(() => {
    if (!workspacePath) {
      setCheckingDb(false);
      setDbInitialized(false);
      return;
    }

    const checkDatabase = async () => {
      setCheckingDb(true);
      try {
        // Sync filesystem with database (filesystem is source of truth)
        console.log("[App] Syncing workspace with filesystem...");
        const syncResult = await invoke<{ pages: number; blocks: number }>(
          "sync_workspace",
          { workspacePath },
        );
        console.log(
          `[App] Workspace synced: ${syncResult.pages} pages, ${syncResult.blocks} blocks`,
        );

        await loadPages();
        setDbInitialized(true);
        setShowMigration(false);
        setWorkspaceName(workspaceName);
      } catch (error) {
        console.error("[App] Failed to sync workspace:", error);
        setDbInitialized(false);
        setShowMigration(true);
      } finally {
        setCheckingDb(false);
      }
    };

    checkDatabase();
  }, [workspacePath, loadPages, setWorkspaceName, workspaceName]);

  const handleMigrationComplete = async () => {
    setShowMigration(false);
    setDbInitialized(true);
    // Sync after migration
    await invoke("sync_workspace", { workspacePath });
    await loadPages();
    setWorkspaceName(workspaceName);
    showIndex();
  };

  const handleMigrationCancel = () => {
    setShowMigration(false);
    selectWorkspace();
  };

  if (checkingDb) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
        }}
      >
        <Text size="sm" c="dimmed">
          Checking workspace...
        </Text>
      </div>
    );
  }

  return (
    <>
      <AppShell
        padding={0}
        styles={{
          main: {
            backgroundColor: isDark ? "#1a1b1e" : "#ffffff",
            height: "100vh",
            display: "flex",
            flexDirection: "column",
          },
        }}
      >
        <AppShell.Main>
          {/* Custom Title Bar */}
          <TitleBar
            onSettingsClick={() => setSettingsOpened(true)}
            onSearchClick={() => setSearchOpened(true)}
            onHelpClick={() => setHelpOpened(true)}
            onCalendarClick={() => setCalendarOpened(true)}
            onGitCommitClick={handleGitCommit}
            onCommandPaletteClick={() => setCommandPaletteOpened(true)}
            hasGitChanges={hasGitChanges}
            currentWorkspacePath={workspacePath}
          />

          {/* Main Content Panel */}
          <div style={{ flex: 1, overflow: "hidden" }}>
            {!dbInitialized ? (
              <Container size="sm" py="xl" mt={50}>
                <Text ta="center" c="dimmed">
                  Initializing workspace...
                </Text>
              </Container>
            ) : viewMode === "index" ? (
              <FileTreeIndex />
            ) : currentPageId ? (
              <div style={{ height: "100%", overflow: "auto" }}>
                <BlockEditor
                  pageId={currentPageId}
                  workspaceName={workspaceName}
                  pageName={
                    breadcrumb.length > 0 &&
                    breadcrumb[breadcrumb.length - 1] !== workspaceName
                      ? breadcrumb[breadcrumb.length - 1]
                      : undefined
                  }
                  onNavigateHome={showIndex}
                />
              </div>
            ) : (
              <Container size="sm" py="xl" mt={50}>
                <Text ta="center" c="dimmed">
                  No page selected
                </Text>
              </Container>
            )}
          </div>
        </AppShell.Main>
      </AppShell>

      <MigrationDialog
        workspacePath={workspacePath}
        isOpen={showMigration}
        onComplete={handleMigrationComplete}
        onCancel={handleMigrationCancel}
      />

      <SearchModal
        opened={searchOpened}
        onClose={() => setSearchOpened(false)}
      />

      <CommandPalette
        opened={commandPaletteOpened}
        onClose={() => setCommandPaletteOpened(false)}
        onOpenSearch={() => setSearchOpened(true)}
        onOpenCalendar={() => setCalendarOpened(true)}
        onOpenSettings={() => setSettingsOpened(true)}
        onOpenHelp={() => setHelpOpened(true)}
      />

      <CalendarModal
        opened={calendarOpened}
        onClose={() => setCalendarOpened(false)}
      />

      <HelpModal opened={helpOpened} onClose={() => setHelpOpened(false)} />

      <Modal
        opened={settingsOpened}
        onClose={() => setSettingsOpened(false)}
        title="Settings"
        size="md"
      >
        <Stack gap="lg">
          <div>
            <h3 style={{ margin: 0, marginBottom: 12 }}>Theme</h3>
            <div style={{ marginBottom: 8 }}>
              <Text size="sm" fw={500} mb={8}>
                Color Variant
              </Text>
              <SegmentedControl
                value={colorVariant}
                onChange={(value) => setColorVariant(value as ColorVariant)}
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
          </div>

          <div>
            <h3 style={{ margin: 0, marginBottom: 12 }}>Appearance</h3>
            <Stack gap="md">
              <div>
                <Text size="sm" fw={500} mb={8}>
                  Font Family
                </Text>
                <Select
                  value={fontFamily}
                  onChange={(value) => setFontFamily(value as FontFamily)}
                  data={FONT_OPTIONS.map((opt) => ({
                    label: opt.label,
                    value: opt.value,
                  }))}
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
                    Preview: This is how your text will appear
                  </Text>
                </div>
              </div>
            </Stack>
          </div>

          <div>
            <h3 style={{ margin: 0, marginBottom: 8 }}>Outliner</h3>
            <Switch
              label="Show indent guides"
              description="Display vertical lines to show indentation levels"
              checked={showIndentGuides}
              onChange={toggleIndentGuides}
            />
          </div>

          {isGitRepo && (
            <div>
              <h3 style={{ margin: 0, marginBottom: 12 }}>
                Git Version Control
              </h3>
              <Stack gap="md">
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
                      size="xs"
                      variant="light"
                      onClick={handleGitCommit}
                      disabled={!hasGitChanges}
                    >
                      Commit Changes
                    </Button>
                    <Button
                      size="xs"
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
          )}
        </Stack>
      </Modal>
    </>
  );
}

function App() {
  const { workspacePath } = useWorkspaceStore();

  if (!workspacePath) {
    return (
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <ThemeProvider>
          <WorkspaceSelector />
        </ThemeProvider>
      </MantineProvider>
    );
  }

  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <ThemeProvider>
        <AppContent workspacePath={workspacePath} />
      </ThemeProvider>
    </MantineProvider>
  );
}

export default App;
