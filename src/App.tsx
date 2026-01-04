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

const theme = createTheme({
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
});

const INITIAL_CONTENT = `Welcome to Block-Based Outliner
This is a Logseq-style outliner where everything is a block
Try these features
  Press Enter to create a new block
  Press Tab to indent a block
  Press Shift+Tab to outdent a block
  Press Alt+Up/Down to move blocks
Features
  Each bullet is a block
  Blocks can be nested infinitely
  Click the arrow to collapse/expand
  Blocks have unique IDs for references
Getting Started
  Start typing anywhere
  Press Enter to create siblings
  Press Tab to create children
  Build your knowledge graph organically
Advanced Tips
  Backspace on empty block merges with previous
  Enter in middle of text splits the block
  Arrow keys navigate between blocks
  All changes are live
Why Block-Based?
  Better for non-linear thinking
  Easy to reorganize ideas
  Natural hierarchy
  Inspired by Roam Research and Logseq
Example: Project Planning
  Define goals
    Research competitors
    Identify target audience
    Set KPIs
  Design phase
    Create wireframes
      Homepage
      Dashboard
      Settings page
    Review with team
  Development
    Frontend setup
    Backend API
    Testing
  Launch
    Marketing campaign
    Monitor metrics
    Gather feedback
Example: Learning Notes
  JavaScript Fundamentals
    Variables and types
      let, const, var
      Primitives vs Objects
    Functions
      Arrow functions
      Closures
      Higher-order functions
    Async programming
      Promises
      Async/await
      Event loop
  React Concepts
    Components
      Functional components
      Class components
    Hooks
      useState
      useEffect
      useReducer
      Custom hooks
    State management
      Context API
      Redux
      Zustand
Daily Journal
  Today's Tasks
    Review pull requests
    Team standup at 10am
    Finish documentation
    Deploy to staging
  Ideas
    Blog post about block-based editing
    Improve keyboard shortcuts
    Add block references
  Notes
    Great article on web performance
    Meeting with design team was productive
Start Your Own Blocks
  Your first block
    Your first child block
      Your first grandchild block
  Your second block
  Your third block`;

function AppContent() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";

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
            <ActionIcon
              variant="default"
              onClick={() => toggleColorScheme()}
              size="lg"
              aria-label="Toggle color scheme"
            >
              {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
            </ActionIcon>
          </Group>
        </Container>
      </AppShell.Header>

      <AppShell.Main>
        <div style={{ height: "calc(100vh - 60px)", overflow: "hidden" }}>
          <BlockEditor
            initialContent={INITIAL_CONTENT}
            theme={isDark ? "dark" : "light"}
          />
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
