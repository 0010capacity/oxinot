import { useEffect, useState } from "react";
import {
  MantineProvider,
  AppShell,
  Container,
  Title,
  Text,
  Group,
  ActionIcon,
  Button,
  useMantineColorScheme,
  createTheme,
  Stack,
  Loader,
} from "@mantine/core";
import { IconSun, IconMoon, IconFolder } from "@tabler/icons-react";
import { useWorkspaceStore } from "./stores/workspaceStore";
import {
  usePageStore,
  useCurrentPageId,
  usePagesLoading,
} from "./stores/pageStore";
import { MigrationDialog } from "./components/MigrationDialog";
import { PageSidebar } from "./components/PageSidebar";
import { BlockEditor } from "./outliner/BlockEditor";

const theme = createTheme({
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
});

function WorkspaceSelector() {
  const { selectWorkspace } = useWorkspaceStore();

  return (
    <Container size="sm" py="xl" mt={100}>
      <div style={{ textAlign: "center" }}>
        <Title order={1} mb="md">
          📝 MD Outliner
        </Title>
        <Text size="lg" c="dimmed" mb="xl">
          A markdown outliner with database-driven organization
        </Text>
        <Button
          size="lg"
          leftSection={<IconFolder size={20} />}
          onClick={selectWorkspace}
        >
          Select Workspace Folder
        </Button>
      </div>
    </Container>
  );
}

function AppContent() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";

  const { workspacePath, selectWorkspace } = useWorkspaceStore();
  const { loadPages } = usePageStore();
  const currentPageId = useCurrentPageId();
  const pagesLoading = usePagesLoading();

  const [showMigration, setShowMigration] = useState(false);
  const [dbInitialized, setDbInitialized] = useState(false);
  const [checkingDb, setCheckingDb] = useState(true);
  const [viewMode, setViewMode] = useState<"sidebar" | "tree">("sidebar");

  // Check if database is initialized when workspace is selected
  useEffect(() => {
    if (!workspacePath) {
      setCheckingDb(false);
      setDbInitialized(false);
      return;
    }

    const checkDatabase = async () => {
      setCheckingDb(true);
      try {
        // Try to load pages - if this succeeds, DB is initialized
        await loadPages();
        setDbInitialized(true);
        setShowMigration(false);
      } catch (error) {
        // DB not initialized, show migration dialog
        setDbInitialized(false);
        setShowMigration(true);
      } finally {
        setCheckingDb(false);
      }
    };

    checkDatabase();
  }, [workspacePath, loadPages]);

  const handleMigrationComplete = async () => {
    setShowMigration(false);
    setDbInitialized(true);
    // Reload pages after migration
    await loadPages();
  };

  const handleMigrationCancel = () => {
    setShowMigration(false);
    selectWorkspace();
  };

  if (!workspacePath) {
    return <WorkspaceSelector />;
  }

  if (checkingDb) {
    return (
      <Container size="sm" py="xl" mt={100}>
        <div style={{ textAlign: "center" }}>
          <Loader size="lg" mb="md" style={{ margin: "0 auto" }} />
          <Text>Checking workspace...</Text>
        </div>
      </Container>
    );
  }

  return (
    <>
      <AppShell
        header={{ height: 60 }}
        navbar={
          dbInitialized
            ? {
                width: 280,
                breakpoint: "sm",
                collapsed: { mobile: viewMode === "sidebar", desktop: false },
              }
            : undefined
        }
        padding={0}
        styles={(theme) => ({
          main: {
            backgroundColor: isDark
              ? theme.colors.dark[8]
              : theme.colors.gray[0],
            height: "100vh",
          },
        })}
      >
        <AppShell.Header>
          <Container fluid h="100%" px="md">
            <Group h="100%" justify="space-between">
              <Group>
                <Title order={3}>📝 MD Outliner</Title>
                <Text size="sm" c="dimmed">
                  {workspacePath.split("/").pop()}
                </Text>
              </Group>
              <Group>
                {dbInitialized && currentPageId && (
                  <Button
                    variant="subtle"
                    size="sm"
                    onClick={() =>
                      setViewMode(viewMode === "sidebar" ? "tree" : "sidebar")
                    }
                  >
                    {viewMode === "sidebar" ? "📁 Tree" : "📄 Pages"}
                  </Button>
                )}
                <ActionIcon
                  variant="default"
                  onClick={selectWorkspace}
                  size="lg"
                  aria-label="Change workspace"
                  title="Change workspace"
                >
                  <IconFolder size={18} />
                </ActionIcon>
                <ActionIcon
                  variant="default"
                  onClick={() => toggleColorScheme()}
                  size="lg"
                  aria-label="Toggle color scheme"
                >
                  {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
                </ActionIcon>
              </Group>
            </Group>
          </Container>
        </AppShell.Header>

        {dbInitialized && (
          <AppShell.Navbar
            p="md"
            style={{ backgroundColor: isDark ? "#1a1b1e" : "#f8f9fa" }}
          >
            <PageSidebar />
          </AppShell.Navbar>
        )}

        <AppShell.Main style={{ overflow: "hidden" }}>
          {!dbInitialized ? (
            <Container size="sm" py="xl" mt={50}>
              <Stack align="center">
                <Loader />
                <Text>Initializing workspace...</Text>
              </Stack>
            </Container>
          ) : pagesLoading ? (
            <Container size="sm" py="xl" mt={50}>
              <Stack align="center">
                <Loader />
                <Text>Loading pages...</Text>
              </Stack>
            </Container>
          ) : currentPageId ? (
            <BlockEditor pageId={currentPageId} />
          ) : (
            <Container size="sm" py="xl" mt={50}>
              <Stack align="center">
                <Text c="dimmed">Select a page to begin</Text>
              </Stack>
            </Container>
          )}
        </AppShell.Main>
      </AppShell>

      {/* Migration Dialog */}
      <MigrationDialog
        workspacePath={workspacePath}
        isOpen={showMigration}
        onComplete={handleMigrationComplete}
        onCancel={handleMigrationCancel}
      />
    </>
  );
}

function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <AppContent />
    </MantineProvider>
  );
}

export default App;
