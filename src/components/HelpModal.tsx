import { Box, Modal, ScrollArea } from "@mantine/core";
import { useMantineColorScheme } from "@mantine/core";
import MarkdownIt from "markdown-it";
import { useMemo } from "react";

interface HelpModalProps {
  opened: boolean;
  onClose: () => void;
}

const HELP_CONTENT = `# MD Outliner - Help & Documentation

Welcome to MD Outliner! This guide will help you get started with using the app effectively.

## Overview

MD Outliner is a block-based markdown editor that combines the power of outlining with the simplicity of markdown. Your workspace is stored as plain markdown files on your filesystem.

## Getting Started

### Creating Your First Note

1. Click the **folder icon** in the title bar to select a workspace folder
2. The app will create a Welcome page if your workspace is empty
3. Use the **+ New page** button to create additional pages

### Navigation

- **Home icon** - Return to the index view (file tree)
- **Breadcrumb** - Click any page in the breadcrumb to navigate up
- **File Tree** - Click any page name to open it

## Working with Blocks

### Creating Blocks

- Press **Enter** at the end of a block to create a new block below
- Press **Shift + Enter** to create a line break within a block
- Type \`- \` at the start of a line to create a bullet point

### Editing Blocks

- Click on any block to start editing
- Use markdown syntax for formatting:
  - \`**bold**\` for **bold text**
  - \`*italic*\` or \`_italic_\` for *italic text*
  - \`\`\`code\`\`\` for inline \`code\`
  - \`# Heading\` for headers

### Block Navigation

- **Tab** - Indent block (nest under previous block)
- **Shift + Tab** - Outdent block (move up one level)
- **Arrow Up/Down** - Move between blocks
- **Ctrl/Cmd + Arrow Up/Down** - Move block up/down

### Organizing Blocks

- **Drag bullet icon** - Reorder blocks by dragging
- **Click bullet icon** - Collapse/expand nested blocks
- **Right-click block** - Access block menu (delete, etc.)

## Pages and Hierarchy

### Creating Pages

- Click **+ New page** in the index view
- Or click the **+** icon next to any page to create a child page
- Pages can be nested infinitely to organize your content

### Page Hierarchy

- Pages are organized in a tree structure
- Child pages are indented under their parent
- Each page is stored as a \`.md\` file in your workspace
- Nested pages are stored in folders

## Features

### Search

- Click the **search icon** in the title bar
- Search works across:
  - Page titles
  - Block content
- Results show snippets with highlighted matches
- Press **Enter** or click a result to navigate

### Calendar & Daily Notes

- Click the **calendar icon** to open the calendar
- Click any date to create/open a daily note
- Daily notes are named with format: \`YYYY-MM-DD\`
- Days with existing notes are highlighted
- Quick access to today with the "Go to Today" button

### Workspace Management

- Click the **folder icon** to switch workspaces
- Your workspace path is your source of truth
- All notes are stored as markdown files
- Changes sync automatically to disk

### Settings

- Click the **settings icon** to access preferences
- Toggle indent guides for better visual hierarchy
- More settings coming soon!

### Theme

- Click the **sun/moon icon** to toggle between light and dark mode
- Theme preference is saved automatically

## File Organization

### How Files are Stored

- Each page = one \`.md\` file
- Root pages are stored in the workspace root
- Nested pages are in folders with the parent's name

### Markdown Format

Blocks are stored as nested bullet lists in markdown:

\`\`\`markdown
# Page Title

- First block
  - Nested block
    - Deeply nested block
  - Another nested block
- Second block
\`\`\`

## Tips & Tricks

### Keyboard Shortcuts

- **Enter** - New block below
- **Tab** - Indent block
- **Shift + Tab** - Outdent block
- **Ctrl/Cmd + Arrow Up/Down** - Move block
- **Esc** - Deselect block

### Best Practices

1. **Use descriptive page titles** - They appear in search results
2. **Nest related content** - Keep your hierarchy logical
3. **Collapse large sections** - Click bullets to hide/show nested content
4. **Use daily notes** - Great for journaling and daily tasks
5. **Search often** - Quick way to find what you need

### Organizing Your Workspace

- Create top-level pages for major categories (Projects, Notes, Journal, etc.)
- Use child pages for specific topics or sub-projects
- Daily notes automatically organize chronologically
- Consider a "Inbox" page for quick capture

## Troubleshooting

### Pages Not Appearing

- Make sure you've selected a workspace folder
- Check that the workspace contains \`.md\` files
- Try switching to a different workspace and back

### Changes Not Saving

- Changes save automatically to your markdown files
- Check file permissions in your workspace folder
- Ensure the workspace path is valid

### Performance Issues

- Large pages (1000+ blocks) may be slower
- Consider breaking up very large pages into smaller ones
- Close unused pages to free up memory

## Data & Privacy

### Your Data is Yours

- All notes stored locally on your computer
- No cloud sync, no account required
- Plain markdown files you can backup/version control
- Move your workspace folder anywhere

### Backup Recommendations

- Your workspace is just a folder - back it up like any files
- Use cloud storage (Dropbox, iCloud, etc.) for automatic backup
- Use git for version control (great for tech notes!)

---

**Version:** 0.1.0

Thank you for using MD Outliner! Happy note-taking! 📝`;

export function HelpModal({ opened, onClose }: HelpModalProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";

  const md = useMemo(() => {
    return new MarkdownIt({
      html: false,
      linkify: true,
      typographer: true,
    });
  }, []);

  const htmlContent = useMemo(() => {
    return md.render(HELP_CONTENT);
  }, [md]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Help & Documentation"
      size="xl"
      styles={{
        title: {
          fontSize: "1.1rem",
          fontWeight: 600,
        },
        body: {
          padding: 0,
        },
      }}
    >
      <ScrollArea h={600} type="auto">
        <Box
          style={{
            padding: "20px 24px",
          }}
        >
          {/* biome-ignore security/noDangerouslySetInnerHtml: markdown content is sanitized and user-controlled */}
          <div
            dangerouslySetInnerHTML={{ __html: htmlContent }}
            style={{
              color: isDark ? "#c1c2c5" : "#495057",
              lineHeight: 1.6,
              fontSize: "0.95rem",
            }}
            className="help-content"
          />
        </Box>
      </ScrollArea>

      <style>
        {`
          .help-content h1 {
            font-size: 1.8rem;
            font-weight: 700;
            margin-top: 0;
            margin-bottom: 1rem;
            color: ${isDark ? "#f8f9fa" : "#212529"};
          }

          .help-content h2 {
            font-size: 1.4rem;
            font-weight: 600;
            margin-top: 2rem;
            margin-bottom: 1rem;
            color: ${isDark ? "#e9ecef" : "#343a40"};
            border-bottom: 1px solid ${isDark ? "#373a40" : "#dee2e6"};
            padding-bottom: 0.5rem;
          }

          .help-content h3 {
            font-size: 1.1rem;
            font-weight: 600;
            margin-top: 1.5rem;
            margin-bottom: 0.75rem;
            color: ${isDark ? "#dee2e6" : "#495057"};
          }

          .help-content p {
            margin-bottom: 1rem;
          }

          .help-content ul, .help-content ol {
            margin-bottom: 1rem;
            padding-left: 2rem;
          }

          .help-content li {
            margin-bottom: 0.5rem;
          }

          .help-content code {
            background-color: ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)"};
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
            font-size: 0.9em;
            color: ${isDark ? "#ff6b6b" : "#c92a2a"};
          }

          .help-content pre {
            background-color: ${isDark ? "#1a1b1e" : "#f8f9fa"};
            padding: 1rem;
            border-radius: 6px;
            overflow-x: auto;
            margin-bottom: 1rem;
            border: 1px solid ${isDark ? "#373a40" : "#dee2e6"};
          }

          .help-content pre code {
            background-color: transparent;
            padding: 0;
            color: ${isDark ? "#c1c2c5" : "#495057"};
          }

          .help-content strong {
            font-weight: 600;
            color: ${isDark ? "#f8f9fa" : "#212529"};
          }

          .help-content em {
            font-style: italic;
          }

          .help-content hr {
            border: none;
            border-top: 1px solid ${isDark ? "#373a40" : "#dee2e6"};
            margin: 2rem 0;
          }

          .help-content a {
            color: ${isDark ? "#4dabf7" : "#228be6"};
            text-decoration: none;
          }

          .help-content a:hover {
            text-decoration: underline;
          }
        `}
      </style>
    </Modal>
  );
}
