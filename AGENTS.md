# AGENTS.md

Guidelines for AI agents working in the Oxinot codebase.

## Project Overview

Modern markdown outliner built with **Tauri 2 + React 19 + TypeScript**. Block-based editing (Logseq-style) with file tree integration. Zustand for state management, CodeMirror 6 for text editing.

## Development Commands

```bash
# Build & Development
npm run build              # TypeScript check + Vite build
npm run dev                # Vite dev server (frontend only)
npm run tauri:dev          # Full desktop app dev mode
npm run tauri:build        # Production desktop build

# Code Quality
npm run lint               # Biome lint with auto-fix
npm run format             # Biome format with auto-fix

# Testing (Vitest)
npx vitest run             # Run all tests once
npx vitest run <file>      # Run single test file
npx vitest run -t "test name"  # Run tests matching pattern
npx vitest                 # Watch mode
npx vitest --coverage      # With coverage report

# Rust Backend Tests
cd src-tauri && cargo test # Run Rust tests
```

## Project Structure

```
src/
├── components/           # React components
│   ├── layout/          # Layout components (TitleBar, PageContainer)
│   ├── common/          # Reusable primitives (BulletPoint, etc.)
│   ├── titleBar/        # Titlebar controls
│   └── copilot/         # AI copilot UI components
├── outliner/            # Block editor implementation
├── stores/              # Zustand state management
├── hooks/               # Custom React hooks
├── services/ai/         # AI provider integrations
├── theme/               # Centralized theme system
├── styles/              # Global CSS with CSS variables
├── utils/               # Utility functions
├── editor/              # CodeMirror extensions
└── constants/           # App constants

src-tauri/               # Rust backend (Tauri)
├── src/commands/        # Tauri IPC commands
├── src/services/        # Business logic
└── tests/               # Rust integration tests
```

## Code Style Guidelines

### Formatting (Biome)

- **Indentation**: 2 spaces
- **Line width**: 80 characters
- **Quotes**: Double quotes (`"`)
- **Semicolons**: Always
- **Trailing commas**: Always (ES5+)
- **Line endings**: LF

### Imports

```typescript
// 1. Use `import type` for type-only imports (enforced by Biome)
import type { PageData } from "./types";
import { usePageStore } from "./stores/pageStore";

// 2. Path alias: use @/* for src/* imports
import { tauriAPI } from "@/tauri-api";

// 3. Biome auto-organizes imports - let it handle ordering
```

### Naming Conventions

| Entity | Convention | Example |
|--------|-----------|---------|
| Components | PascalCase function | `function TitleBar()` |
| Hooks | camelCase with `use` prefix | `useKeyboardShortcuts()` |
| Stores | `useXxxStore` hook, `xxxStore` constant | `usePageStore`, `pageStore` |
| Interfaces | PascalCase, prefer `interface` for objects | `interface PageData {}` |
| Types | PascalCase, use `type` for unions/primitives | `type ViewMode = "tree" \| "editor"` |
| Constants | SCREAMING_SNAKE_CASE | `const MAX_RESULTS = 10` |
| Files | camelCase for utils/hooks, PascalCase for components | `pageUtils.ts`, `TitleBar.tsx` |

### TypeScript

```typescript
// Strict mode enabled - respect it
// Never use these:
// - `as any` (use proper types or `unknown`)
// - `@ts-ignore` / `@ts-expect-error`
// - Non-null assertions `!` without good reason

// Prefer `unknown` over `any` for dynamic data
function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
}
```

### React Patterns

```typescript
// Functional components only
export function ComponentName({ prop }: Props) {
  return <div />;
}

// Use memo() for expensive components
export const ExpensiveList = memo(function ExpensiveList({ items }: Props) {
  return items.map(item => <Item key={item.id} {...item} />);
});

// Hooks at top level, early returns after hooks
export function MyComponent({ data }: Props) {
  const [state, setState] = useState(null);
  
  if (!data) return null;  // OK: after hooks
  
  return <div>{data}</div>;
}
```

### Zustand Store Pattern

```typescript
import { immer } from "zustand/middleware/immer";
import { createWithEqualityFn } from "zustand/traditional";

interface StoreState {
  data: Record<string, Item>;
  isLoading: boolean;
}

interface StoreActions {
  loadData: () => Promise<void>;
  updateItem: (id: string, updates: Partial<Item>) => void;
}

type Store = StoreState & StoreActions;

export const useMyStore = createWithEqualityFn<Store>()(
  immer((set, get) => ({
    // State
    data: {},
    isLoading: false,

    // Actions using immer for immutable updates
    loadData: async () => {
      set((state) => { state.isLoading = true; });
      try {
        const result = await fetchData();
        set((state) => {
          state.data = result;
          state.isLoading = false;
        });
      } catch (error) {
        set((state) => { state.isLoading = false; });
        throw error;
      }
    },

    updateItem: (id, updates) => {
      set((state) => {
        if (state.data[id]) {
          Object.assign(state.data[id], updates);
        }
      });
    },
  })),
);

// Export selector hooks for common access patterns
export const useItem = (id: string) => useMyStore((s) => s.data[id]);
export const useIsLoading = () => useMyStore((s) => s.isLoading);
```

### Error Handling

```typescript
// All async file/Tauri operations need try/catch
async function saveFile(path: string, content: string) {
  try {
    await invoke("write_file", { path, content });
  } catch (error) {
    // Never empty catch blocks - always handle or log
    console.error("[saveFile] Failed to save:", error);
    throw error; // Re-throw or handle appropriately
  }
}

// Log with module prefix for traceability
console.error("[pageStore] Error loading pages:", error);
console.log("[BlockEditor] Block created:", blockId);
```

### UI Styling (MANDATORY)

```typescript
// ALL styling MUST use CSS variables from src/theme/ and src/styles/
// ThemeProvider dynamically sets color variables

// CORRECT - use CSS variables
<div style={{
  backgroundColor: "var(--color-bg-primary)",
  color: "var(--color-text-primary)",
  padding: "var(--spacing-md)",
  borderRadius: "var(--radius-md)",
}} />

// WRONG - never hardcode values
<div style={{
  backgroundColor: "#1a1a1d",  // NO!
  color: "#f0f0f2",            // NO!
  padding: "16px",             // NO!
}} />

// Available variable categories:
// Colors: --color-bg-*, --color-text-*, --color-border-*, --color-accent
// Spacing: --spacing-xs/sm/md/lg/xl/xxl
// Typography: --font-size-*, --line-height-*, --font-family
// Layout: --layout-*, --radius-*
// Transitions: --transition-fast/normal/slow
```

### CodeMirror Syntax Highlighting

**IMPORTANT**: Do NOT use CodeMirror's `defaultHighlightStyle`. Always use the custom `customHighlightStyle` defined in `src/editor/createEditor.ts`.

```typescript
// ✅ CORRECT - Using customHighlightStyle with CSS variables
// This is already integrated in createEditor.ts and handles all syntax colors

// Custom highlight style maps syntax tokens to theme variables:
// - t.meta, t.punctuation → --color-text-tertiary (dimmed, for markers)
// - t.keyword, t.string, etc. → --color-text-secondary (normal syntax)
// - t.content → --color-text-primary (regular text)
// - t.comment → --color-text-tertiary (dimmed)
// - t.heading → --color-text-primary (bold)
// - t.link, t.url → --color-accent (highlighted)

// ❌ WRONG - Never use defaultHighlightStyle
// import { defaultHighlightStyle } from "@codemirror/language";
// syntaxHighlighting(defaultHighlightStyle)  // NO! Uses hardcoded colors

// ❌ WRONG - Never override syntax colors with CSS !important
// This breaks the proper extension precedence system
// .cm-string { color: #xyz !important; }  // NO!
```

**Why this matters**:
- `defaultHighlightStyle` uses hardcoded colors (e.g., `#219` for blue)
- These colors don't respect the theme system
- Proper approach: define all syntax colors in `customHighlightStyle` using CSS variables
- This way, dark/light mode and color variants automatically work
- Never fight CodeMirror's precedence with `!important` in CSS

## Testing Guidelines

### Test Structure (Vitest)

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

describe("ModuleName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("functionName", () => {
    it("should do expected behavior", () => {
      const result = functionName(input);
      expect(result).toBe(expected);
    });

    it("should handle edge case", () => {
      expect(() => functionName(null)).toThrow();
    });
  });
});
```

### Mocking

```typescript
// Mock modules
vi.mock("../pageTools", () => ({
  processPageToolCall: vi.fn(),
}));

// Mock with resolved values
vi.mocked(pageTools.processPageToolCall).mockResolvedValue(mockResult);

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
```

### Test File Locations

- Frontend tests: `src/**/__tests__/*.test.ts`
- Rust tests: `src-tauri/tests/*_test.rs`

## Commit Format

```
type(scope): message

# Types: feat, fix, improve, perf, refactor, docs, test, chore
# Examples:
feat(editor): add block drag-and-drop support
fix(store): prevent race condition in page loading
refactor(theme): consolidate color variables
```

## Git Workflow

```bash
# Major features - create issue first
git checkout -b feature/issue-42-block-references

# Minor fixes
git checkout -b fix/titlebar-alignment

# Before commit
npm run lint && npm run format

# PR requirements
# - Reference issue: "Closes #42"
# - Squash merge preferred
gh pr merge PR_NUM --auto --squash
```

## Release Process (Fully Automated)

1. Merge `develop` branch to `main`
2. GitHub Actions automatically:
   - Bumps patch version (e.g., 0.24.3 → 0.24.4)
   - Syncs version to `tauri.conf.json` and `Cargo.toml`
   - Commits version bump with `[skip ci]` flag
   - Creates and pushes version tag (e.g., `v0.24.4`)
   - Builds and creates GitHub release with binaries
3. **Never manually bump versions or create tags**

## Key Dependencies Reference

| Package | Purpose |
|---------|---------|
| `zustand` + `immer` | State management with immutable updates |
| `@codemirror/*` | Text editor core |
| `@tauri-apps/api` | Desktop API bindings |
| `@mantine/core` | UI components (modals, notifications) |
| `react-virtuoso` | Virtualized lists |
| `d3` | Graph visualization |
| `i18next` | Internationalization |
| `zod` | Schema validation |

## Common Pitfalls

1. **Don't hardcode colors/spacing** - Always use CSS variables
2. **Don't suppress TypeScript errors** - Fix them properly
3. **Don't use empty catch blocks** - Log or handle errors
4. **Don't forget `import type`** - Biome enforces this
5. **Don't commit without linting** - Run `npm run lint` first
6. **Don't use `any`** - Use proper types or `unknown`
