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
  TextInput,
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import "@mantine/notifications/styles.css";

import { invoke } from "@tauri-apps/api/core";
import { showToast } from "./utils/toast";
import { useWorkspaceStore } from "./stores/workspaceStore";
import { useViewStore, useViewMode, useBreadcrumb } from "./stores/viewStore";
import { usePageStore } from "./stores/pageStore";
import {
  useOutlinerSettingsStore,
  FONT_OPTIONS,
  type FontFamily,
} from "./stores/outlinerSettingsStore";
import { useGitStore } from "./stores/gitStore";
import {
  useClockFormatStore,
  type TimeFormat,
  type DateOrder,
  type DateSeparator,
} from "./stores/clockFormatStore";
import { useAppSettingsStore } from "./stores/appSettingsStore";
import { MigrationDialog } from "./components/MigrationDialog";
import { TitleBar } from "./components/TitleBar";
import { FileTreeIndex } from "./components/FileTreeIndex";
import { BlockEditor } from "./outliner/BlockEditor";
import { SearchModal } from "./components/SearchModal";
import { HelpModal } from "./components/HelpModal";
import { CommandPalette } from "./components/CommandPalette";
import { SyncProgress } from "./components/SyncProgress";
import { BottomLeftControls } from "./components/layout/BottomLeftControls";

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
  const { loadPages, createPage } = usePageStore();
  const currentPageId = usePageStore((state) => state.currentPageId);
  const setCurrentPageId = usePageStore((state) => state.setCurrentPageId);
  const pagesById = usePageStore((state) => state.pagesById);
  const pageIds = usePageStore((state) => state.pageIds);
  const viewMode = useViewMode();
  const breadcrumb = useBreadcrumb();
  const { showIndex, setWorkspaceName, openNote } = useViewStore();

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

  const timeFormat = useClockFormatStore((state) => state.timeFormat);
  const dateOrder = useClockFormatStore((state) => state.dateOrder);
  const dateSeparator = useClockFormatStore((state) => state.dateSeparator);
  const setTimeFormat = useClockFormatStore((state) => state.setTimeFormat);
  const setDateOrder = useClockFormatStore((state) => state.setDateOrder);
  const setDateSeparator = useClockFormatStore(
    (state) => state.setDateSeparator,
  );

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
  const getDailyNotePath = useAppSettingsStore(
    (state) => state.getDailyNotePath,
  );

  const colorVariant = useThemeStore((state) => state.colorVariant);
  const setColorVariant = useThemeStore((state) => state.setColorVariant);

  const [showMigration, setShowMigration] = useState(false);
  const [dbInitialized, setDbInitialized] = useState(false);
  const [checkingDb, setCheckingDb] = useState(true);
  const [settingsOpened, setSettingsOpened] = useState(false);
  const [searchOpened, setSearchOpened] = useState(false);

  const [helpOpened, setHelpOpened] = useState(false);
  const [commandPaletteOpened, setCommandPaletteOpened] = useState(false);

  // Git state
  const hasGitChanges = useGitStore((state) => state.hasChanges);
  const isGitRepo = useGitStore((state) => state.isRepo);
  const initGit = useGitStore((state) => state.initGit);
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

  // Git commit handler - immediate commit with timestamp
  const handleGitCommit = async () => {
    if (!workspacePath || !hasGitChanges) return;
    const timestamp = new Date().toLocaleString();
    try {
      const result = await gitCommit(workspacePath, `Update: ${timestamp}`);
      if (result.success) {
        showToast({ message: "Committed", type: "success" });
      }
    } catch (error) {
      showToast({ message: "Commit failed", type: "error", duration: 2000 });
    }
  };

  // Initialize git repo check and status on workspace load
  useEffect(() => {
    if (workspacePath) {
      initGit(workspacePath).then(() => {
        checkGitStatus(workspacePath);
      });
    }
  }, [workspacePath, initGit, checkGitStatus]);

  // Periodic Git status check (every 3 seconds)
  useEffect(() => {
    if (!workspacePath || !isGitRepo) return;

    const intervalId = setInterval(() => {
      checkGitStatus(workspacePath);
    }, 3000);

    return () => clearInterval(intervalId);
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

        // Open homepage after initialization
        openHomepage();
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

  // Open homepage function
  const openHomepage = async () => {
    if (homepageType === "index") {
      // Open file tree / workspace index
      showIndex();
    } else if (homepageType === "daily-note") {
      // Open today's daily note
      const today = new Date();
      const fullPath = getDailyNotePath(today);

      // Find existing daily note
      const existingPageId = pageIds.find((id) => {
        const page = pagesById[id];
        if (!page) return false;

        const buildPath = (pageId: string): string => {
          const p = pagesById[pageId];
          if (!p) return "";
          if (p.parentId) {
            const parentPath = buildPath(p.parentId);
            return parentPath ? `${parentPath}/${p.title}` : p.title;
          }
          return p.title;
        };

        return buildPath(id) === fullPath;
      });

      if (existingPageId) {
        const page = pagesById[existingPageId];
        const parentNames: string[] = [];
        const pagePathIds: string[] = [];

        const buildParentPath = (pageId: string) => {
          const p = pagesById[pageId];
          if (!p) return;

          if (p.parentId) {
            buildParentPath(p.parentId);
            const parentPage = pagesById[p.parentId];
            if (parentPage) {
              parentNames.push(parentPage.title);
              pagePathIds.push(p.parentId);
            }
          }
        };

        buildParentPath(existingPageId);
        pagePathIds.push(existingPageId);

        setCurrentPageId(existingPageId);
        openNote(existingPageId, page.title, parentNames, pagePathIds);
      } else {
        // Create daily note if it doesn't exist
        try {
          const pathParts = fullPath.split("/");
          let parentId: string | undefined = undefined;

          for (let i = 0; i < pathParts.length; i++) {
            const currentPath = pathParts.slice(0, i + 1).join("/");

            const existingPage = pageIds.find((id) => {
              const p = pagesById[id];
              if (!p) return false;

              const buildPath = (pageId: string): string => {
                const page = pagesById[pageId];
                if (!page) return "";
                if (page.parentId) {
                  const parentPath = buildPath(page.parentId);
                  return parentPath
                    ? `${parentPath}/${page.title}`
                    : page.title;
                }
                return page.title;
              };

              return buildPath(id) === currentPath;
            });

            if (existingPage) {
              parentId = existingPage;
            } else {
              const newPageId = await createPage(pathParts[i], parentId);
              parentId = newPageId;
            }
          }

          // Reload pages and find the created page
          await loadPages();

          const freshPagesById = usePageStore.getState().pagesById;
          const freshPageIds = usePageStore.getState().pageIds;

          const createdPageId = freshPageIds.find((id) => {
            const p = freshPagesById[id];
            if (!p) return false;

            const buildPath = (pageId: string): string => {
              const page = freshPagesById[pageId];
              if (!page) return "";
              if (page.parentId) {
                const parentPath = buildPath(page.parentId);
                return parentPath ? `${parentPath}/${page.title}` : page.title;
              }
              return page.title;
            };

            return buildPath(id) === fullPath;
          });

          if (createdPageId) {
            const createdPage = freshPagesById[createdPageId];
            const parentNames: string[] = [];
            const pagePathIds: string[] = [];

            const buildParentPath = (pageId: string) => {
              const page = freshPagesById[pageId];
              if (!page) return;

              if (page.parentId) {
                buildParentPath(page.parentId);
                const parentPage = freshPagesById[page.parentId];
                if (parentPage) {
                  parentNames.push(parentPage.title);
                  pagePathIds.push(page.parentId);
                }
              }
            };

            buildParentPath(createdPageId);
            pagePathIds.push(createdPageId);

            setCurrentPageId(createdPageId);
            openNote(
              createdPageId,
              createdPage.title,
              parentNames,
              pagePathIds,
            );
          }
        } catch (error) {
          console.error("Failed to create daily note:", error);
          showIndex();
        }
      }
    } else if (homepageType === "custom-page" && customHomepageId) {
      // Open custom homepage
      const page = pagesById[customHomepageId];
      if (page) {
        const parentNames: string[] = [];
        const pagePathIds: string[] = [];

        const buildParentPath = (pageId: string) => {
          const p = pagesById[pageId];
          if (!p) return;

          if (p.parentId) {
            buildParentPath(p.parentId);
            const parentPage = pagesById[p.parentId];
            if (parentPage) {
              parentNames.push(parentPage.title);
              pagePathIds.push(p.parentId);
            }
          }
        };

        buildParentPath(customHomepageId);
        pagePathIds.push(customHomepageId);

        setCurrentPageId(customHomepageId);
        openNote(customHomepageId, page.title, parentNames, pagePathIds);
      } else {
        showIndex();
      }
    } else {
      // Fallback to index
      showIndex();
    }
  };

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

          {/* Git Status Indicator - Bottom Right */}
          {isGitRepo && (
            <div
              style={{
                position: "fixed",
                bottom: "12px",
                right: "12px",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: hasGitChanges
                  ? isDark
                    ? "#ffd43b"
                    : "#fab005"
                  : isDark
                    ? "#5c5f66"
                    : "#adb5bd",
                cursor: hasGitChanges ? "pointer" : "default",
                opacity: hasGitChanges ? 1 : 0.4,
                transition: "opacity 0.2s ease, background-color 0.2s ease",
                zIndex: 50,
              }}
              onClick={handleGitCommit}
              onMouseEnter={(e) => {
                if (hasGitChanges) {
                  e.currentTarget.style.opacity = "0.7";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = hasGitChanges ? "1" : "0.4";
              }}
              title={hasGitChanges ? "Click to commit changes" : "No changes"}
            />
          )}
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
        onOpenSettings={() => setSettingsOpened(true)}
        onOpenHelp={() => setHelpOpened(true)}
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
            <h3 style={{ margin: 0, marginBottom: 12 }}>Clock Format</h3>
            <Stack gap="md">
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
                  onChange={(value) => setDateSeparator(value as DateSeparator)}
                  data={[
                    { label: "Slash (/)", value: "/" },
                    { label: "Hyphen (-)", value: "-" },
                  ]}
                  placeholder="Select separator"
                />
              </div>
              <div
                style={{
                  padding: 12,
                  borderRadius: 6,
                  backgroundColor: isDark ? "#2C2E33" : "#F1F3F5",
                }}
              >
                <Text size="xs" c="dimmed">
                  Preview:{" "}
                  {useClockFormatStore.getState().formatDate(new Date())} |{" "}
                  {useClockFormatStore.getState().formatTime(new Date())}
                </Text>
              </div>
            </Stack>
          </div>

          <div>
            <h3 style={{ margin: 0, marginBottom: 12 }}>Daily Notes</h3>
            <Stack gap="md">
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
            </Stack>
          </div>

          <div>
            <h3 style={{ margin: 0, marginBottom: 12 }}>Homepage</h3>
            <Stack gap="md">
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
        <Notifications />
        <ThemeProvider>
          <WorkspaceSelector />
        </ThemeProvider>
      </MantineProvider>
    );
  }

  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <Notifications />
      <ThemeProvider>
        <AppContent workspacePath={workspacePath} />
        <SyncProgress />
      </ThemeProvider>
    </MantineProvider>
  );
}

export default App;
