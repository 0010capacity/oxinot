# Markdown Editor - Hybrid Rendering

A modern, web-based Markdown note editor with **hybrid rendering** capabilities, inspired by Obsidian and Logseq. Built with React, TypeScript, CodeMirror 6, and Mantine.

## Features

### 🎨 Hybrid Rendering (Live Preview)
- Edit Markdown source text directly while seeing rendered elements inline
- No separate preview pane needed
- Seamless editing experience where rendered elements are directly editable

### ✨ Supported Markdown Elements

#### Block Elements
- **Headings** (H1-H6) - Rendered with proper typography, syntax dimmed
- **Code Blocks** - Syntax highlighting with language labels
- **Blockquotes** - Styled with left border and italic text
- **Task Lists** - Interactive checkboxes that toggle on click
- **Lists** - Bullet and numbered lists with proper indentation

#### Inline Elements
- **Emphasis** (*italic*) - Rendered italic with hidden markers
- **Strong** (**bold**) - Rendered bold with hidden markers
- **Inline Code** - Monospace with background highlighting
- **Links** - Underlined and colored, syntax hidden
- **Images** - Support for markdown image syntax

### 🎯 Key Design Principles

1. **Single Source of Truth**: Plain Markdown text is the canonical format
2. **No Feedback Loops**: Clean separation between React state and CodeMirror
3. **Performance**: Viewport-based rendering, only visible elements processed
4. **Progressive Enhancement**: Start with basic styling, add widgets incrementally

## Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **CodeMirror 6** - Powerful text editor
- **Mantine** - Component library and theming
- **Vite** - Fast build tool
- **Lezer** - Incremental parsing for syntax trees

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the editor.

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Architecture

### Directory Structure

```
src/
├── editor/
│   ├── createEditor.ts           # Editor factory with all extensions
│   └── extensions/
│       └── hybridRendering.ts    # Core hybrid rendering logic
├── markdown/
│   └── parser.ts                 # Markdown AST parsing utilities
├── components/
│   └── Editor.tsx                # React wrapper for CodeMirror
├── App.tsx                       # Main application component
└── main.tsx                      # Application entry point
```

### How Hybrid Rendering Works

The hybrid rendering system uses **CodeMirror 6's decoration API** to transform the editing experience:

1. **Syntax Tree Parsing**: CodeMirror's Lezer parser provides a live syntax tree
2. **Decoration Building**: A ViewPlugin scans visible ranges and creates decorations
3. **Widget Insertion**: Interactive widgets (checkboxes) are inserted at specific positions
4. **Mark Decorations**: CSS styling is applied to ranges (headings, emphasis, etc.)
5. **Syntax Hiding**: Markdown syntax characters are dimmed or hidden

#### Three Types of Decorations

1. **Marks** - Apply styling to text ranges (headings, bold, italic)
2. **Widgets** - Insert DOM elements (checkboxes, buttons)
3. **Replace** - Hide or replace text (syntax characters)

### Key Components

#### `hybridRenderingPlugin` (ViewPlugin)
- Scans visible editor viewport
- Builds decoration sets for each markdown element
- Updates decorations on document or viewport changes
- Performance-optimized: only processes visible lines

#### `createEditor()`
- Factory function that assembles all CodeMirror extensions
- Configures markdown language support
- Adds hybrid rendering decorations
- Sets up keymaps and editing behaviors

#### `<Editor>` Component
- React wrapper around CodeMirror EditorView
- Manages editor lifecycle (mount/unmount)
- Handles prop updates without recreating the view
- Prevents feedback loops between React state and CM6

## Customization

### Theme

Toggle between light and dark themes using the moon/sun icon in the header.

### Editor Configuration

Modify `src/editor/createEditor.ts` to adjust:
- Line wrapping
- Line numbers
- Keybindings
- Extensions

### Hybrid Rendering

Customize rendering behavior in `src/editor/extensions/hybridRendering.ts`:
- Add new markdown element support
- Modify widget styling
- Adjust syntax hiding behavior
- Change decoration priorities

## Roadmap

- [ ] Multiple note support with sidebar navigation
- [ ] Local storage / IndexedDB persistence
- [ ] File system access API integration
- [ ] Backlinks and wiki-style links
- [ ] Search and replace
- [ ] Export to HTML/PDF
- [ ] Plugins system
- [ ] Mobile responsive design
- [ ] Collaborative editing

## Inspiration

This project is inspired by:
- **Obsidian** - For its excellent hybrid rendering UX
- **Logseq** - For its block-based editing architecture (code reference)
- **CodeMirror 6** - For its powerful and flexible editor framework

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Development Notes

See [AGENT_NOTES.md](docs/AGENT_NOTES.md) for detailed implementation notes and architecture decisions.