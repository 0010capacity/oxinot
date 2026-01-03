# md-editor — Agent Notes (Principles + Extension Points)

This document exists to help you (or a coding agent) continue work efficiently in later sessions.
Keep it short, implementation-oriented, and opinionated.

## Goals (North Star)
- Build a **web-based Markdown note editor** with **CodeMirror 6** as the editing engine.
- Achieve **Obsidian-like Live Preview**: editing feels like plaintext Markdown, but common constructs render smoothly inline.
- Maintain responsiveness: avoid full re-renders or heavy sync work on every keystroke.

## Current State (MVP)
- Vite + React + TypeScript
- Mantine (AppShell)
- CodeMirror 6 editor panel
- React preview panel rendered via `markdown-it`

Files of interest:
- `src/main.tsx`: Mantine providers
- `src/App.tsx`: editor + preview layout, CM6 setup, markdown-it rendering

## Working Principles
### 1) Single source of truth = Markdown string
- Store the canonical note as a plain Markdown string in React state (for now).
- CM6 owns the interactive editing; React owns layout and preview.

### 2) Avoid feedback loops between React state ↔ CM6
- CM6 update listener calls `onChange(nextMarkdown)` only when `docChanged`.
- When React pushes a new `value` into CM6, first compare to current doc string.
- Never re-create the CM6 `EditorView` on every React render.

### 3) Live Preview is a progressive enhancement (not an all-at-once rewrite)
- Phase 1: Split view editor + preview (already).
- Phase 2: Add **inline render decorations** only for simple patterns (checkboxes, emphasis, links, headings).
- Phase 3: Expand coverage + improve cursor/selection behavior near rendered widgets.

### 4) Performance budget mindset
- Parsing markdown on every keystroke is acceptable for small docs, but don’t assume it scales.
- Prefer:
  - debounce/throttle preview updates (optional toggle),
  - viewport-only rendering,
  - incremental parsing strategies (later).

## Architecture Direction for “Live Preview” (CM6)
### Terminology
- **Source view**: vanilla markdown editing experience.
- **Live preview**: markdown source remains editable, but parts render inline.

### Recommended CM6 approach
Use a `ViewPlugin` that computes `DecorationSet` for visible ranges:
- Read the document text for a range (viewport-based).
- Build decorations:
  - `Decoration.replace()` for fully replacing sequences with widgets (dangerous for editing).
  - `Decoration.widget()` for inserting widgets around text (safer).
  - `Decoration.mark()` to style ranges (best first step).

Preferred progression:
1. Start with `Decoration.mark()` for headings/emphasis/code spans (style-only).
2. Add widgets for task lists:
   - Keep the underlying `- [ ]` text editable.
   - Render a checkbox widget next to it (don’t replace the text initially).
3. Only later consider replacements (e.g., hide markdown syntax) once selection/cursor rules are solid.

### Cursor/selection rules (important)
- Widgets can “trap” the cursor if not careful.
- Avoid replacing large ranges early.
- When you insert widgets, ensure:
  - `ignoreEvent()` policies are correct,
  - click-to-position still lands in the expected text,
  - keyboard navigation doesn’t skip content.

## Rendering & Security
- Current preview uses `dangerouslySetInnerHTML` with `markdown-it` and `html: false`.
- Keep `html: false` unless you add sanitization.
- If you later enable HTML or add plugins that introduce HTML:
  - add a sanitizer step (e.g., DOMPurify),
  - define an allowlist policy.

## Styling
- Mantine controls global theme.
- CM6 theme is currently `oneDark` + a small `EditorView.theme(...)`.
- If you want a more “Obsidian-like” look later:
  - create a dedicated CM6 theme module (e.g., `src/editor/theme.ts`)
  - keep preview CSS in a dedicated file and scoped via a wrapper class.

## Data & Persistence (Next)
Near-term options:
- Local-only notes:
  - `localStorage` for MVP
  - IndexedDB for larger notes / multi-note vault
- Later:
  - file system access API (browser support dependent)
  - sync backend

Recommendation (next step):
- Add a minimal “note storage adapter” interface now, even if it’s only localStorage:
  - keeps app logic clean,
  - makes later sync/storage changes less invasive.

## Suggested Directory Refactor (When It Starts Growing)
- `src/editor/`
  - `createEditor.ts` (construct CM6 state + extensions)
  - `extensions/` (live preview, markdown, keymaps)
  - `theme.ts`
- `src/markdown/`
  - `renderer.ts` (markdown-it config)
- `src/storage/`
  - `adapter.ts`, `localStorageAdapter.ts`

Don’t do this refactor until you feel real pain—MVP iterates faster in fewer files.

## Commit Discipline
Keep commits small and narrative:
- `chore: bootstrap vite react ts`
- `chore: add mantine providers`
- `feat: add codemirror markdown editor`
- `feat: add preview panel via markdown-it`
- `feat: introduce live preview decorations (headings/tasks)`
- `perf: debounce preview render`
- `refactor: extract editor factory`

## Next Concrete Steps (Pick One)
1) **Preview smoothing**
   - debounce preview rendering (~50–120ms)
   - keep editor updates immediate

2) **Live preview “easy win”: task list widgets**
   - detect `- [ ]` / `- [x]` lines in viewport
   - show a checkbox widget while keeping source text intact

3) **Multiple notes**
   - left sidebar note list (Mantine `Navbar`)
   - localStorage persistence

## Known Tradeoffs (Accept for Now)
- Split view is not true Live Preview, but it anchors correctness.
- markdown-it preview and CM6 parsing are separate pipelines for now.
  - Eventually unify semantics or accept slight differences.
