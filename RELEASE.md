# Release Guide

## Quick Start

When you're satisfied with development and ready to release:

```bash
npm run release
```

This command automatically:
1. Reads all changeset files
2. Calculates version (major/minor/patch)
3. Updates all version files (package.json, tauri.conf.json, Cargo.toml)
4. Creates release commit
5. Creates Git tag
6. Builds the application
7. Pushes to GitHub

After that, GitHub Actions automatically builds on all platforms and creates a GitHub Release.

---

## Before Releasing

Check what will be released:

```bash
npm run changeset:status --verbose
```

Example output:
```
oxinot: minor (3 changesets)
- Add dark mode support
- Fix IME composition bug
- Improve outline performance
```

---

## Release Checklist

Before running `npm run release`:

- [ ] All features/bug fixes are merged to main
- [ ] Code review is complete
- [ ] Local testing passed: `npm run build`
- [ ] Linting passed: `npm run lint`
- [ ] Changesets created: `npm run changeset:status`

---

## Versioning Rules (Automatic)

Changesets calculates version automatically based on commit types:

| Commit Type | Version | Example |
|------------|---------|---------|
| `feat:` | MINOR | New feature |
| `fix:` | PATCH | Bug fix |
| `improve:` | MINOR | Enhancement |
| `perf:` | PATCH | Performance improvement |
| `BREAKING CHANGE:` | MAJOR | Breaking change |

---

## After Release

1. Verify release on GitHub Releases page
2. Download and test the app
3. Update documentation if needed
4. Announce release (Discord, Twitter, etc.)

---

## Troubleshooting

### Error: "Some packages have been changed but no changesets were found"

Manually create changeset:

```bash
npx changeset add
git add .changeset/
git commit -m "chore: add changeset"
git push origin main
```

### Version mismatch between files

Sync all versions:

```bash
npm run version:sync
```

### Build failed during release

1. Verify local build: `npm run build`
2. Fix issues
3. Try again

### Git tag already exists

```bash
# Delete local tag
git tag -d vX.Y.Z

# Delete remote tag
git push origin :refs/tags/vX.Y.Z

# Try again
npm run release
```

---

## More Information

- **Commit conventions**: See `AGENTS.md`
- **Development workflow**: See `GITHUB_WORKFLOW.md`
- **Changesets documentation**: See `.changeset/README.md`
