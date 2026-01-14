# Oxinot

A modern, local-first markdown outliner built with Tauri, React, and TypeScript. Combining block-based editing with file system integration.

## ✨ Features

- **Block-Based Editing**: Logseq-style outliner with infinite nesting and markdown support.
- **Local-First**: Works directly with `.md` files on your local file system.
- **SQLite Indexing**: Fast metadata storage and querying for a responsive experience.
- **Minimalist Design**: Custom native-like titlebar, dark mode, and distraction-free interface.
- **Unified Navigation**: File tree integrated directly into the outliner view.

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Mantine UI, Zustand, CodeMirror 6, Vite
- **Backend**: Tauri 2, Rust, SQLite

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Rust (latest stable)

### Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri:dev

# Build for production
npm run tauri:build
```

## 📝 License

Licensed under **GNU GPL v3.0**. See [LICENSE](LICENSE) for details.