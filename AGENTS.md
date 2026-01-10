# AGENTS.md

## Project Overview
- Modern markdown outliner built with Tauri + React + TypeScript
- Block-based editing (Logseq-style) with file tree integration
- Local-first with SQLite + filesystem

## Tech Stack
- Frontend: React 19, TypeScript, Mantine UI, Zustand, CodeMirror 6
- Backend: Tauri 2, Rust, SQLite
- Build: Vite

## Repository Layout
- `src/`: React frontend
  - `src/components/`: UI components
  - `src/outliner/`: Block editor implementation
  - `src/stores/`: Zustand state management
  - `src/hooks/`: React hooks
  - `src/tauri-api.ts`: Tauri backend API wrapper
- `src-tauri/`: Rust backend
  - `src-tauri/src/commands/`: Tauri commands
  - `src-tauri/src/db/`: Database logic
  - `src-tauri/src/services/`: Business logic

## Development Commands
- Build: `npm run build`
- Lint: `npm run lint`
- Format: `npm run format`
- Build app: `npm run tauri:build`
- **Do NOT run**: `npm run dev`, `npm run tauri:dev` (long-running processes)

## Work Principles
- Commit per task (feature, bugfix, refactor)
- No report files after completion (save tokens, report via chat)
- No emojis (code, commits, comments)
- Always minimal design
- CLI allowed except real-time servers

## Code Guidelines
- TypeScript strict mode
- Avoid `any` type
- Error handling for all file operations
- Use Biome for formatting/linting
- Performance: virtualization, memoization, debouncing
- Zustand with immer for state updates