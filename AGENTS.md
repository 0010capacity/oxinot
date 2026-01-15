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
- Do NOT run: `npm run dev`, `npm run tauri:dev` (long-running processes)

## Work Principles
- Commit per task (feature, bugfix, refactor)
- Issue-based development: major work gets Issues, minor fixes can skip
- No report files after completion
- No emojis in code, commits, or comments
- Always minimal design
- CLI allowed except real-time servers

## Code Guidelines
- TypeScript strict mode
- Avoid `any` type
- Error handling for all file operations
- Use Biome for formatting/linting
- Performance: virtualization, memoization, debouncing
- Zustand with immer for state updates

## Issue and Branch Workflow

### When to Create Issues

Determine issue necessity based on commit type:

Create Issues:
- feat (new features) - always
- improve (enhancements) - always
- fix (major bug fixes) - if substantial or user-impacting
- perf (performance) - if significant

Skip Issues:
- fix (minor bugs) - typos, small bugs
- docs (documentation) - unless significant
- refactor (refactoring) - internal changes only
- chore (build/tooling) - no issue needed

### Issue Creation with Templates

Use gh CLI with appropriate templates (template name, not filename):

```bash
# Bug fix
gh issue create --title "Bug: ..." --template "Bug Report" --label bug

# New feature
gh issue create --title "Feature: ..." --template "Feature Request" --label enhancement

# Improvement
gh issue create --title "Improve: ..." --template "Improvement" --label enhancement

# Documentation
gh issue create --title "Docs: ..." --template "Documentation" --label documentation
```

Extract issue number for branch naming:
```bash
ISSUE_NUM=$(gh issue create --title "..." --template "..." | grep -oP '#\K\d+')
git checkout -b feature/issue-${ISSUE_NUM}-description
```

### Branch Naming Convention

```bash
# With issue (e.g., issue #42)
git checkout -b feature/issue-42-description

# Without issue (minor changes)
git checkout -b fix/description
```

Format: `type/[issue-NUMBER-]description`

### Development Workflow

1. Assess task scope and create issue if needed
2. Extract issue number if created
3. Create branch with appropriate prefix
4. Make changes and lint: `npm run lint`
5. Commit with conventional format: `type(scope): message`
6. Push branch: `git push origin branch-name`
7. Create PR with issue reference: `gh pr create --title "..." --body "Closes #42"`
8. Enable auto-merge: `gh pr merge PR_NUMBER --auto --squash`
9. CI runs automatically (lint-and-build required)
10. PR auto-merges when CI passes (branch protection enforced)
11. Issue auto-closes when PR merges

Branch protection rules active:
- Direct push to main blocked
- PR required for all changes
- CI must pass before merge
- Auto-merge enabled when CI passes

### Example: Feature with Issue

```bash
# User request: "Add dark mode toggle"
# Decision: feat type, create issue

# Create issue and extract number
ISSUE_NUM=$(gh issue create \
  --title "Feature: Add dark mode toggle" \
  --template "Feature Request" \
  --label enhancement | grep -oP '#\K\d+')
# Returns: 43

# Create branch with issue number
git checkout -b feature/issue-${ISSUE_NUM}-dark-mode-toggle

# Make changes and commit
npm run lint
git commit -m "feat(theme): add dark mode toggle

Add theme selector to settings menu.
Uses Mantine's useColorScheme hook.

Closes #43"

# Push and create PR with issue reference
git push origin feature/issue-${ISSUE_NUM}-dark-mode-toggle
PR_URL=$(gh pr create --title "feat(theme): add dark mode toggle" \
  --body "Add theme toggle to settings menu.

Closes #${ISSUE_NUM}")

# Extract PR number and enable auto-merge
PR_NUMBER=$(echo "$PR_URL" | grep -oP '\d+$')
gh pr merge "$PR_NUMBER" --auto --squash

# Auto-merge when CI passes, issue auto-closes
```

### Example: Minor Fix without Issue

```bash
# User request: "Fix typo in README"
# Decision: docs type, no issue

# Create branch directly
git checkout -b fix/readme-typo

# Make changes and commit
git commit -m "docs: fix typo in README"

# Push and create PR
git push origin fix/readme-typo
PR_URL=$(gh pr create --title "docs: fix typo in README" \
  --body "Fix typo in README file.")

# Enable auto-merge
PR_NUMBER=$(echo "$PR_URL" | grep -oP '\d+$')
gh pr merge "$PR_NUMBER" --auto --squash

# Auto-merge when CI passes
```

## Commit and Versioning Workflow

### Conventional Commit Format

All commits MUST follow conventional commits format:

```
type(scope): subject

body

footer
```

### Commit Types

- feat: New feature (triggers MINOR version bump)
- fix: Bug fix (triggers PATCH version bump)
- improve: Enhancement/improvement (triggers MINOR version bump)
- perf: Performance improvement (triggers PATCH version bump)
- refactor: Code refactoring (no version bump)
- docs: Documentation changes (no version bump)
- test: Test-related changes (no version bump)
- chore: Build, dependency, or tooling changes (no version bump)

### Breaking Changes

For backward-incompatible changes, append in footer:

```
feat(block): redesign block structure

BREAKING CHANGE: Block data format changed from 'content' to 'text'
```

This triggers MAJOR version bump.

### Commit Examples

```
feat(editor): add block drag-and-drop support

Implement drag-and-drop reordering with visual feedback.
Uses dnd-kit library for robust drag handling.

Fixes #42
```

```
fix(composition): handle IME composition events correctly

Prevent block content corruption during IME composition.
Reset composition state on Escape key.

Fixes #38
```

### Changesets Workflow

Changesets are automatically generated after PRs merge to main, and a version PR is created.

#### How It Works

1. **PR merges to main** → CI passes
2. **Auto Changeset workflow** runs and analyzes commits since last release
3. **Changeset file generated** in `.changeset/` directory based on commit types
4. **Changeset PR created** by Release workflow (chore: Version Packages)
5. **User merges PR** → version bumps, changelog updated, git tag created
6. **Build and Release workflow** runs → GitHub release created with binaries

#### Changeset Rules

Changesets auto-generated for:
- feat: New features (triggers MINOR version bump)
- improve: Enhancements (triggers MINOR version bump)
- fix: Bug fixes (triggers PATCH version bump)
- perf: Performance improvements (triggers PATCH version bump)

No changesets for:
- refactor: Internal refactoring
- docs: Documentation only
- test: Test changes
- chore: Build/tooling

#### Auto-Changeset Example

```bash
# When PR is merged to main:
# 1. CI passes on main branch
# 2. Auto Changeset workflow runs
# 3. Analyzes commits since last release
# 4. Detects commit types (feat, fix, perf, improve)
# 5. Generates single changeset with highest version bump
# 6. Creates PR: "chore: Version Packages"

# Example: PR with these commits merged:
# - feat(editor): add block templates dropdown
# - fix(editor): handle edge case in template selection

# Auto Changeset creates .changeset/happy-cats-jump.md:
# ---
# "oxinot": minor
# ---
# 
# - add block templates dropdown
# - handle edge case in template selection

# Release workflow creates "chore: Version Packages" PR
# When PR merges: package.json bumped to 0.3.1, CHANGELOG updated, tag created
# Build and Release workflow builds and creates GitHub release
```

#### Changeset File Format

Changeset files like `.changeset/fancy-cats-jump.md`:

```markdown
---
"oxinot": minor
---

- add block templates dropdown
- handle edge case in template selection
```

Version level mapping:
- feat → minor
- improve → minor
- fix or perf → patch
- BREAKING CHANGE → major
- refactor, docs, test, chore → no changeset

### Branch Strategy

- Large features: `feature/description` or `feature/issue-NUMBER-description`
- Bug fixes: `fix/description`
- Experiments: `experiment/description`

Always merge back to main through PR.

### Workflow Summary

**Development:**
1. Assess task scope
2. Create issue with gh CLI if needed (feat, improve types)
3. Extract issue number if created
4. Create branch with appropriate prefix and issue number
5. Make changes and lint: `npm run lint`
6. Commit with conventional format
7. Push branch: `git push origin branch-name`
8. Create PR with issue reference in body: `gh pr create --title "..." --body "Closes #42"`
9. Enable auto-merge: `gh pr merge PR_NUMBER --auto --squash`
10. CI runs automatically (lint-and-build required by branch protection)
11. PR auto-merges when CI passes
12. Issue auto-closes when PR merges

**Release (Fully Automated):**
13. Auto Changeset workflow analyzes merged commits
14. Changeset file generated in `.changeset/`
15. Release workflow creates "chore: Version Packages" PR
16. User reviews and merges PR
17. Changeset version job updates package.json and creates git tag
18. Build and Release job creates GitHub release with binaries
19. Done! Users receive auto-update notification

### Version File Synchronization

The `sync-versions.js` script synchronizes versions across:
- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

Runs automatically with `npm run version`.

## Important Notes for AI Agents

### Development
- Always use conventional commit format: `type(scope): message`
- Issues are optional based on task scope (feat/improve always, fix/perf if substantial)
- PRs are mandatory, direct commits to main blocked by branch protection
- Use correct gh CLI syntax: template name not filename
- Extract issue number after creation for branch naming
- Lint before committing: `npm run lint`
- Commit atomically - one logical change per commit
- Build locally before committing: `npm run build`
- Never force push to main
- Include issue reference in PR body: `Closes #42` or `Fixes #42`
- Always enable auto-merge after creating PR: `gh pr merge PR_NUMBER --auto --squash`
- Extract PR number from gh pr create output: `PR_NUMBER=$(echo "$PR_URL" | grep -oP '\d+$')`
- Branch protection enforces: PR required, CI must pass before merge
- Labels are added via --label flag in gh issue create

### Release (Fully Automated)
- **Do NOT** manually run `npm run release` or create tags - this breaks the workflow
- Auto Changeset workflow generates changesets after CI passes on main
- Release workflow creates "chore: Version Packages" PR with version bumps
- User merges "chore: Version Packages" PR → tag created automatically
- Build and Release workflow triggers on tag → creates GitHub release with binaries
- Users receive auto-update notification once release is published
- All version syncing (package.json, tauri.conf.json, Cargo.toml) is automatic


## Release Process (User Only)

User triggers releases with:

```bash
npm run release
```

This automatically:
1. Updates all versions via changeset
2. Builds application
3. Pushes to GitHub
4. GitHub Actions creates release with binaries

See `RELEASE.md` for detailed release documentation.