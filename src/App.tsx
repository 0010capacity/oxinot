import React from "react";
import {
  MantineProvider,
  AppShell,
  Container,
  Title,
  Text,
  Group,
  ActionIcon,
  useMantineColorScheme,
  createTheme,
} from "@mantine/core";
import { IconSun, IconMoon } from "@tabler/icons-react";
import { BlockEditor } from "./outliner/BlockEditor";
import { Block } from "./outliner/types";
import { blocksToMarkdown } from "./outliner/blockUtils";

import INITIAL_CONTENT from "./initialContent.md?raw";

const theme = createTheme({
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
});

function AppContent() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";
  const [blocks, setBlocks] = React.useState<Block[]>([]);
  const [showDebug, setShowDebug] = React.useState(false);
  const [markdown, setMarkdown] = React.useState("");

  const handleBlocksChange = React.useCallback((newBlocks: Block[]) => {
    setBlocks(newBlocks);
    setMarkdown(blocksToMarkdown(newBlocks));
  }, []);

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
              <Title order={3}>🧠 Block Outliner</Title>
              <Text size="sm" c="dimmed">
                Logseq-style Block Editor
              </Text>
            </Group>
            <Group>
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
            <BlockEditor
              initialContent={INITIAL_CONTENT}
              theme={isDark ? "dark" : "light"}
              onChange={handleBlocksChange}
            />
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
