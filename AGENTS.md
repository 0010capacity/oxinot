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

#### Changesets Are Auto-Generated (Main Merge Only!)

**Changesets are automatically created ONLY on main branch** when a feature branch is merged via PR.

**On Feature Branch (No Changesets):**
```bash
git checkout -b issue-123-feature-name
git commit -m "feat(editor): add block templates"
git commit -m "feat(editor): integrate templates"
git push origin issue-123-feature-name
# → No changesets created yet! Clean feature branch.
```

**After PR Merge to Main (Auto-Changeset):**
```bash
# GitHub: Click "Merge pull request"
# ↓
# Git hook runs on main branch
# ↓
# Auto-generates a SINGLE changeset for entire feature:
# .changeset/happy-cats-jump.md
# 
# Content:
# ---
# "oxinot": minor
# ---
# 
# - Add block templates dropdown component
# - Integrate templates with editor
# - Default block templates
```

**Why This Approach?**
- ✅ Feature branches stay clean (no changeset files)
- ✅ PRs are simple (only code changes)
- ✅ One changeset per feature (grouped)
- ✅ Main branch has all changesets (trackable)

**Manual Alternative** (if needed):
```bash
npx changeset add
```

This prompts for:
1. Package selection (select "oxinot")
2. Bump type (major/minor/patch)
3. User-friendly description

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

#### When Changesets Are Auto-Generated

Changesets are **automatically created** for:
- ✅ New features (`feat:`)
- ✅ Bug fixes (`fix:`)
- ✅ Performance improvements (`perf:`)
- ✅ Improvements (`improve:`)

**No action needed** - the Git hook handles it automatically!

#### When Changesets Are NOT Needed

No changesets for these commit types (they're automatically skipped):
- ❌ Refactoring (`refactor:`) - no version bump
- ❌ Documentation (`docs:`) - no version bump
- ❌ Tests (`test:`) - no version bump
- ❌ Build/tooling (`chore:`) - no version bump

These commits won't trigger changeset creation, which is correct.

#### Example: Auto-Changeset in Action

```bash
# You make a change and commit
git commit -m "feat(editor): add block templates dropdown

Users can now insert predefined block templates from a menu."

# Automatically:
# → Git hook detects "feat" type
# → Creates .changeset/happy-cats-jump.md
# → Stages the file automatically
# → Ready to push!

git push origin main
# Your changeset is included automatically
```

Another example:
```bash
git commit -m "fix(db): handle concurrent updates"
# → Changeset auto-created (patch version)

git commit -m "refactor(stores): consolidate state"
# → No changeset (internal refactor, no version bump)

git commit -m "docs: update README"
# → No changeset (documentation only)
```

### Branch Strategy

While development is primarily on `main`, use branches for:
- Large features: `feature/description`
- Bug fixes: `fix/description`
- Experiments: `experiment/description`

Always merge back to `main` when complete.

### Workflow Summary (Super Simple!)

1. **Code**: Make changes to implement features/fixes
2. **Commit**: Use conventional commit format (`feat:`, `fix:`, etc.)
   ```bash
   git commit -m "feat(scope): message"
   ```
3. **Auto-Changeset**: Git hook automatically creates changeset (no action needed!)
4. **Push**: Everything goes together
   ```bash
   git push origin main
   ```
5. **User Releases**: When ready, user runs `npm run release`

**That's it!** Changesets are completely automatic via Git hooks.

### Version File Synchronization

The `sync-versions.js` script automatically synchronizes versions across:
- `package.json` (version field)
- `src-tauri/tauri.conf.json` (version field)
- `src-tauri/Cargo.toml` (version field)

This is run automatically when executing `npm run version`.

## Example Development Session

### Day 1: Implement Block Templates

```bash
# 1. Make code changes
# ... edit src/components/BlockTemplates.tsx ...
# ... edit src/stores/editorStore.ts ...

# 2. Lint and commit with proper format
npm run lint
git add .
git commit -m "feat(editor): add block templates dropdown

Users can now select from predefined block templates.
Includes code, quote, and list templates.
Improves onboarding experience."

# 3. Git hook automatically creates changeset
#    → You'll see output showing changeset was created
#    → Changeset is automatically staged

# 4. Push (changeset is already included)
git push origin main
```

### Day 2: Fix a Bug

```bash
# 1. Make code changes
# ... fix src/db/index.ts ...

# 2. Commit with fix format
git commit -m "fix(db): prevent race condition in concurrent updates

Add database transaction to ensure atomic block updates.
Fixes #42"

# 3. Git hook automatically creates changeset (patch version)
#    → Changeset is automatically staged

# 4. Push
git push origin main
```

### Day 3: User Releases (One Command!)

```bash
# Check what will be released
npm run changeset:status

# Release! That's it!
npm run release

# Automatically:
# → Updates all version files (package.json, tauri.conf.json, Cargo.toml)
# → Builds application
# → Pushes to GitHub
# → GitHub Actions builds for all platforms
# → Creates GitHub Release with binaries

# You're done! The release is live.
```

## Important Notes for AI Agents

- **Always** use conventional commit format: `type(scope): message`
- **Changesets are automatic** - Git hooks create them after each commit! No manual action needed.
- Format and lint code with Biome **before** committing: `npm run lint`
- Commit atomically - one logical change per commit
- If making multiple commits for one feature, each gets its own changeset (automatic)
- Test locally before committing: `npm run build`
- Never force push to main
- Pre-commit hook runs linting automatically - fix any issues before committing

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