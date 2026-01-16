import {
  AppShell,
  Container,
  MantineProvider,
  Stack,
  Text,
  createTheme,
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { useEffect, useState } from "react";
import "@mantine/notifications/styles.css";

// Prevent default context menu globally
if (typeof window !== "undefined") {
  window.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });
}

import { CommandPalette } from "./components/CommandPalette";
import { ErrorNotifications } from "./components/ErrorNotifications";
import { FileTreeIndex } from "./components/FileTreeIndex";
import { GitStatusIndicator } from "./components/GitStatusIndicator";
import { HelpModal } from "./components/HelpModal";
import { MigrationDialog } from "./components/MigrationDialog";
import { SearchModal } from "./components/SearchModal";
import { SettingsModal } from "./components/SettingsModal";
import { SyncProgress } from "./components/SyncProgress";
import { TitleBar } from "./components/TitleBar";
import { Updater } from "./components/Updater";
import { SnowEffect } from "./components/SnowEffect";
import { BottomLeftControls } from "./components/layout/BottomLeftControls";
import { BlockEditor } from "./outliner/BlockEditor";
import { useOutlinerSettingsStore } from "./stores/outlinerSettingsStore";
import { usePageStore } from "./stores/pageStore";
import { useBreadcrumb, useViewMode, useViewStore } from "./stores/viewStore";
import { useWorkspaceStore } from "./stores/workspaceStore";
import { useTranslation } from "react-i18next";
import { useAppSettingsStore } from "./stores/appSettingsStore";
import { useThemeStore } from "./stores/themeStore";

import { useHomepage } from "./hooks/useHomepage";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useWorkspaceInitializer } from "./hooks/useWorkspaceInitializer";
import { ThemeProvider } from "./theme/ThemeProvider";

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

  const fontFamily = useThemeStore((state) => state.fontFamily);
  const editorFontSize = useThemeStore((state) => state.editorFontSize);
  const editorLineHeight = useThemeStore((state) => state.editorLineHeight);
  const getFontStack = useThemeStore((state) => state.getFontStack);

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

  // Apply saved font, size, and line height settings on mount and when they change
  useEffect(() => {
    const fontStack = getFontStack();
    document.documentElement.style.setProperty("--font-family", fontStack);
    document.documentElement.style.setProperty(
      "--editor-font-size",
      `${editorFontSize}px`
    );
    document.documentElement.style.setProperty(
      "--editor-line-height",
      `${editorLineHeight}`
    );
  }, [fontFamily, editorFontSize, editorLineHeight, getFontStack]);

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
      <SnowEffect />
    </>
  );
}

function App() {
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const { i18n } = useTranslation();
  const language = useAppSettingsStore((state) => state.language);
  const setLanguage = useAppSettingsStore((state) => state.setLanguage);

  useEffect(() => {
    if (!language) {
      // First run: detect system language
      const systemLang = navigator.language;
      const defaultLang = systemLang.startsWith("ko") ? "ko" : "en";

      setLanguage(defaultLang);
      i18n.changeLanguage(defaultLang);
    } else if (i18n.language !== language) {
      // Restore saved language if different from i18n
      i18n.changeLanguage(language);
    }
  }, [language, setLanguage, i18n]);

  if (!workspacePath) {
    return (
      <MantineProvider theme={theme} defaultColorScheme="auto">
        <Notifications />
        <ThemeProvider>
          <WorkspaceSelector />
          <Updater />
        </ThemeProvider>
      </MantineProvider>
    );
  }

  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <ThemeProvider>
        <AppContent workspacePath={workspacePath} />
        <SyncProgress />
        <Updater />
      </ThemeProvider>
    </MantineProvider>
  );
}

export default App;
