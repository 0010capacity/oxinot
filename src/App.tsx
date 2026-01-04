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

const theme = createTheme({
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
});

const INITIAL_CONTENT = `# Welcome to Block-Based Outliner 🧠
This is a **Logseq-style** outliner with *full markdown support*
## Markdown Features
  **Bold text** and *italic text* work perfectly
  \`inline code\` is rendered beautifully
  [Links](https://example.com) are clickable
  You can also use ~~strikethrough~~ text
### Code Blocks
  Here's some JavaScript:
  {
\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
  return true;
}

const result = greet("World");
\`\`\`
  }
### Lists and Formatting
  Regular **bullet** points
  With *nested* formatting
    Even in \`child blocks\`
    > Blockquotes work too!
## Brace Blocks { }
  Type \`{\` to create a multi-line block
  {
This is a brace block.
It can contain multiple lines.
Perfect for longer content!

You can have paragraphs,

And even **markdown** inside.
  }
  Brace blocks are great for:
    Code snippets
    Quotes
    Multi-line notes
## Typography Examples
  # H1 Heading
  ## H2 Heading
  ### H3 Heading
  #### H4 Heading
## Inline Code and Math
  Use \`const x = 42\` for inline code
  Or \`Array.from({ length: 5 })\` for longer expressions
## Project: Build a Blog
  ### Planning Phase
    Define requirements
      User authentication
      Post editor with **markdown**
      Comment system
    Research tech stack
      Frontend: React + TypeScript
      Backend: Node.js + Express
      Database: PostgreSQL
  ### Development
    Setup repository
      \`git init\` and create \`.gitignore\`
      Setup \`package.json\` with dependencies
    Build components
      Header component
      Post list
      Post detail with \`syntax highlighting\`
  ### Testing & Launch
    Write unit tests
    Deploy to production
      Setup CI/CD pipeline
      Configure environment variables
## Learning: React Hooks
  **useState** - State management
    \`const [count, setCount] = useState(0)\`
    Best for simple state
  **useEffect** - Side effects
    Runs after render
    {
useEffect(() => {
  document.title = \`Count: \${count}\`;
  return () => console.log('cleanup');
}, [count]);
    }
  **useCallback** - Memoized functions
  **useMemo** - Memoized values
## Daily Notes - 2024
  ### Today's Tasks ✅
    [x] Review pull requests
    [ ] Team standup at 10am
    [ ] Finish *documentation*
    [ ] Deploy to **staging**
  ### Ideas 💡
    Write blog: "Why Block-Based Editing Changes Everything"
    Add keyboard shortcuts: \`Cmd+K\` for quick search
    Implement block references: \`[[Block ID]]\`
  ### Meetings
    {
**Design Review Meeting**

Attendees: Sarah, John, Mike
Topics:
- New dashboard layout
- Mobile responsiveness
- Color scheme updates

Action items:
1. Update mockups by Friday
2. Schedule follow-up next week
    }
## Getting Started
  Start typing in any block
  Press **Enter** to create a new block
  Press **Tab** to indent (create child)
  Press **Shift+Tab** to outdent
  Use markdown syntax naturally - it renders **live**!
Your First Blocks
  Your text here...
    Add child blocks...
      Go as deep as you need!`;

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
