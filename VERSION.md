# Versioning Guide

This project follows [Semantic Versioning 2.0.0](https://semver.org/) with automated versioning managed by **Changesets**.

## Version Format

```
MAJOR.MINOR.PATCH
```

Example: `0.1.0`

## Semantic Versioning Rules

### MAJOR Version (X.0.0)
Increment for **breaking changes** that are incompatible with previous versions.

Examples:
- Changing block data structure format
- Database schema migration breaking compatibility
- Removing or renaming core features
- Breaking changes to Tauri command API

### MINOR Version (0.X.0)
Increment for **new features** added in a backward-compatible manner.

Examples:
- Adding block templates feature
- New UI/UX improvements
- New configuration options
- New Tauri commands

### PATCH Version (0.0.X)
Increment for **bug fixes** and improvements in a backward-compatible manner.

Examples:
- Fixing block splitting on IME composition
- Performance optimizations
- UI/UX tweaks
- Stability improvements

## Commit Message Conventions

All commits **must** follow conventional commits format to enable automatic versioning:

```
type(scope): subject

optional body

optional footer
```

### Commit Types

| Type | Version Impact | Use When |
|------|---|---|
| `feat` | MINOR | Adding a new feature |
| `fix` | PATCH | Fixing a bug |
| `improve` | MINOR | Enhancement/improvement |
| `perf` | PATCH | Performance improvement |
| `refactor` | none | Code refactoring |
| `docs` | none | Documentation only |
| `test` | none | Test changes |
| `chore` | none | Build/tooling/dependencies |

### Scope Examples

- `frontend` - React/UI changes
- `backend` - Rust/Tauri backend
- `db` - Database/persistence
- `editor` - Block editor
- `outliner` - Outline functionality
- `config` - Configuration files

### Examples

Good feature commit:
```
feat(editor): add block templates menu

Add dropdown menu to insert predefined block templates.
Improves user onboarding experience.
```

Good fix commit:
```
fix(composition): handle IME composition correctly

Prevent block content corruption during IME composition.
Reset composition state on Escape key.

Fixes #38
```

### Breaking Changes

To trigger a **MAJOR** version bump, add `BREAKING CHANGE:` in the commit footer:

```
feat(block): redesign block structure

Completely redesigned how blocks store and represent data.

BREAKING CHANGE: Block format changed from 'content' field to 'text' field.
Old format no longer supported.
```

## Changesets Workflow

### What are Changesets?

Changesets record changes to your project in a structured way. Each changeset file documents:
- Which package was changed
- What type of version bump (major/minor/patch)
- What changed (from user perspective)

### Changeset File Format

Files in `.changeset/*.md` look like:

```markdown
---
"oxinot": patch
---

Fixed block splitting when composing with IME.
Improved performance of outline rendering.
```

The version level should match your commit type:
- `feat` → `minor`
- `fix` or `perf` → `patch`
- `improve` → `minor`
- `BREAKING CHANGE` → `major`
- Other commit types → usually no changeset needed

### When to Create Changesets

Create changesets for:
- ✅ `feat:` commits (new features)
- ✅ `fix:` commits (bug fixes)
- ✅ `improve:` commits (enhancements)
- ✅ `perf:` commits (performance improvements)

Don't create changesets for:
- ❌ `refactor:` commits (code structure, no behavior change)
- ❌ `docs:` commits (documentation only)
- ❌ `test:` commits (test infrastructure)
- ❌ `chore:` commits (dependencies, build tools)

## Version Files

The following files must be kept in sync (done automatically by `npm run version`):

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

The `sync-versions.js` script ensures these stay synchronized.

## Release Process

When user runs `npm run release`:

1. **Changesets are processed**: All `.changeset/*.md` files are read
2. **Version is calculated**: Based on semantic versioning rules from commit history
3. **Files are updated**: All three version files are updated to new version
4. **Commit is created**: With message `chore: release v{version}`
5. **Build happens**: Application is built for release
6. **GitHub Actions**: Automatically creates tag, release, and uploads binaries

See `RELEASE.md` for detailed release instructions.

## Development Example

```bash
# 1. Make code changes
# ... edit src/components/Editor.tsx

# 2. Commit with proper message
git commit -m "feat(editor): add keyboard shortcuts for block operations

Added Ctrl+Enter to split block, Ctrl+Shift+Enter to join blocks.
Implements keyboard-first workflow for power users."

# 3. Create changeset
npx changeset add
# Prompts: oxinot, minor, "Added keyboard shortcuts for block operations"

# 4. Commit changeset
git commit -m "chore: add changeset for keyboard shortcuts"

# 5. Push to main
git push origin main

# 6. When ready to release (user does this)
npm run release
# Automatically updates to v0.2.0, builds, pushes
```

## Historical Versions

- **v0.0.1**: Initial development version
- **v0.1.0**: IME composition handling improvements and block split fixes

## FAQ

**Q: Do I need to create a changeset for every commit?**
A: Only for commits that change features/fixes. Internal refactoring, documentation, tests don't need changesets.

**Q: What if I make multiple changes before release?**
A: Create one changeset per logical change. They'll all be combined into one version bump.

**Q: How do I know what version to bump to?**
A: Changesets calculates it automatically based on commit types and your changesets.

**Q: Can I manually override the version?**
A: You can edit changeset files before release to adjust version or description.

**Q: What about pre-releases or betas?**
A: Pre-releases (like `v0.1.0-beta.1`) can be created manually. See GitHub's pre-release feature.

## Resources

- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Changesets Documentation](https://github.com/changesets/changesets)
- [AGENTS.md](./AGENTS.md) - Development workflow
- [RELEASE.md](./RELEASE.md) - Release process guide