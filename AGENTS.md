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
- `.changeset/`: Changesets configuration for versioning

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

## Commit and Versioning Workflow

### Conventional Commit Format

All commits MUST follow the conventional commits format. This enables automatic changelog generation and semantic versioning.

```
type(scope): subject

body

footer
```

#### Commit Types
- **feat**: New feature (triggers MINOR version bump)
- **fix**: Bug fix (triggers PATCH version bump)
- **improve**: Enhancement/improvement (triggers MINOR version bump)
- **perf**: Performance improvement (triggers PATCH version bump)
- **refactor**: Code refactoring (no version bump)
- **docs**: Documentation changes (no version bump)
- **test**: Test-related changes (no version bump)
- **chore**: Build, dependency, or tooling changes (no version bump)

#### Breaking Changes
For changes that break backward compatibility, append `BREAKING CHANGE:` in the footer:

```
feat(block): redesign block structure

BREAKING CHANGE: Block data format changed from 'content' to 'text'
```

This will trigger a MAJOR version bump.

#### Examples

Good commit message:
```
feat(editor): add block drag-and-drop support

Implement drag-and-drop reordering of blocks with visual feedback.
Uses dnd-kit library for robust drag handling.

Fixes #42
```

Good fix:
```
fix(composition): handle IME composition events correctly

Prevent block content corruption during IME composition.
Reset composition state on Escape key.

Fixes #38
```

### Changesets Workflow

Changesets is used to manage versioning and track changes automatically.

#### Adding a Changeset (After Each Commit)

After committing your changes, run:

```bash
npx changeset add
```

This will prompt you to:
1. Select which package to version (select "oxinot")
2. Choose bump type (major/minor/patch)
3. Provide a brief description of changes

A file will be created in `.changeset/` directory (e.g., `fancy-cats-jump.md`).

**Important**: Commit this changeset file along with your code changes.

#### Changeset File Format

Changesets creates files like `.changeset/fancy-cats-jump.md`:

```markdown
---
"oxinot": minor
---

Added new block templates feature
```

The version level should match your commit type:
- `feat` → `minor`
- `fix` or `perf` → `patch`
- `BREAKING CHANGE` → `major`
- `refactor`, `docs`, `test`, `chore` → no changeset needed

#### When to Create a Changeset

Create a changeset for:
- ✅ New features (feat)
- ✅ Bug fixes (fix)
- ✅ Performance improvements (perf)
- ✅ Improvements (improve)

Do NOT create changesets for:
- ❌ Refactoring (refactor)
- ❌ Documentation (docs)
- ❌ Tests (test)
- ❌ Build/tooling (chore)

#### Skipping Changesets

For internal commits that don't affect the app version, you may skip changesets.

### Branch Strategy

While development is primarily on `main`, use branches for:
- Large features: `feature/description`
- Bug fixes: `fix/description`
- Experiments: `experiment/description`

Always merge back to `main` when complete.

### Workflow Summary

1. **Develop**: Make code changes, following conventional commits
2. **Commit**: Use proper commit messages (feat:, fix:, etc.)
3. **Changeset**: Run `npx changeset add` to record the change
4. **Push**: Commit both code and changeset file
5. **User Triggers Release**: When user is satisfied, they run `npm run release`

The user (not AI) handles the release process, which automatically:
- Updates version in package.json, tauri.conf.json, and Cargo.toml
- Creates a release commit
- Creates Git tag
- Builds the application
- Publishes GitHub Release

### Version File Synchronization

The `sync-versions.js` script automatically synchronizes versions across:
- `package.json` (version field)
- `src-tauri/tauri.conf.json` (version field)
- `src-tauri/Cargo.toml` (version field)

This is run automatically when executing `npm run version`.

## Example Development Session

```bash
# 1. Develop feature
# ... make changes to src/components/Editor.tsx

# 2. Commit with proper format
git add src/components/Editor.tsx
git commit -m "feat(editor): add block templates menu

Add a dropdown menu to insert predefined block templates.
Improves user onboarding experience."

# 3. Add changeset
npx changeset add
# Choose: oxinot
# Choose: minor (because it's a new feature)
# Enter: "Added block templates menu for quick block creation"

# 4. Commit changeset
git add .changeset/
git commit -m "chore: add changeset for block templates feature"

# 5. Push to main
git push origin main

# 6. User reviews and when satisfied, runs:
npm run release
# This automatically handles versioning and building
```

## Important Notes for AI Agents

- Always use conventional commit format strictly
- Always add changesets for feat/fix/improve/perf commits
- Never commit directly to protected branches without proper messages
- Keep changesets focused (one per logical change)
- If you make multiple commits for one feature, only one changeset is needed (group them)
- Format and lint code with Biome before committing
- Ensure all tests pass before committing

## Release Process (User Only)

Users trigger releases with:

```bash
npm run release
```

This command:
1. Runs `changeset version` to update versions everywhere
2. Syncs versions across all config files
3. Builds the application
4. (GitHub Actions will handle tagging and GitHub release)

See `RELEASE.md` for detailed release documentation.