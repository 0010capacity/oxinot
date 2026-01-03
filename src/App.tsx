import { useState } from "react";
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
import { Editor } from "./components/Editor";

const theme = createTheme({
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
});

const INITIAL_CONTENT = `# Welcome to Hybrid Markdown Editor

This editor uses **hybrid rendering** - you can edit the source text while seeing rendered elements inline. No split view needed!

## ✨ Live Preview Features

As you type, markdown elements render automatically:

- **Headings** get styled with proper typography (hash marks are dimmed)
- **Emphasis** and **bold** text render while hiding the syntax markers
- **Code blocks** get syntax highlighting
- **Task lists** become interactive checkboxes
- **Links** are styled and clickable

## 🎯 Try These Examples

### Task Lists (Click the checkboxes!)

- [ ] Write your first note
- [ ] Try editing this text while it's rendered
- [ ] Check off completed tasks
- [x] Marvel at the seamless experience

### Inline Formatting

You can mix *italic text*, **bold text**, and \`inline code\` naturally. The markdown syntax becomes dimmed or hidden as you type.

Try this: **click inside this bold text** and you'll see the \`**\` markers appear for editing!

### Code Blocks

\`\`\`typescript
// Code blocks maintain syntax
function hybridRender(markdown: string): Element {
  return parse(markdown).map(element =>
    element.render({ editable: true })
  );
}
\`\`\`

\`\`\`python
def fibonacci(n):
    """Generate fibonacci sequence"""
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b
\`\`\`

### Links and Blockquotes

Check out [CodeMirror 6](https://codemirror.net) for the powerful editor framework that makes this possible.

> **Pro tip:** This is a blockquote. Click into it to edit - the \`>\` marker will stay visible while you type, then dim again when you move away.

### Lists

Regular lists work great too:

1. First item
2. Second item
3. Third item

And bullet lists:

- Unordered item
- Another item
  - Nested items work too
  - With proper indentation

---

**Start typing anywhere to experience the magic of hybrid rendering!** ✨

The key insight: you're always editing plain markdown text, but the UI makes it *feel* like you're editing a rendered document.

### Tables

Tables are rendered with clean styling:

| Feature | Status | Notes |
|---------|--------|-------|
| Headings | ✅ | H1-H6 supported |
| Task Lists | ✅ | Interactive checkboxes |
| Tables | ✅ | You're looking at one! |
| Code Blocks | ✅ | Syntax highlighting |
| Inline Styles | ✅ | Bold, italic, code |

Try clicking into the table - the pipe characters (\`|\`) will dim but stay editable!

### GFM Features

GitHub Flavored Markdown is fully supported!

**Strikethrough**: Use ~~two tildes~~ to cross out text.

**Autolinks**: URLs like https://github.com automatically become clickable.

**Footnotes**: Add references[^1] to your text and define them at the bottom.

### More Examples

You can combine features: **bold with ~~strikethrough~~** or *italic with ~~strikethrough~~*.

Task lists work great in GFM:
- [x] Support basic markdown
- [x] Add GFM extensions
- [ ] Add math equations
- [ ] Add diagrams

---

## 🔮 Obsidian Features

This editor now supports **Obsidian Flavored Markdown**!

### Wiki Links

Connect your notes with [[internal links]] or use aliases like [[long note name|short alias]].

You can also link to headings: [[note#heading]] or blocks: [[note#^block-id]]

### Tags

Organize with #tags and #nested/tags. Tags can appear anywhere: at the start, middle #inline, or end of a line.

Common tags: #todo #important #project/work #ideas/creative

### Highlights

Use ==highlighted text== to emphasize important information. The ==yellow background== makes it stand out!

### Comments

Add %%private comments%% that won't appear in the rendered view. %%This is only visible when you click on it!%%

### Callouts

Create beautiful callouts for different purposes:

> [!note] Note
> This is a note callout with helpful information.

> [!tip] Pro Tip
> Use callouts to draw attention to important points!

> [!warning] Warning
> Be careful with this operation!

> [!success] Success
> Everything is working perfectly!

> [!question] Question
> Did you know you can use collapsible callouts?

> [!example] Example
> Here's a practical example of the concept.

### Mix Everything Together

You can combine ==Obsidian features== with regular **markdown** and even add #tags to [[wiki-linked notes]]. %%This creates a powerful note-taking experience!%%

---

[^1]: This is a footnote. It will appear with special styling and can contain more detailed information.
`;

function AppContent() {
  const [content, setContent] = useState(INITIAL_CONTENT);
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
              <Title order={3}>📝 Markdown Editor</Title>
              <Text size="sm" c="dimmed">
                Hybrid Rendering
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
          <Editor
            value={content}
            onChange={setContent}
            theme={isDark ? "dark" : "light"}
            lineWrapping={true}
          />
        </div>
      </AppShell.Main>
    </AppShell>
  );
}

function App() {
  return (
    <MantineProvider theme={theme}>
      <AppContent />
    </MantineProvider>
  );
}

export default App;
