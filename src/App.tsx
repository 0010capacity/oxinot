import { useEffect, useState } from "react";
import {
  MantineProvider,
  AppShell,
  Container,
  createTheme,
  Stack,
  Text,
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import "@mantine/notifications/styles.css";

import { useWorkspaceStore } from "./stores/workspaceStore";
import { useViewStore, useViewMode, useBreadcrumb } from "./stores/viewStore";
import { usePageStore } from "./stores/pageStore";
import { useOutlinerSettingsStore } from "./stores/outlinerSettingsStore";
import { MigrationDialog } from "./components/MigrationDialog";
import { TitleBar } from "./components/TitleBar";
import { FileTreeIndex } from "./components/FileTreeIndex";
import { BlockEditor } from "./outliner/BlockEditor";
import { SearchModal } from "./components/SearchModal";
import { HelpModal } from "./components/HelpModal";
import { CommandPalette } from "./components/CommandPalette";
import { SyncProgress } from "./components/SyncProgress";
import { BottomLeftControls } from "./components/layout/BottomLeftControls";
import { SettingsModal } from "./components/SettingsModal";
import { GitStatusIndicator } from "./components/GitStatusIndicator";
import { ErrorNotifications } from "./components/ErrorNotifications";
import { Updater } from "./components/Updater";

import { ThemeProvider } from "./theme/ThemeProvider";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useWorkspaceInitializer } from "./hooks/useWorkspaceInitializer";
import { useHomepage } from "./hooks/useHomepage";

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
  }, [selectWorkspace, openWorkspace, getWorkspaces]);

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
  const { selectWorkspace } = useWorkspaceStore();
  const currentPageId = usePageStore((state) => state.currentPageId);
  const pagesById = usePageStore((state) => state.pagesById);
  const pageIds = usePageStore((state) => state.pageIds);
  const viewMode = useViewMode();
  const breadcrumb = useBreadcrumb();
  const { showIndex, setWorkspaceName } = useViewStore();

  const getFontStack = useOutlinerSettingsStore((state) => state.getFontStack);

  // Modal states
  const [settingsOpened, setSettingsOpened] = useState(false);
  const [searchOpened, setSearchOpened] = useState(false);
  const [helpOpened, setHelpOpened] = useState(false);
  const [commandPaletteOpened, setCommandPaletteOpened] = useState(false);

  const workspaceName = workspacePath.split("/").pop() || "Workspace";

  // Homepage management hook
  const { openHomepage } = useHomepage();

  // Workspace initialization hook
  const {
    isChecking,
    isInitialized,
    showMigration,
    handleMigrationComplete,
    handleMigrationCancel,
  } = useWorkspaceInitializer(workspacePath, openHomepage, setWorkspaceName);

  // Setup keyboard shortcuts
  useKeyboardShortcuts({
    onCommandPalette: () => setCommandPaletteOpened(true),
    onSettings: () => setSettingsOpened(true),
    onHelp: () => setHelpOpened(true),
  });

  // Apply saved font on mount
  useEffect(() => {
    const fontStack = getFontStack();
    document.documentElement.style.setProperty("--font-family", fontStack);
  }, [getFontStack]);

  const handleMigrationCancelWithWorkspace = () => {
    handleMigrationCancel();
    selectWorkspace();
  };

  if (isChecking) {
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
            backgroundColor: "var(--color-bg-primary)",
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          },
        }}
      >
        <AppShell.Main>
          {/* Custom Title Bar */}
          <TitleBar currentWorkspacePath={workspacePath} />

          {/* Bottom Left Controls */}
          <BottomLeftControls
            onHomeClick={openHomepage}
            onSettingsClick={() => setSettingsOpened(true)}
            onSearchClick={() => setSearchOpened(true)}
            onHelpClick={() => setHelpOpened(true)}
            onCommandPaletteClick={() => setCommandPaletteOpened(true)}
          />

          {/* Main Content Panel */}
          <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            {!isInitialized ? (
              <Container size="sm" py="xl" mt={50}>
                <Text ta="center" c="dimmed">
                  Initializing workspace...
                </Text>
              </Container>
            ) : viewMode === "index" ? (
              <FileTreeIndex />
            ) : currentPageId ? (
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
            ) : (
              <Container size="sm" py="xl" mt={50}>
                <Text ta="center" c="dimmed">
                  No page selected
                </Text>
              </Container>
            )}
          </div>

          {/* Git Status Indicator - Bottom Right */}
          <GitStatusIndicator workspacePath={workspacePath} />
        </AppShell.Main>
      </AppShell>

      {/* Migration Dialog */}
      <MigrationDialog
        workspacePath={workspacePath}
        isOpen={showMigration}
        onComplete={handleMigrationComplete}
        onCancel={handleMigrationCancelWithWorkspace}
      />

      {/* Search Modal */}
      <SearchModal
        opened={searchOpened}
        onClose={() => setSearchOpened(false)}
      />

      {/* Command Palette */}
      <CommandPalette
        opened={commandPaletteOpened}
        onClose={() => setCommandPaletteOpened(false)}
        onOpenSearch={() => setSearchOpened(true)}
        onOpenSettings={() => setSettingsOpened(true)}
        onOpenHelp={() => setHelpOpened(true)}
      />

      {/* Help Modal */}
      <HelpModal opened={helpOpened} onClose={() => setHelpOpened(false)} />

      {/* Settings Modal */}
      <SettingsModal
        opened={settingsOpened}
        onClose={() => setSettingsOpened(false)}
        workspacePath={workspacePath}
        pagesById={pagesById}
        pageIds={pageIds}
      />

      <Notifications />
      <ErrorNotifications />
    </>
  );
}

function App() {
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);

  if (!workspacePath) {
    return (
      <MantineProvider theme={theme}>
        <Notifications />
        <ThemeProvider>
          <WorkspaceSelector />
          <Updater />
        </ThemeProvider>
      </MantineProvider>
    );
  }

  return (
    <MantineProvider theme={theme}>
      <ThemeProvider>
        <AppContent workspacePath={workspacePath} />
        <SyncProgress />
        <Updater />
      </ThemeProvider>
    </MantineProvider>
  );
}

export default App;
