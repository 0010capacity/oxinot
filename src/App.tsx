import { useEffect, useState } from "react";
import {
  MantineProvider,
  AppShell,
  Container,
  Group,
  ActionIcon,
  useMantineColorScheme,
  createTheme,
  Stack,
  Text,
  Button,
  Modal,
  Switch,
  Title,
} from "@mantine/core";
import { IconSun, IconMoon, IconSettings } from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspaceStore } from "./stores/workspaceStore";
import { useViewStore, useViewMode, useBreadcrumb } from "./stores/viewStore";
import { usePageStore } from "./stores/pageStore";
import { useOutlinerSettingsStore } from "./stores/outlinerSettingsStore";
import { MigrationDialog } from "./components/MigrationDialog";
import { Breadcrumb } from "./components/Breadcrumb";
import { FileTreeIndex } from "./components/FileTreeIndex";
import { BlockEditor } from "./outliner/BlockEditor";

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
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
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

  const [showMigration, setShowMigration] = useState(false);
  const [dbInitialized, setDbInitialized] = useState(false);
  const [checkingDb, setCheckingDb] = useState(true);
  const [settingsOpened, setSettingsOpened] = useState(false);

  const workspaceName = workspacePath.split("/").pop() || "Workspace";

  useEffect(() => {
    if (!workspacePath) {
      setCheckingDb(false);
      setDbInitialized(false);
      return;
    }

    const checkDatabase = async () => {
      setCheckingDb(true);
      try {
        // Set workspace path in database first
        await invoke("set_workspace_path", { workspacePath });

        await loadPages();
        setDbInitialized(true);
        setShowMigration(false);
        setWorkspaceName(workspaceName);
      } catch (error) {
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
    // Set workspace path after migration
    await invoke("set_workspace_path", { workspacePath });
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
          {/* Top Control Bar */}
          <Group
            justify="space-between"
            p="xs"
            style={{
              borderBottom: `1px solid ${isDark ? "#373A40" : "#e9ecef"}`,
            }}
          >
            <div style={{ flex: 1 }}>
              {dbInitialized && breadcrumb.length > 0 && (
                <Breadcrumb
                  workspaceName={workspaceName}
                  pageName={
                    breadcrumb[breadcrumb.length - 1] !== workspaceName
                      ? breadcrumb[breadcrumb.length - 1]
                      : undefined
                  }
                  onNavigateHome={showIndex}
                />
              )}
            </div>

            <Group gap="xs">
              <ActionIcon
                variant="subtle"
                onClick={() => toggleColorScheme()}
                size="sm"
                title="Toggle theme"
              >
                {isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                size="sm"
                title="Settings"
                onClick={() => setSettingsOpened(true)}
              >
                <IconSettings size={16} />
              </ActionIcon>
            </Group>
          </Group>

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
                <BlockEditor pageId={currentPageId} />
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

      <Modal
        opened={settingsOpened}
        onClose={() => setSettingsOpened(false)}
        title={<Title order={3}>Settings</Title>}
        size="md"
      >
        <Stack gap="lg">
          <div>
            <Title order={5} mb="xs">
              Outliner
            </Title>
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
        <WorkspaceSelector />
      </MantineProvider>
    );
  }

  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <AppContent workspacePath={workspacePath} />
    </MantineProvider>
  );
}

export default App;
