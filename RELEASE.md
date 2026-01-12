# Release Guidelines

## Overview
This document outlines the process for releasing new versions of Oxinot. We follow [Semantic Versioning 2.0.0](https://semver.org/) and maintain a structured release workflow.

## Release Process

### 1. Pre-Release Checklist
Before starting a release, ensure:
- [ ] All intended features/fixes are merged to `main` branch
- [ ] Code review is complete
- [ ] Tests pass locally
- [ ] Linting passes: `npm run lint`
- [ ] Formatting is correct: `npm run format`
- [ ] No critical warnings in compilation

### 2. Determine Version Number
Review commits since last release and determine the version bump:

```
git log --oneline <last-tag>..main
```

Use the commit types to decide:
- **MAJOR** (X.0.0): Breaking changes, API incompatibilities
- **MINOR** (0.X.0): New features, improvements (backward-compatible)
- **PATCH** (0.0.X): Bug fixes, stability improvements

Refer to `VERSION.md` for detailed versioning rules.

### 3. Update Version Files
Update version number in all three places to maintain consistency:

```bash
# 1. package.json
"version": "X.Y.Z"

# 2. src-tauri/tauri.conf.json
"version": "X.Y.Z"

# 3. src-tauri/Cargo.toml
version = "X.Y.Z"
```

**Note**: Keep all three versions in sync. Mismatches can cause build issues.

### 4. Create Release Commit
After updating versions, create a release commit:

```bash
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "chore: release v0.X.Z"
git push origin main
```

### 5. Build Release Bundles
Build the application for target platform(s):

```bash
# For Apple Silicon (aarch64) macOS
npm run tauri:build -- --target aarch64-apple-darwin

# For Intel macOS
npm run tauri:build -- --target x86_64-apple-darwin

# For Universal binary (both architectures)
npm run tauri:build -- --target universal-apple-darwin
```

Build artifacts are located in:
```
src-tauri/target/<target>/release/bundle/
```

**macOS Bundles:**
- `*.app` - Application bundle
- `*.dmg` - Disk image for distribution
- `*.tar.gz` - Compressed archive

### 6. Create Git Tag
Tag the release commit:

```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z: <brief description>"
```

**Tag message template:**
```
Release vX.Y.Z: <Feature headline>

This release includes:
- Feature/fix #1
- Feature/fix #2
- Feature/fix #3

Platform support:
- macOS (Apple Silicon/Intel/Universal)
```

### 7. Push Tag to GitHub
```bash
git push origin vX.Y.Z
```

### 8. Create GitHub Release
Use GitHub CLI to create the release and upload artifacts:

```bash
gh release create vX.Y.Z \
  --title "vX.Y.Z - <Headline>" \
  --notes "Release notes here" \
  path/to/Oxinot_X.Y.Z_aarch64.dmg
```

Or use GitHub web interface:
1. Go to Releases page
2. Click "Draft a new release"
3. Select the tag you just pushed
4. Add release title and description
5. Upload DMG files
6. Mark as "Latest release" if applicable
7. Publish

### 9. Release Notes Template

```markdown
# vX.Y.Z - Release Title

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
- **macOS (Universal)**: `Oxinot_X.Y.Z_universal.dmg`

## System Requirements
- macOS 11.0 or later
- 50MB disk space

## Installation
1. Download the `.dmg` file matching your architecture
2. Double-click to mount the disk image
3. Drag Oxinot into the Applications folder
4. Eject the disk image
5. Launch Oxinot from Applications

## Known Issues
- (If any)

## Thank You
Thanks to all contributors for making this release possible.
```

## Release Cadence

### Regular Releases
- **Major releases (X.0.0)**: Irregular, for significant feature additions or breaking changes
- **Minor releases (0.X.0)**: Every 2-4 weeks, for new features and improvements
- **Patch releases (0.0.X)**: As needed, for critical bug fixes

### Hotfix Releases
For critical bugs in current release:
1. Create branch from release tag: `git checkout -b hotfix/<issue> vX.Y.Z`
2. Fix the issue
3. Merge to `main`
4. Release as patch version (X.Y.Z+1)

## Versioning Best Practices

### Do's
✅ Keep version numbers consistent across all config files
✅ Tag every release
✅ Write clear, descriptive release notes
✅ Test builds thoroughly before releasing
✅ Include download links in release notes
✅ Document known issues and limitations

### Don'ts
❌ Skip version updates in any config file
❌ Release without testing
❌ Create releases without proper commit history
❌ Forget to update documentation
❌ Release breaking changes as MINOR/PATCH
❌ Use version tags without proper release notes

## Post-Release

### After Release
1. Verify release is available on GitHub
2. Test downloading and running the application
3. Update documentation if needed
4. Announce release (Discord, Twitter, etc.)
5. Monitor for bug reports

### Maintenance
- Keep `main` branch stable
- Review and merge PRs regularly
- Plan next release cycle
- Update CHANGELOG if maintaining one

## Emergency Rollback

If a critical issue is discovered after release:

1. Create hotfix branch from previous tag
2. Apply fix
3. Release as new patch version
4. Update release notes in previous version to mention the issue
5. Announce hotfix

## Continuous Integration

Consider automating:
- Version validation (all files match)
- Build verification
- Release creation
- Artifact upload

Setup GitHub Actions workflow (`.github/workflows/release.yml`):
```yaml
name: Release
on:
  push:
    tags:
      - 'v*'
jobs:
  release:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build
        run: npm run tauri:build -- --target aarch64-apple-darwin
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/*.dmg
```

## Troubleshooting

### Build Fails
```bash
# Clean build cache
rm -rf src-tauri/target
npm run tauri:build -- --target aarch64-apple-darwin
```

### Version Mismatch Errors
```bash
# Check all version files
grep -n "0\." package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
# Update any mismatches
```

### Tag Already Exists
```bash
# Delete local tag
git tag -d vX.Y.Z
# Delete remote tag
git push origin :vX.Y.Z
# Create new tag
git tag -a vX.Y.Z -m "..."
git push origin vX.Y.Z
```

## Questions?
For questions about the release process, refer to `VERSION.md` for versioning rules or contact the maintainers.