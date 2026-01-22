# AGENTS.md

## Project Overview
Modern markdown outliner built with Tauri + React + TypeScript. Block-based editing (Logseq-style) with file tree integration.

## Development Commands
- Build: `npm run build`
- Lint: `npm run lint` (auto-fix)
- Format: `npm run format`
- Tests: `npx vitest run` (all), `npx vitest run <file>` (single), `npx vitest` (watch)
- Desktop build: `npm run tauri:build`

## Code Style Guidelines
### Formatting
- 2 spaces, 80 char width, double quotes, semicolons, trailing commas
- `import type` for type-only imports

### Naming
- Components: `ComponentName()` (PascalCase)
- Hooks: `useHookName()` (camelCase, `use` prefix)
- Stores: `useXxxStore()` hook, `xxxStore` constant
- Types: `interface X` (objects), `type X` (unions/primitives)
- Constants: `CONSTANT_NAME`

### Patterns
- React: Functional components, `memo()` for expensive ones
- Zustand: `immer` middleware, `createWithEqualityFn()`, export selectors
- TypeScript: Strict mode, prefer `unknown` over `any`

### Error Handling
- All async file ops need try/catch
- Never empty catch blocks `catch(e) {}`
- Log errors: `console.error("[module] Error:", error)`

### UI Styling (Mandatory)
- **ALL styling MUST use CSS variables** from `src/theme/`
- Use `var(--variable-name)` in CSS
- **Never hardcode colors, spacing, or sizes**

## Commit Format
```
type(scope): message
```
Types: feat, fix, improve, perf, refactor, docs, test, chore

## Workflow
- Major work: Create issue, branch `feature/issue-N-description`
- Minor fixes: Branch `fix/description`
- Lint before commit: `npm run lint`
- PR mandatory, include `Closes #N`
- Auto-merge: `gh pr merge PR_NUM --auto --squash`

## Release (Fully Automated)
- Auto changesets generated after PRs merge
- "chore: Version Packages" PR created automatically
- User merges PR → tag + GitHub release created
- **Never run `npm run release` manually**
