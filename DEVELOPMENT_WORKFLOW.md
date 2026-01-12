# Development Workflow Guide

This document provides a complete overview of the Oxinot development workflow, including branching strategy, commit conventions, versioning, and release process.

## Overview

Oxinot uses an automated system for managing versions and releases:
- **Conventional commits** for structured change tracking
- **Changesets** for version management
- **GitHub Actions** for CI/CD and automated releases

The workflow is designed to be straightforward for developers while requiring minimal manual intervention for releases.

## Quick Reference

### For Developers (AI Agents)

```bash
# 1. Make code changes
# ... edit files ...

# 2. Format and lint
npm run format
npm run lint

# 3. Commit with conventional message
git commit -m "feat(scope): description"

# 4. Create changeset
npx changeset add

# 5. Commit changeset
git commit -m "chore: add changeset"

# 6. Push to main
git push origin main
```

### For Users (Release Manager)

```bash
# 1. Check what will be released
npm run changeset:status --verbose

# 2. Release when satisfied
npm run release

# Done! GitHub Actions handles the rest.
```

## Branching Strategy

### Main Branch (`main`)
- Always stable and releasable
- All work is committed directly to `main` (for now)
- Protected by CI checks (linting, building)

### Feature Branches (Optional)
For large features, use feature branches:
```bash
git checkout -b feature/large-feature-name
# ... work ...
git push origin feature/large-feature-name
# Merge back to main when done
```

Branch naming:
- `feature/*` - New features
- `fix/*` - Bug fixes
- `improve/*` - Enhancements
- `experiment/*` - Experimental work

## Commit Workflow

### Step 1: Make Changes

Edit code and follow these principles:
- One logical change per commit
- Keep commits focused and atomic
- Run tests before committing

### Step 2: Format and Lint

Before committing, ensure code quality:

```bash
npm run format  # Auto-format with Biome
npm run lint    # Check linting rules
npm run build   # Verify build succeeds
```

### Step 3: Write Commit Message

Use conventional commits format:

```
type(scope): subject

Optional body explaining the change in detail.
Can span multiple lines.

Optional footer with references.
Fixes #123
```

**Commit Types:**
- `feat` - New feature (triggers MINOR version bump)
- `fix` - Bug fix (triggers PATCH version bump)
- `improve` - Enhancement (triggers MINOR version bump)
- `perf` - Performance improvement (triggers PATCH version bump)
- `refactor` - Code refactoring (no version bump)
- `docs` - Documentation (no version bump)
- `test` - Test changes (no version bump)
- `chore` - Build/tooling/dependencies (no version bump)

**Scope Examples:**
- `frontend` - React/UI changes
- `backend` - Rust/Tauri backend
- `editor` - Block editor
- `db` - Database logic
- `api` - Tauri API wrapper
- `config` - Configuration files

**Examples:**

Good feature commit:
```
feat(editor): add block templates dropdown

Users can now quickly insert predefined block templates
including code blocks, quotes, and lists from a dropdown menu.

Fixes #42
```

Good fix commit:
```
fix(composition): handle IME composition events correctly

Prevent block content corruption during IME composition.
Reset composition state when Escape key is pressed.

Fixes #38
```

### Step 4: Create Changeset

After committing, create a changeset to record the change:

```bash
npx changeset add
```

This interactive prompt will ask:
1. **Which packages?** → Select `oxinot`
2. **Bump type?** → Choose based on commit type:
   - `patch` for `fix` or `perf` commits
   - `minor` for `feat` or `improve` commits
   - `major` for breaking changes
3. **Summary?** → Brief, user-friendly description (e.g., "Added block templates feature")

A file is created in `.changeset/` like `fancy-cats-jump.md`:

```markdown
---
"oxinot": minor
---

Added block templates dropdown for quick block insertion
```

**When to Create Changesets:**
- ✅ Create for: `feat`, `fix`, `improve`, `perf` commits
- ❌ Skip for: `refactor`, `docs`, `test`, `chore` commits

### Step 5: Commit Changeset

Commit the changeset file:

```bash
git add .changeset/
git commit -m "chore: add changeset for block templates feature"
```

### Step 6: Push to Main

```bash
git push origin main
```

Continuous Integration automatically:
- Runs linting and formatting checks
- Builds the application
- Verifies no errors

## Releasing

Only users/maintainers release. The process is automated:

### Check Pending Changes

Before releasing, see what will be included:

```bash
npm run changeset:status --verbose
```

Output shows:
- All pending changesets
- Calculated version bump
- Summary of changes

### Run Release Command

When satisfied with changes:

```bash
npm run release
```

This automatically:
1. Reads all `.changeset/*.md` files
2. Calculates new version (major/minor/patch)
3. Updates all version files:
   - `package.json`
   - `src-tauri/tauri.conf.json`
   - `src-tauri/Cargo.toml`
4. Builds the application
5. Creates a release commit: `chore: release v{version}`
6. Removes changeset files
7. Pushes to GitHub

### GitHub Actions Completes Release

After push, GitHub Actions automatically:
1. Detects the version tag (e.g., `v0.2.0`)
2. Builds for all platforms:
   - macOS (Intel & Apple Silicon)
   - Linux
   - Windows
3. Creates GitHub Release with binaries
4. Uploads platform-specific installers
5. Makes release publicly available

**You don't need to do anything after pushing!**

## Version Management

### Semantic Versioning

Version format: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes (incompatible API changes, data format changes)
- **MINOR**: New features (backward-compatible)
- **PATCH**: Bug fixes (backward-compatible)

Examples:
- `0.1.0` → `1.0.0`: Breaking change in block structure
- `0.1.0` → `0.2.0`: Added new feature
- `0.1.0` → `0.1.1`: Fixed a bug

### Version Files

These must stay in sync (auto-handled by release process):

1. **package.json**
   ```json
   "version": "0.1.0"
   ```

2. **src-tauri/tauri.conf.json**
   ```json
   "version": "0.1.0"
   ```

3. **src-tauri/Cargo.toml**
   ```toml
   version = "0.1.0"
   ```

The `sync-versions.js` script keeps them synchronized automatically.

### Manual Version Sync

If versions get out of sync:

```bash
npm run version:sync
```

This reads `package.json` and updates the other two files.

## Development Example

Here's a complete example from feature to release:

### Day 1: Implement Feature

```bash
# Create feature branch (optional)
git checkout -b feature/block-templates

# ... edit src/components/BlockTemplates.tsx ...

# Format and lint
npm run format
npm run lint
npm run build

# Commit
git commit -m "feat(editor): add block templates dropdown

Users can insert predefined block templates from dropdown menu.
Includes templates for code, quotes, and lists."

# Create changeset
npx changeset add
# Select: oxinot, minor
# Summary: "Added block templates feature"

# Commit changeset
git commit -m "chore: add changeset for block templates"

# Push
git push origin main
```

### Day 2: Test and Review

- CI runs automatically
- Tests pass
- Code review approved

### Day 3: User Releases

```bash
# Check what will release
npm run changeset:status
# Output: Will bump v0.1.0 → v0.2.0 with 1 minor change

# Release
npm run release
# Automatically:
# - Updates to v0.2.0
# - Builds application
# - Pushes changes
# - GitHub Actions builds for all platforms

# GitHub Release is created with binaries
# https://github.com/yourusername/oxinot/releases/tag/v0.2.0
```

## Troubleshooting

### Forgotten Changeset

If you pushed code without creating a changeset:

```bash
npx changeset add
git add .changeset/
git commit -m "chore: add missing changeset"
git push origin main
```

Then release normally.

### Version Mismatch

Check if versions match:

```bash
grep version package.json
grep version src-tauri/tauri.conf.json
grep version src-tauri/Cargo.toml
```

If they don't match:

```bash
npm run version:sync
```

### Build Failed During Release

If release build fails:

1. Fix the issue locally
2. Commit the fix: `git commit -m "fix(build): issue description"`
3. Create changeset: `npx changeset add`
4. Push: `git push origin main`
5. Try release again: `npm run release`

### Git Tag Already Exists

If a tag already exists and needs to be recreated:

```bash
git tag -d vX.Y.Z        # Delete local
git push origin :refs/tags/vX.Y.Z  # Delete remote
npm run release           # Create again
```

## CI/CD Pipelines

### Continuous Integration (`.github/workflows/ci.yml`)

Runs on every push to `main`:
- Linting with Biome
- Format checking
- Frontend build
- Tauri build check
- Failures prevent merging

### Release Build (`.github/workflows/release.yml`)

Runs when `vX.Y.Z` tag is pushed:
- Builds for macOS, Linux, Windows
- Creates GitHub Release
- Uploads platform-specific binaries

## Best Practices

### Do's
✅ Commit early and often (atomic commits)
✅ Use conventional commits strictly
✅ Create changesets for user-facing changes
✅ Format and lint before committing
✅ Write clear commit messages
✅ Reference issues in commits (Fixes #123)
✅ Keep commits focused (one feature per commit)

### Don'ts
❌ Skip formatting/linting
❌ Commit without meaningful messages
❌ Forget changesets for features/fixes
❌ Mix refactoring with feature commits
❌ Force push to main
❌ Create long-lived feature branches
❌ Release without testing

## Performance Considerations

### For Large Changes
- If implementing large features, use feature branches
- Keep individual commits small and reviewable
- Create multiple changesets if needed

### For Performance Work
- Mark with `perf(scope):` commit type
- Creates a PATCH version bump
- Include performance metrics in commit body

### For Breaking Changes
- Mark with `BREAKING CHANGE:` in footer
- Creates a MAJOR version bump
- Update documentation
- Plan for user migration

## Documentation

Keep these files updated:
- `AGENTS.md` - Development guidelines for AI agents
- `VERSION.md` - Versioning and semantic versioning rules
- `RELEASE.md` - Detailed release process
- `README.md` - Project overview

## Questions?

For more information:
- **How to commit?** → See "Commit Workflow" above
- **How to version?** → See `VERSION.md`
- **How to release?** → See `RELEASE.md`
- **Development guidelines?** → See `AGENTS.md`
- **Changesets help?** → Run `npx changeset --help` or see `.changeset/README.md`
