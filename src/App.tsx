import { AppShell, Container, Stack, Text } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { useEffect, useState } from "react";
import "@mantine/notifications/styles.css";

import { invoke } from "@tauri-apps/api/core";
import { showToast } from "./utils/toast";
import { useTelemetryStore } from "./stores/telemetryStore";
import { analytics } from "./utils/analytics";

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
import { GraphViewModal } from "./components/GraphViewModal";
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
import { CopilotButton } from "./components/copilot/CopilotButton";
import { CopilotPanel } from "./components/copilot/CopilotPanel";
import { useCopilotUiStore } from "./stores/copilotUiStore";

import { usePageStore } from "./stores/pageStore";
import { useBlockStore } from "./stores/blockStore";
import { useBreadcrumb, useViewMode, useViewStore } from "./stores/viewStore";
import { useWorkspaceStore } from "./stores/workspaceStore";
import { useTranslation } from "react-i18next";
import { useAppSettingsStore } from "./stores/appSettingsStore";
import { useThemeStore } from "./stores/themeStore";
import { useAdvancedSettingsStore } from "./stores/advancedSettingsStore";

import { useHomepage } from "./hooks/useHomepage";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useWorkspaceInitializer } from "./hooks/useWorkspaceInitializer";
import { useCoreCommands } from "./hooks/useCoreCommands";
import { ThemeProvider } from "./theme/ThemeProvider";

function WorkspaceSelector() {
  const {
    selectWorkspace,
    openWorkspace,
    getWorkspaces,
    workspacePath,
    error,
    clearError,
    removeWorkspace,
  } = useWorkspaceStore();
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    const workspaces = getWorkspaces();
    if (workspaces.length > 0 && !workspacePath) {
      // Auto-open last workspace
      setIsRetrying(true);
      openWorkspace(workspaces[0].path)
        .catch(() => {
          // If opening fails, remove invalid workspace and try next one
          removeWorkspace(workspaces[0].path);
          if (workspaces.length > 1) {
            return openWorkspace(workspaces[1].path);
          }
          // If no more workspaces, open file picker
          selectWorkspace();
        })
        .finally(() => setIsRetrying(false));
    } else if (workspaces.length === 0 && !workspacePath) {
      // No workspaces, open file picker
      selectWorkspace();
    }
  }, [
    selectWorkspace,
    openWorkspace,
    getWorkspaces,
    workspacePath,
    removeWorkspace,
  ]);

  const handleRetry = () => {
    clearError();
    const workspaces = getWorkspaces();
    if (workspaces.length > 0) {
      setIsRetrying(true);
      openWorkspace(workspaces[0].path).finally(() => setIsRetrying(false));
    }
  };

  const handleSelectDifferent = () => {
    clearError();
    selectWorkspace();
  };

  if (error) {
    return (
      <Container size="xs" py="xl">
        <Stack align="center" gap="lg" style={{ marginTop: "25vh" }}>
          <Text size="sm" fw={500} c="red">
            Failed to open workspace
          </Text>
          <Text size="xs" c="dimmed" ta="center">
            {error}
          </Text>
          <Stack gap="sm" style={{ width: "100%" }}>
            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              style={{
                padding: "8px 16px",
                backgroundColor: "var(--color-interactive-primary)",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: isRetrying ? "not-allowed" : "pointer",
                opacity: isRetrying ? 0.6 : 1,
              }}
            >
              {isRetrying ? "Retrying..." : "Retry"}
            </button>
            <button
              type="button"
              onClick={handleSelectDifferent}
              disabled={isRetrying}
              style={{
                padding: "8px 16px",
                backgroundColor: "var(--color-bg-secondary)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border-primary)",
                borderRadius: "4px",
                cursor: isRetrying ? "not-allowed" : "pointer",
                opacity: isRetrying ? 0.6 : 1,
              }}
            >
              Select Different Workspace
            </button>
          </Stack>
        </Stack>
      </Container>
    );
  }

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
  const { t } = useTranslation();

  const { selectWorkspace, clearError } = useWorkspaceStore();
  const currentPageId = usePageStore((state) => state.currentPageId);
  const createPage = usePageStore((state) => state.createPage);
  const loadPages = usePageStore((state) => state.loadPages);
  const pagesById = usePageStore((state) => state.pagesById);
  const pageIds = usePageStore((state) => state.pageIds);
  const viewMode = useViewMode();
  const breadcrumb = useBreadcrumb();
  const { showIndex, setWorkspaceName, showPage } = useViewStore();

  const fontFamily = useThemeStore((state) => state.fontFamily);
  const editorFontSize = useThemeStore((state) => state.editorFontSize);
  const editorLineHeight = useThemeStore((state) => state.editorLineHeight);
  const getFontStack = useThemeStore((state) => state.getFontStack);

  // Modal states
  const [settingsOpened, setSettingsOpened] = useState(false);
  const [searchOpened, setSearchOpened] = useState(false);
  const [helpOpened, setHelpOpened] = useState(false);
  const [commandPaletteOpened, setCommandPaletteOpened] = useState(false);
  const [graphViewOpened, setGraphViewOpened] = useState(false);

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

  // Register core commands
  useCoreCommands({
    onOpenSearch: () => setSearchOpened(true),
    onOpenSettings: () => setSettingsOpened(true),
    onOpenHelp: () => setHelpOpened(true),
    onClose: () => setCommandPaletteOpened(false),
  });

  // Setup keyboard shortcuts
  useKeyboardShortcuts({
    onCommandPalette: () => {
      setSearchOpened(false);
      setCommandPaletteOpened((prev) => !prev);
    },
    onSettings: () => setSettingsOpened((prev) => !prev),
    onHelp: () => setHelpOpened((prev) => !prev),
    onSearch: () => {
      setCommandPaletteOpened(false);
      setSearchOpened((prev) => !prev);
    },
    onGraphView: () => setGraphViewOpened((prev) => !prev),
    onNewPage: async () => {
      try {
        const pageId = await createPage("Untitled");
        await loadPages();
        showPage(pageId);
      } catch (error) {
        console.error("Failed to create page:", error);
      }
    },
    onGoHome: () => showIndex(),
    onToggleIndex: () => showIndex(),
    onToggleCopilot: () => useCopilotUiStore.getState().toggle(),
    onUndo: () => useBlockStore.temporal.getState().undo(),
    onRedo: () => useBlockStore.temporal.getState().redo(),
  });

  // Apply saved font, size, and line height settings on mount and when they change
  useEffect(() => {
    // Explicitly use fontFamily to ensure updates when it changes
    if (fontFamily) {
      const fontStack = getFontStack();
      document.documentElement.style.setProperty("--font-family", fontStack);
    }
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
    clearError();
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
            onSearchClick={() => {
              setCommandPaletteOpened(false);
              setSearchOpened(true);
            }}
            onHelpClick={() => setHelpOpened(true)}
            onCommandPaletteClick={() => {
              setSearchOpened(false);
              setCommandPaletteOpened(true);
            }}
            onGraphViewClick={() => setGraphViewOpened(true)}
          />

          <CopilotButton />
          <CopilotPanel />

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
        vacuumDatabase={async () => {
          if (workspacePath) {
            try {
              await invoke("vacuum_db", { workspacePath });
              showToast({
                message: t("settings.advanced.vacuum_db_success"),
                type: "success",
              });
            } catch (error) {
              showToast({
                message: t("settings.advanced.vacuum_db_error", {
                  error: String(error),
                }),
                type: "error",
              });
            }
          }
        }}
        optimizeDatabase={async () => {
          if (workspacePath) {
            try {
              await invoke("optimize_db", { workspacePath });
              showToast({
                message: t("settings.advanced.optimize_db_success"),
                type: "success",
              });
            } catch (error) {
              showToast({
                message: t("settings.advanced.optimize_db_error", {
                  error: String(error),
                }),
                type: "error",
              });
            }
          }
        }}
        t={t}
      />

      {/* Graph View Modal */}
      <GraphViewModal
        opened={graphViewOpened}
        onClose={() => setGraphViewOpened(false)}
        workspacePath={workspacePath}
        currentPageId={currentPageId ?? undefined}
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
  const telemetryEnabled = useAdvancedSettingsStore(
    (state) => state.telemetryEnabled
  );
  const setTelemetryStoreEnabled = useTelemetryStore(
    (state) => state.setEnabled
  );

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

  // Sync telemetry settings with telemetry store and track session
  useEffect(() => {
    setTelemetryStoreEnabled(telemetryEnabled);
    if (telemetryEnabled) {
      analytics.sessionStarted();
    }
  }, [telemetryEnabled, setTelemetryStoreEnabled]);

  if (!workspacePath) {
    return (
      <ThemeProvider>
        <Notifications />
        <WorkspaceSelector />
        <Updater />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <AppContent workspacePath={workspacePath} />
      <SyncProgress />
      <Updater />
    </ThemeProvider>
  );
}

export default App;
