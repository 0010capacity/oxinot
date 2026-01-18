# Oxinot

A modern markdown outliner application built with Tauri, React, and TypeScript. This production-ready app combines block-based editing (inspired by Logseq) with an innovative file tree integration system for seamless document organization and navigation.

**Current Version**: 0.16.0 | **License**: GNU GPLv3 | **Status**: Production & Open Source

## 🌟 Features

### Modern Native Desktop UI
- **Custom titlebar with breadcrumb navigation** - Integrated window controls and file path breadcrumbs
- **OS-aware window controls** - Native macOS traffic lights or Windows/Linux standard controls
- **Minimal, distraction-free design** - All controls integrated into titlebar for maximum content space
- **Draggable titlebar** - Move windows naturally from any titlebar area
- **Dark mode by default** - Light mode available; theme persists across sessions

### Unique File Tree Integration
- **No separate file explorer sidebar** - Navigate your entire workspace directly in the main outline view
- **Folder notes** - Every folder automatically gets its own markdown note for metadata and descriptions
- **Unified interface** - Seamlessly switch between file tree view and document editing within the same outliner layout
- **Real markdown files** - Works directly with `.md` files on your filesystem (not proprietary format)

### Powerful Block-based Outliner
- **Logseq-style block editing** - Infinite nesting with Tab/Shift+Tab indentation
- **Live markdown rendering** - See formatted text (headings, bold, lists) as you type
- **Full markdown support** - Headings, code blocks, quotes, lists, inline formatting, links
- **Keyboard-first workflow** - Optimized shortcuts: Tab to indent, Shift+Tab to outdent, Enter for new blocks
- **Block selection and manipulation** - Select, drag, delete, and organize blocks efficiently
- **Search and navigation** - Find pages and blocks across your workspace
- **Subpage hierarchy** - View and navigate child pages within parent documents
- **Graph visualization** - See connections between pages (modal view)

### Local-First & Privacy-Focused
- **Built with Tauri** - Lightweight native app (smaller footprint than Electron)
- **Direct filesystem access** - All files stored as plain markdown on your computer
- **No cloud sync required** - Fully self-contained; optional manual sync with git or cloud storage
- **Auto-save with debouncing** - Changes automatically saved 1 second after you stop typing
- **SQLite + Filesystem** - Fast database for indexing and search; markdown files as source of truth

### Developer-Friendly
- **TypeScript strict mode** - Type-safe codebase
- **Centralized theme system** - All colors, spacing, and typography via CSS variables
- **Clean architecture** - Separated concerns: components, stores, hooks, utilities
- **Comprehensive i18n support** - Ready for internationalization (English, Korean ready)
- **Auto-update system** - Built-in updater with background checks

## 🚀 Getting Started

### Prerequisites
- Node.js 18 or higher
- Rust (for Tauri; install via [rustup](https://rustup.rs/))
- npm or yarn

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/0010capacity/oxinot.git
cd oxinot
```

2. **Install dependencies:**
```bash
npm install
```

3. **Run in development mode** (frontend only - for UI development):
```bash
npm run build
# Then run the built app manually
```

4. **Build desktop app for production:**
```bash
npm run tauri:build
```

The built application will be in `src-tauri/target/release/`.

### First Run
1. Launch the app
2. Select a folder to use as your workspace
3. A `Welcome.md` file will be created if the folder is empty
4. Start creating and organizing your markdown documents!

## 📖 How It Works

### Workspace Selection
When you first launch Oxinot, you'll be prompted to select a workspace folder via a native file picker. This folder becomes your workspace root and contains all your markdown documents.

If the folder is empty, a `Welcome.md` file is automatically created with getting-started tips.

### File Tree View (Default)
The main view displays your workspace as an interactive outline:
- **Folders** appear as collapsible nodes (click arrow to expand)
- **Markdown files** appear as bullet points (without `.md` extension in the display)
- **Folder notes** show alongside folders (e.g., `MyFolder/MyFolder.md`)
- **Subpages** nested under parent documents are displayed in a dedicated section

**Navigation:**
- Click any file/folder to open it
- Click folder arrows to expand/collapse
- Right-click for context menu options (rename, delete, convert)

### Block Editor
When you open a file, you enter the block editor:
- **Block-based editing** - Each line is a block with infinite nesting
- **Tab/Shift+Tab** - Indent/outdent blocks
- **Enter** - Create new block below current
- **Markdown rendering** - Type `# ` for heading, `**text**` for bold, etc.
- **Auto-save** - Changes saved 1 second after you stop typing
- **Return to tree** - Click "Tree" button to go back to file tree view

**Breadcrumb Navigation:**
At the top, you'll see your file path as a clickable breadcrumb. Click any parent folder to navigate up.

### Folder Notes
Every folder has an associated markdown file (e.g., `MyProject/MyProject.md`). This lets you:
- Add descriptions and metadata to folder collections
- Use folders as first-class organizational units
- Include folder-level notes and TODOs

Folder notes are automatically created when you convert a page to a directory.

### Graph View
Click the graph icon (top-right) to see a D3-powered visualization of page connections. This helps you understand relationships between your documents at a glance.

### Search
Use the search modal (Cmd/Ctrl+K) to find pages and blocks across your entire workspace. Results show page path and matching content.

## 🎨 UI Design & Theming

Oxinot features a clean, minimal design optimized for focused writing:

### Design Principles
- **Titlebar-integrated controls** - Everything essential is in the titlebar
- **Breathing room** - Generous padding and spacing for readability
- **Minimal color** - Accent colors used sparingly for important actions
- **Typography-first** - Inter font for excellent readability at any size

### Theme System
- **Color variants** - Choose from multiple accent colors (blue, purple, etc.) in settings
- **Dark/Light mode** - Automatic detection with manual override option
- **Customizable fonts** - Change editor font family and size in settings
- **Persistent preferences** - All settings automatically saved

### Visual Indicators
- **Hover states** - Subtle background changes on interactive elements
- **Selection highlights** - Clear visual feedback for selected items
- **Focus indicators** - Keyboard navigation fully supported
- **Bullet points** - Visual hierarchy through indent levels

## 🛠️ Technology Stack

### Frontend
- **React 19** - Modern UI framework with concurrent features
- **TypeScript** - Full type safety across the codebase
- **Mantine UI** - Polished component library for dialogs, notifications, etc.
- **Zustand** - Lightweight state management with immer middleware
- **CodeMirror 6** - Powerful text editor with syntax highlighting
- **D3.js** - Data-driven graph visualization
- **i18next** - Internationalization framework
- **React Virtuoso** - Efficient virtualization for large lists

### Backend & Desktop
- **Tauri 2** - Rust-powered desktop framework (smaller than Electron)
- **Rust** - File system operations, database management, command execution
- **SQLite** - Fast indexing and search capabilities
- **Native APIs** - File dialogs, notifications, window controls

### Markdown Processing
- **@lezer/markdown** - Efficient markdown parsing
- **markdown-it** - CommonMark rendering
- **Custom block structure** - Proprietary block hierarchy system

### Build & Development
- **Vite** - Lightning-fast build tool
- **Biome** - Fast linter and formatter
- **TypeScript Compiler** - Strict mode type checking
- **Changesets** - Automated versioning and changelog management

## 📁 Project Structure

```
oxinot/
├── src/                              # React frontend source
│   ├── components/
│   │   ├── layout/                   # Layout components (TitleBar, PageContainer)
│   │   ├── common/                   # Reusable primitives (BulletPoint, etc.)
│   │   ├── titleBar/                 # Titlebar controls
│   │   └── [Component].tsx           # Feature components
│   ├── outliner/                     # Block editor implementation
│   │   ├── BlockEditor.tsx           # Main editor container
│   │   ├── BlockComponent.tsx        # Individual block rendering
│   │   └── [BlockFeature].ts         # Editor utilities
│   ├── stores/                       # Zustand state management
│   │   ├── pageStore.ts              # Page/document state
│   │   ├── blockStore.ts             # Block content state
│   │   ├── viewStore.ts              # UI view state
│   │   └── [Store].ts                # Other domain stores
│   ├── theme/                        # Centralized theme system
│   │   ├── ThemeProvider.tsx         # Theme provider component
│   │   ├── colors.ts                 # Color variant definitions
│   │   ├── schema.ts                 # Theme type definitions
│   │   └── [ThemeModule].ts          # Supporting files
│   ├── styles/                       # Global CSS
│   │   ├── variables.css             # CSS custom properties
│   │   ├── base.css                  # Element defaults
│   │   ├── layout.css                # Layout utilities
│   │   └── [StyleFile].css           # Feature styles
│   ├── hooks/                        # React hooks
│   ├── utils/                        # Utility functions
│   ├── tauri-api.ts                  # Tauri IPC wrapper
│   └── App.tsx                       # Root component
│
├── src-tauri/                        # Tauri + Rust backend
│   ├── src/
│   │   ├── commands/                 # Tauri commands
│   │   ├── db/                       # Database models/queries
│   │   ├── services/                 # Business logic
│   │   ├── models/                   # Data type definitions
│   │   └── lib.rs                    # Entry point
│   ├── Cargo.toml                    # Rust dependencies
│   └── tauri.conf.json               # Tauri configuration
│
├── .changeset/                       # Changesets for versioning
├── .github/workflows/                # CI/CD pipelines
├── AGENTS.md                         # AI agent guidelines
├── RELEASE.md                        # Release process documentation
└── package.json                      # Node dependencies & scripts
```

## ⚡ Available Scripts

### Development
- `npm run build` - Build frontend only (for UI development)
- `npm run lint` - Check code with Biome linter
- `npm run format` - Auto-format code with Biome

### Desktop App
- `npm run tauri:build` - Build production desktop app
- `npm run tauri:dev` - Run dev app (frontend + backend) - **do not use in CI**

### Versioning & Release
- `npm run version:sync` - Synchronize versions across config files
- `npm run version` - Update version via changesets
- `npm run release` - Full release process (build + version bump + push)
- `npm run changeset:add` - Add changeset for pending work
- `npm run changeset:status` - Check changeset status

## 🔧 Configuration

### Vite (Frontend Build)
Edit `vite.config.ts` to customize build settings, aliases, and optimizations.

### Tauri (Desktop App)
Edit `src-tauri/tauri.conf.json` for:
- Window size, icon, and appearance
- App metadata (name, version, etc.)
- Build targets and signing
- Update configuration

### Rust Backend
Edit `src-tauri/src/lib.rs` to:
- Add new Tauri commands
- Modify file system operations
- Change database queries

### Theme & Styling
- **Colors**: Edit `src/theme/colors.ts` for color variants
- **Typography**: Edit `src/theme/tokens.ts` for font settings
- **Layout**: Edit `src/styles/variables.css` for spacing/layout constants
- **Global styles**: Edit `src/styles/base.css` for element defaults

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. **Check existing issues** - See if someone is already working on it
2. **Create an issue for major features** - Discuss before implementing
3. **Fork and branch** - Use conventional branch names (`feature/...`, `fix/...`)
4. **Follow code style** - Run `npm run lint` and `npm run format` before committing
5. **Commit messages** - Use conventional commits (`feat:`, `fix:`, `docs:`, etc.)
6. **Test locally** - Build and run the app to verify changes
7. **Submit PR** - Reference related issues in your PR description

For detailed development guidelines, see [AGENTS.md](AGENTS.md).

## 📝 License

This project is licensed under the **GNU General Public License v3.0** - see the [LICENSE](LICENSE) file for details.

### What this means:
- ✅ You can use, modify, and distribute this software freely
- ✅ You can use it for commercial purposes
- ⚠️ If you distribute or modify it, you must share changes under the same GPL v3 license
- ⚠️ You must provide access to the source code
- ⚠️ Include a copy of the license and document any changes you made

For more details, visit [GNU GPL v3](https://www.gnu.org/licenses/gpl-3.0.html).

## 🙏 Acknowledgments

- Inspired by [Logseq](https://logseq.com/) for block-based outlining
- Built with [Tauri](https://tauri.app/) for native desktop performance
- Text editing powered by [CodeMirror](https://codemirror.net/)
- UI components from [Mantine](https://mantine.dev/)
- Icons by [Tabler Icons](https://tabler-icons.io/)
- Graph visualization with [D3.js](https://d3js.org/)

## 🐛 Known Issues & Limitations

- File tree shows only `.md` files (by design - other file types in subdirectories work but aren't displayed)
- No nested workspace support (select one workspace at a time)
- No cloud sync built-in (works with git or manual cloud storage)
- Mobile version not yet available
- Block references/backlinks are planned but not yet implemented

## 🗺️ Roadmap

### Planned Features
- [ ] Block references and backlinks (`[[Link]]` resolution across documents)
- [ ] Advanced search with filters and saved searches
- [ ] Export to PDF/HTML with formatting preservation
- [ ] Multi-workspace support (switch between workspaces without restarting)
- [ ] Plugin system for extensibility
- [ ] Mobile companion app or web view
- [ ] Cloud sync integration (optional)
- [ ] Real-time collaboration (experimental)

### Under Investigation
- Mobile app (native iOS/Android)
- Web version using same backend
- Plugin marketplace
- Template system for note structures

## 📞 Support

- **Bug reports**: Open an [issue](https://github.com/0010capacity/oxinot/issues)
- **Feature requests**: Create an [issue](https://github.com/0010capacity/oxinot/issues) with enhancement label
- **Discussions**: Use [GitHub Discussions](https://github.com/0010capacity/oxinot/discussions)
- **Documentation**: See [AGENTS.md](AGENTS.md) for development guidelines

## 📊 Stats

- **Language**: TypeScript (frontend), Rust (backend)
- **Bundle size**: ~3-4MB (depends on platform)
- **Database**: SQLite (embedded)
- **Framework**: React 19, Tauri 2
- **Package count**: 40+ (production dependencies)

---

**Made with ❤️ for writers, thinkers, and organized minds**