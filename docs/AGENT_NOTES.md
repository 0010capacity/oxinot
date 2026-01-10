# md-editor — Agent Notes (Principles + Extension Points)

This document exists to help you (or a coding agent) continue work efficiently in later sessions.
Keep it short, implementation-oriented, and opinionated.

## Goals (North Star)
- Build a **web-based Markdown note editor** with **CodeMirror 6** as the editing engine.
- Achieve **Obsidian-like Live Preview**: editing feels like plaintext Markdown, but common constructs render smoothly inline.
- Maintain responsiveness: avoid full re-renders or heavy sync work on every keystroke.

## Embeds (DECISION) — 100% identical rendering via existing Outliner renderer
### What we want
Embeds must render **exactly like the outliner** (same visuals, same hybrid rendering, same interactions):
- Embedded block: `!((blockId))`
- Embedded page: `![[Page]]`
- Must support link navigation immediately (no “click once to focus then click again”)
- Must be **read-only as a card** (no caret/selection/editing), while still allowing:
  - Task checkbox toggles
  - Internal navigation (page links / block links)
  - External link opening

### What we will NOT do (abandoned)
**Do not** implement embeds by “serializing a subtree into a synthetic Markdown string” and rendering it inside a nested CodeMirror instance.
Reasons:
- Markdown block-level parsing inside list items is inherently fragile (`- ### Heading` etc.)
- Even with heuristics, it will drift from the main renderer
- It introduces theme/focus/selection quirks and duplicate navigation handlers
- It becomes a second rendering pipeline to keep in sync (guaranteed divergence)

### The correct implementation direction (next session)
**Reuse the existing outliner block renderer** (React + `BlockComponent`/editor) and add an “embed/read-only” mode:
1) Refactor `src/outliner/BlockComponent.tsx` into:
   - A store-connected container (loads block/children + actions from stores)
   - A pure/presentational renderer (e.g., `BlockView`) that accepts:
     - `block`, `childIds`, `depth`, `readOnly`
     - callbacks for navigation and checkbox toggling
2) Implement embed cards as React components that render a local block tree:
   - `EmbeddedBlockCard`: fetch subtree by block id, normalize into local `blocksById` + `childrenMap`, render `BlockView` tree
   - `EmbeddedPageCard`: fetch page blocks, normalize, render `BlockView` tree
3) Read-only behavior:
   - Editors inside embeds run with `readOnly=true` and do not take focus/selection
   - Disable outliner keybindings (Enter/Backspace/indent/nav) inside embeds
   - Keep *only* the intended interactions: checkbox toggle + link navigation
4) Checkbox toggles must persist:
   - Checkbox click should update the *real* block content (same path as the main outliner update)
   - Do not mutate a synthetic doc that cannot be persisted

This keeps embeds 100% consistent with the main editor and eliminates duplication.

## Current State (Implemented!)
- ✅ Vite + React + TypeScript bootstrapped
- ✅ Mantine UI (AppShell with theme toggle)
- ✅ CodeMirror 6 with hybrid rendering
- ✅ Full Markdown support with inline decorations
- ✅ Interactive elements (task checkboxes)
- ✅ Light/dark theme switching

Files of interest:
- `src/main.tsx`: Application entry point with Mantine providers
- `src/App.tsx`: Main app shell with theme toggle and editor integration
- `src/components/Editor.tsx`: React wrapper for CM6 editor
- `src/editor/createEditor.ts`: Editor factory with all extensions
- `src/editor/extensions/hybridRendering.ts`: **Core hybrid rendering implementation**
- `src/markdown/parser.ts`: Markdown AST parsing utilities
- `src/outliner/BlockComponent.tsx`: Current block renderer (needs refactor into container + presentational component for embeds)

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
- ✅ Viewport-only rendering implemented (only visible ranges processed)
- ✅ Incremental parsing via Lezer (CodeMirror's parser)
- Decorations rebuild only on docChanged or viewportChanged
- No full-document parsing on every keystroke

## Architecture Implementation (DONE!)
### ✅ Hybrid Rendering via CM6 ViewPlugin

Implemented in `src/editor/extensions/hybridRendering.ts`:

**What's Working:**
- `ViewPlugin` computes `DecorationSet` for visible viewport ranges
- Three decoration types used strategically:
  - `Decoration.mark()` - Styles text ranges (headings, bold, italic, code, blockquotes)
  - `Decoration.widget()` - Interactive checkboxes for task lists
  - `hiddenDecoration()` - Dims/hides markdown syntax (##, **, *, [], etc)

**Implemented Elements:**
1. ✅ **Headings (H1-H6)** - Font size scaling, syntax dimmed
2. ✅ **Task Lists** - Interactive checkboxes, click to toggle
3. ✅ **Emphasis/Bold** - Rendered with hidden markers
4. ✅ **Inline Code** - Monospace with background
5. ✅ **Code Blocks** - Styled with dimmed fences
6. ✅ **Links** - Blue underlined text, syntax hidden
7. ✅ **Blockquotes** - Left border and italic styling

**Key Implementation Details:**
- Checkbox widgets handle click events and update document
- Syntax markers (**, *, ##, etc) are dimmed via `opacity: 0.3`
- All text remains editable - widgets are non-intrusive
- Cursor navigation works naturally around widgets

### Cursor/selection rules (implemented correctly!)
- ✅ Widgets use `ignoreEvent()` to handle click events properly
- ✅ Checkboxes only capture their own click events
- ✅ Text remains editable around all widgets
- ✅ No range replacements - all markdown source stays in document
- ✅ Keyboard navigation works naturally

## Rendering & Security
- ✅ No separate preview panel - hybrid rendering only
- ✅ No `dangerouslySetInnerHTML` used
- ✅ All rendering via CodeMirror decorations (DOM elements created safely)
- Security handled by CM6's widget system

## Styling
- ✅ Mantine controls global theme with light/dark mode toggle
- ✅ CM6 custom theme in `createEditor.ts` with light/dark variants
- ✅ Hybrid rendering theme in `hybridRendering.ts`
- ✅ Global CSS in `src/index.css`
- Theme switches automatically when user toggles moon/sun icon

## Data & Persistence (TODO - Next Priority)
Current: In-memory only (content lost on refresh)

Near-term options:
- **localStorage** for MVP (quick win)
- IndexedDB for larger notes / multi-note vault
- File System Access API (Chrome/Edge)
- Later: sync backend

Recommendation (next step):
- Add localStorage auto-save with debounce
- Create storage adapter interface for future flexibility
- Add "note list" in sidebar

## ✅ Directory Structure (Implemented)
```
src/
├── editor/
│   ├── createEditor.ts           # CM6 factory with extensions
│   └── extensions/
│       └── hybridRendering.ts    # Core hybrid rendering
├── markdown/
│   └── parser.ts                 # AST parsing utilities
├── components/
│   └── Editor.tsx                # React wrapper for CM6
├── App.tsx                       # Main app with theme toggle
├── main.tsx                      # Entry point
└── index.css                     # Global styles
```

Clean, organized, ready to extend.

## Commit Discipline
Keep commits small and narrative:
- `chore: bootstrap vite react ts`
- `chore: add mantine providers`
- `feat: add codemirror markdown editor`
- `feat: add preview panel via markdown-it`
- `feat: introduce live preview decorations (headings/tasks)`
- `perf: debounce preview render`
- `refactor: extract editor factory`

## ✅ Completed Steps
1. ✅ Hybrid rendering working perfectly
2. ✅ Task list widgets with click-to-toggle
3. ✅ Theme toggle (light/dark)
4. ✅ All basic markdown elements rendering

## Next Concrete Steps (Priority Order)
1) **Local Storage Persistence** ⭐ TOP PRIORITY
   - Auto-save current note to localStorage
   - Restore on app load
   - Debounce saves (~500ms)

2) **Multiple Notes Support**
   - Left sidebar with note list
   - Add/delete/rename notes
   - Active note highlighting

3) **Enhanced Markdown**
   - Tables support
   - Footnotes
   - Math equations (KaTeX)

4) **Advanced Features**
   - Search across all notes
   - Backlinks / wiki-style [[links]]
   - Tags and metadata
   - Export to HTML/PDF

## Known Tradeoffs / Future Improvements
- No persistence yet (in-memory only)
- Single note only (no multi-note support)
- No syntax highlighting in code blocks yet (could add Prism.js)
- No image rendering (shows as text)
- No table rendering (shows as text)
- Heading widgets commented out (mark-based styling works better)

## Performance Notes
- Viewport-only rendering keeps it fast even with large documents
- Lezer parsing is incremental and efficient
- Decoration rebuilds are cheap (only visible range)
- Tested smooth with 1000+ line documents
