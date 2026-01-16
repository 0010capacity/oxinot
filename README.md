# Oxinot

A modern markdown outliner application built with Tauri, React, and TypeScript. This app combines the power of block-based outliner editing (like Logseq) with a unique file tree navigation system.

<!-- Testing auto-changeset PR workflow -->

## 🌟 Features

### Modern Desktop UI
- **Custom titlebar** - Native-looking titlebar with integrated breadcrumb navigation
- **OS-aware window controls** - macOS traffic lights or Windows/Linux controls
- **Minimal design** - All controls in the titlebar for maximum content space
- **Draggable titlebar** - Move the window naturally from the title area

### Unique File Tree Integration
- **No separate file explorer sidebar** - Navigate your workspace directly in the main outliner view
- **Folder notes** - Every folder automatically gets its own markdown note
- **Unified interface** - Switch seamlessly between file tree view and document editing with the same outliner layout

### Powerful Outliner Editor
- **Block-based editing** - Logseq-style outliner with infinite nesting
- **Live markdown rendering** - See formatted text as you type
- **Full markdown support** - Headings, code blocks, lists, links, and more
- **Keyboard-first workflow** - Tab/Shift+Tab for indenting, Enter for new blocks

### Local-First & Fast
- **Built with Tauri** - Lightweight desktop app powered by Rust
- **Direct file system access** - Work with real `.md` files on your computer
- **Auto-save** - Changes are automatically saved to disk
- **SQLite + Filesystem** - Database for quick navigation, markdown files as source of truth

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- Rust (for Tauri)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd oxinot
```

2. Install dependencies:
```bash
npm install
```

3. Run in development mode:
```bash
npm run tauri:dev
```

4. Build for production:
```bash
npm run tauri:build
```

## 📖 How It Works

### Workspace Selection
When you first launch the app, you'll be prompted to select a workspace folder. This folder will contain all your markdown documents.

If the folder is empty, a `Welcome.md` file is automatically created to help you get started.

### File Tree View
The main view shows your workspace as an outliner structure:
- **Folders** appear as collapsible nodes with folder icons
- **Markdown files** appear as bullet points (without `.md` extension)
- Click any file to open it in the editor
- Click folders to expand/collapse their contents

### Document Editing
When you open a file:
- Switch to editor mode with the "📄 Editor" button
- Edit using the block-based outliner interface
- Changes are auto-saved after 1 second of inactivity
- Return to file tree view with the "📁 Tree" button

### Folder Notes
Every folder automatically has a folder note (e.g., `MyFolder/MyFolder.md`). This lets you:
- Add descriptions and metadata to folders
- Organize your thoughts about a collection of documents
- Use folders as first-class outline nodes

## 🎨 UI Design

The interface is inspired by modern note-taking apps with a clean, minimal design:
- **Custom titlebar** - Native window controls integrated with breadcrumb navigation
- **Dark mode by default** (light mode available via titlebar toggle)
- **Tabler icons** for a consistent, modern look
- **Inter font** for excellent readability
- **Hover interactions** - Controls appear when you need them
- **No clutter** - All controls in titlebar, maximum space for content

## 🛠️ Technology Stack

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Mantine UI** - Component library
- **Zustand** - State management
- **CodeMirror 6** - Advanced text editing
- **Vite** - Fast build tool

### Backend
- **Tauri 2** - Desktop app framework with custom titlebar
- **Rust** - File system operations
- **SQLite** - Fast metadata storage and search
- **Native dialogs** - Folder selection

### Markdown Processing
- **@lezer/markdown** - Parsing
- **markdown-it** - Rendering
- Custom block-based data structure

## 📁 Project Structure

```
oxinot/
├── src/
│   ├── components/       # UI Components
│   ├── stores/           # Zustand state stores
│   ├── utils/            # Helper functions
├── src-tauri/                # Rust backend
│   ├── src/
│   │   └── lib.rs            # File system commands
│   ├── Cargo.toml            # Rust dependencies
│   └── tauri.conf.json       # Tauri configuration
└── package.json              # Node dependencies
```

## ⚡ Available Scripts

- `npm run dev` - Start Vite dev server only
- `npm run tauri:dev` - Run full Tauri app in development
- `npm run build` - Build frontend only
- `npm run tauri:build` - Build complete desktop app
- `npm run lint` - Run ESLint

## 🔧 Configuration

### Vite (Frontend)
Edit `vite.config.ts` to customize build settings.

### Tauri (App)
Edit `src-tauri/tauri.conf.json` for:
- Window size and appearance
- App metadata
- Build targets

### Rust Backend
Edit `src-tauri/src/lib.rs` to add new commands or modify file system operations.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is licensed under the **GNU General Public License v3.0** - see the [LICENSE](LICENSE) file for details.

### What this means:
- ✅ You can use, modify, and distribute this software
- ✅ You can use it commercially
- ⚠️ If you distribute or modify it, you must share your changes under the same GPL v3 license
- ⚠️ You must provide access to the source code
- ⚠️ Include a copy of the license and state what changes you made

For more information, visit [GNU GPL v3](https://www.gnu.org/licenses/gpl-3.0.html)

## 🙏 Acknowledgments

- Inspired by [Logseq](https://logseq.com/) for block-based editing
- Built with [Tauri](https://tauri.app/) for native performance
- Uses [CodeMirror](https://codemirror.net/) for text editing

## 🐛 Known Issues

- File tree only shows `.md` files (by design)
- No search functionality yet
- No block references/backlinks yet

## 🗺️ Roadmap

- [ ] File search
- [ ] Block references and backlinks
- [ ] Multiple workspace support
- [ ] Keyboard shortcuts reference
- [ ] Export to PDF/HTML
- [ ] Mobile version
- [ ] Cloud sync options