# Release Guide

## Overview

Oxinot uses **Changesets** for automated version management and release coordination. This guide explains the release process for users and maintainers.

## Quick Start (Users)

When you're satisfied with development and ready to release:

```bash
npm run release
```

This command automatically:
1. Updates version in `package.json`, `tauri.conf.json`, and `Cargo.toml`
2. Generates changelog entries
3. Creates a release commit
4. Builds the application
5. (GitHub Actions will create the Git tag and GitHub Release with binaries)

## Understanding the Workflow

### What Developers Do

1. **Commit Changes**: Use conventional commits (feat, fix, improve, etc.)
2. **Create Changeset**: Run `npx changeset add` after each commit
3. **Push to main**: Changes are automatically tracked

### What the Release Process Does

The `npm run release` command:
1. Collects all pending changesets
2. Calculates version bump (major/minor/patch)
3. Updates versions in all config files
4. Creates release commit and Git tag
5. Builds Tauri app for all platforms
6. GitHub Actions automatically:
   - Uploads binaries to GitHub Release
   - Makes the release publicly available

## Semantic Versioning

This project follows [Semantic Versioning 2.0.0](https://semver.org/).

### Version Format
```
MAJOR.MINOR.PATCH
```

### When to Bump

- **MAJOR (X.0.0)**: Breaking changes
  - Breaking API changes
  - Incompatible data format changes
  - Major feature removals
  - Database schema migrations

- **MINOR (0.X.0)**: New features (backward-compatible)
  - New features
  - Enhancements
  - New UI/UX improvements
  - New configuration options

- **PATCH (0.0.X)**: Bug fixes (backward-compatible)
  - Bug fixes
  - Performance improvements
  - Minor UI tweaks
  - Documentation updates

### Breaking Change Indicator

To trigger a MAJOR version bump, add `BREAKING CHANGE:` in commit footer:

```
feat(block): redesign block structure

BREAKING CHANGE: Block data format changed from 'content' to 'text'
```

## Detailed Release Process

### Step 1: Verify Pending Changes

Before releasing, check what will be included:

```bash
npm run changeset:status --verbose
```

This shows:
- All pending changesets
- What version will be bumped to
- Summary of changes

### Step 2: Run Release Command

```bash
npm run release
```

This will:
1. Call `changeset version` to update all versions
2. Run `sync-versions.js` to sync Tauri configs
3. Build the application
4. Create release artifacts

### Step 3: GitHub Actions Takes Over

When the release commit is pushed and tagged, GitHub Actions automatically:
1. Detects the `vX.Y.Z` tag
2. Builds for all platforms:
   - macOS (Intel & Apple Silicon)
   - Linux
   - Windows
3. Creates GitHub Release with binaries
4. Makes release publicly available

**You don't need to do anything after pushing the tag!**

## Release Checklist

Before running `npm run release`:

- [ ] All desired features/fixes are in `main`
- [ ] Code review is complete
- [ ] Tests pass locally: `npm run build`
- [ ] Linting passes: `npm run lint`
- [ ] Formatting is correct: `npm run format`
- [ ] No critical warnings in build output
- [ ] Changesets are created for all changes: `npm run changeset:status`

## Post-Release

### After Release is Published

1. Verify release on GitHub Releases page
2. Test downloading and running the app
3. Update any external documentation
4. Announce release (Discord, Twitter, etc.)
5. Monitor for bug reports

### If Issues are Discovered

1. Fix the issue in code
2. Create a new commit with fix
3. Create changeset for the fix (typically patch version)
4. Run `npm run release` again

## Advanced: Manual Version Updates

If you need to manually update versions:

```bash
# Update package.json version
npm version patch  # or minor, major

# Sync to Tauri configs
npm run version:sync

# Create and push tag
git push origin main
git tag vX.Y.Z
git push origin vX.Y.Z
```

## Version File Locations

The release process automatically keeps these in sync:

1. **package.json**
   ```json
   "version": "X.Y.Z"
   ```

2. **src-tauri/tauri.conf.json**
   ```json
   "version": "X.Y.Z"
   ```

3. **src-tauri/Cargo.toml**
   ```toml
   version = "X.Y.Z"
   ```

**Important**: The sync script (`sync-versions.js`) ensures these stay in sync automatically.

## Troubleshooting

### "Some packages have been changed but no changesets were found"

This means code was committed but no changeset was created. Fix:

```bash
npx changeset add
git add .changeset/
git commit -m "chore: add changeset"
git push origin main
```

### Version mismatch between files

Run the sync script:

```bash
npm run version:sync
```

Then verify all three files match:

```bash
grep version package.json
grep version src-tauri/tauri.conf.json
grep version src-tauri/Cargo.toml
```

### Build failed during release

The release process includes a build step. If it fails:

1. Fix the issue locally
2. Verify build works: `npm run build`
3. Create a new changeset for the fix
4. Run `npm run release` again

### Git tag already exists

If a tag was created but release didn't complete:

```bash
# Delete local tag
git tag -d vX.Y.Z

# Delete remote tag
git push origin :refs/tags/vX.Y.Z

# Run release again
npm run release
```

## CI/CD Pipeline

The project has two GitHub Actions workflows:

### 1. CI Workflow (`ci.yml`)
Runs on every push to `main` and PRs:
- Linting checks
- Format verification
- Build verification
- Basic Tauri build check

### 2. Release Workflow (`release.yml`)
Runs when a `vX.Y.Z` tag is pushed:
- Builds for all platforms (macOS, Linux, Windows)
- Creates GitHub Release
- Uploads platform-specific binaries

## Release Notes Template

When creating a GitHub Release manually, use this template:

```markdown
# Oxinot vX.Y.Z - Release Title

## New Features
- Feature description
- Feature description

## Bug Fixes
- Fix description
- Fix description

## Improvements
- Improvement description
- Improvement description

## Downloads
- **macOS (Apple Silicon)**: `Oxinot_X.Y.Z_aarch64.dmg`
- **macOS (Intel)**: `Oxinot_X.Y.Z_x86_64.dmg`
- **Linux**: `oxinot_X.Y.Z_amd64.AppImage`
- **Windows**: `Oxinot_X.Y.Z_x64_en-US.msi`

## System Requirements
- macOS 11.0+ / Windows 10+ / Linux (glibc 2.29+)
- 50MB disk space

## Installation
1. Download the appropriate file for your OS
2. Run the installer or extract the archive
3. Launch Oxinot

## Thank You
Thanks to all contributors for making this release possible!
```

## Questions?

For detailed information about:
- **Commit conventions**: See `VERSION.md`
- **Development workflow**: See `AGENTS.md`
- **Changesets usage**: Run `npx changeset --help` or check `.changeset/README.md`
