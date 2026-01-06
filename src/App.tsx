import React from "react";
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
} from "@mantine/core";
import { IconSun, IconMoon, IconFolder } from "@tabler/icons-react";
import { BlockEditor } from "./outliner/BlockEditor";
import { Block } from "./outliner/types";
import { blocksToMarkdown } from "./outliner/blockUtils";
import { useWorkspaceStore } from "./stores/workspaceStore";
import { FileTreeView } from "./components/FileTreeView";

import INITIAL_CONTENT from "./initialContent.md?raw";

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
          A markdown outliner with file tree integration
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
  const {
    workspacePath,
    currentFile,
    fileContent,
    setFileContent,
    saveFile,
    selectWorkspace,
  } = useWorkspaceStore();
  const [blocks, setBlocks] = React.useState<Block[]>([]);
  const [showDebug, setShowDebug] = React.useState(false);
  const [markdown, setMarkdown] = React.useState("");
  const [viewMode, setViewMode] = React.useState<"tree" | "editor">("tree");

  const handleBlocksChange = React.useCallback((newBlocks: Block[]) => {
    setBlocks(newBlocks);
    const md = blocksToMarkdown(newBlocks);
    setMarkdown(md);
  }, []);

  // Auto-save when markdown changes and we have a current file
  React.useEffect(() => {
    if (currentFile && markdown && viewMode === "editor") {
      const timeoutId = setTimeout(() => {
        saveFile(currentFile, markdown).catch((err) => {
          console.error("Auto-save failed:", err);
        });
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [markdown, currentFile, saveFile, viewMode]);

  // Switch to editor mode when a file is opened
  React.useEffect(() => {
    if (currentFile) {
      setViewMode("editor");
    }
  }, [currentFile]);

  if (!workspacePath) {
    return <WorkspaceSelector />;
  }

  return (
    <AppShell
      header={{ height: 60 }}
      padding={0}
      styles={(theme) => ({
        main: {
          backgroundColor: isDark ? theme.colors.dark[8] : theme.colors.gray[0],
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
                {viewMode === "tree"
                  ? "File Tree"
                  : currentFile
                    ? currentFile.split("/").pop()?.replace(".md", "")
                    : "Editor"}
              </Text>
            </Group>
            <Group>
              <Button
                variant="subtle"
                size="sm"
                onClick={() =>
                  setViewMode(viewMode === "tree" ? "editor" : "tree")
                }
              >
                {viewMode === "tree" ? "📄 Editor" : "📁 Tree"}
              </Button>
              <ActionIcon
                variant={showDebug ? "filled" : "default"}
                onClick={() => setShowDebug(!showDebug)}
                size="lg"
                aria-label="Toggle debug panel"
                title="Show markdown source"
              >
                <Text size="sm" fw={700}>
                  MD
                </Text>
              </ActionIcon>
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

      <AppShell.Main>
        <div
          style={{
            height: "calc(100vh - 60px)",
            overflow: "hidden",
            display: "flex",
          }}
        >
          <div
            style={{
              flex: showDebug ? "0 0 60%" : "1",
              overflow: "auto",
              transition: "flex 0.2s ease",
            }}
          >
            {viewMode === "tree" ? (
              <FileTreeView />
            ) : (
              <BlockEditor
                initialContent={currentFile ? fileContent : INITIAL_CONTENT}
                theme={isDark ? "dark" : "light"}
                onChange={handleBlocksChange}
                key={currentFile || "default"}
              />
            )}
          </div>
          {showDebug && (
            <div
              style={{
                flex: "0 0 40%",
                borderLeft: `1px solid ${isDark ? "#373A40" : "#e9ecef"}`,
                backgroundColor: isDark ? "#1a1b1e" : "#f8f9fa",
                overflow: "auto",
                padding: "20px",
              }}
            >
              <Group mb="md" justify="space-between">
                <div>
                  <Title order={4}>Markdown Source</Title>
                  <Text size="sm" c="dimmed">
                    {blocks.length} blocks total
                  </Text>
                </div>
              </Group>
              <pre
                style={{
                  fontFamily: "'SF Mono', 'Monaco', 'Consolas', monospace",
                  fontSize: "13px",
                  lineHeight: "1.6",
                  color: isDark ? "#e9ecef" : "#212529",
                  backgroundColor: isDark ? "#25262b" : "#ffffff",
                  padding: "16px",
                  borderRadius: "8px",
                  border: `1px solid ${isDark ? "#373A40" : "#dee2e6"}`,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  margin: 0,
                }}
              >
                {markdown || "// Start typing to see markdown..."}
              </pre>
            </div>
          )}
        </div>
      </AppShell.Main>
    </AppShell>
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
