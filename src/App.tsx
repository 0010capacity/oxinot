import { useEffect, useState } from "react";
import {
  MantineProvider,
  AppShell,
  Container,
  useMantineColorScheme,
  createTheme,
  Stack,
  Text,
  Button,
  Modal,
  Switch,
  Select,
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
import { MigrationDialog } from "./components/MigrationDialog";
import { TitleBar } from "./components/TitleBar";
import { FileTreeIndex } from "./components/FileTreeIndex";
import { BlockEditor } from "./outliner/BlockEditor";
import { SearchModal } from "./components/SearchModal";
import { CalendarModal } from "./components/CalendarModal";
import { HelpModal } from "./components/HelpModal";
import { ThemeProvider } from "./theme/ThemeProvider";
import { useThemeStore } from "./stores/themeStore";
import { SegmentedControl } from "@mantine/core";
import type { ColorVariant } from "./theme/types";

const theme = createTheme({
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
});

function WorkspaceSelector() {
  const { selectWorkspace } = useWorkspaceStore();

  return (
    <Container size="sm" py="xl" mt={100}>
      <Stack align="center" gap="lg">
        <Text size="xl" fw={600}>
          MD Outliner
        </Text>
        <Text size="sm" c="dimmed">
          Select a workspace to begin
        </Text>
        <Button onClick={selectWorkspace} size="md">
          Select Workspace
        </Button>
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

  const workspaceName = workspacePath.split("/").pop() || "Workspace";

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
            onWorkspaceChange={selectWorkspace}
            onSearchClick={() => setSearchOpened(true)}
            onHelpClick={() => setHelpOpened(true)}
            onCalendarClick={() => setCalendarOpened(true)}
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
