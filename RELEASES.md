# 📦 Release Process & Automated Pipeline

## Overview

Oxinot uses a fully automated 3-stage release pipeline powered by GitHub Actions, Changesets, and Conventional Commits. Once you merge code to `main`, the system automatically:

1. **Generates changesets** from your commit messages
2. **Creates a version bump PR** with updated package.json and CHANGELOG
3. **Builds and publishes a GitHub Release** when the version PR merges

**Zero manual intervention required after the initial merge!**

---

## Quick Start: Making a Release

### For Developers
```bash
# 1. Create a feature branch
git checkout -b feature/my-awesome-feature

# 2. Make changes and commit with conventional message
git commit -m "feat: add awesome new feature"
# OR
git commit -m "fix: resolve critical bug"

# 3. Create PR, get review, merge to main
# Everything else is automatic!
```

### For Release Engineers
```bash
# Monitor the pipeline
gh run list                    # See all workflow runs
gh release list                # See releases

# Check changeset status
npm run changeset:status

# Force a release (if needed)
gh workflow run release.yml -f force_build=true
```

---

## How It Works

### Stage 1: Changeset Auto-Generation (2 minutes)

**Trigger**: Any commit to `main` with conventional message (`feat:`, `fix:`, etc.)

**Process**:
1. `.github/workflows/auto-changeset.yml` runs
2. `auto-changeset.cjs` parses your commit message
3. Creates `.changeset/{random-name}.md` file
4. Commits to `changeset-auto` branch
5. Creates PR and **auto-merges** it

**Result**: Changeset file now on `main`, ready for Stage 2

**Time**: ~2 minutes

### Stage 2: Version Packages PR (3 minutes)

**Trigger**: When changeset files appear in `main`

**Process**:
1. `create-version-packages-pr` job detects `.changeset/*.md` files
2. Runs `npm run version` to:
   - Update `package.json` version
   - Generate/update `CHANGELOG.md`
   - Create bump summary
3. Commits changes: `chore: version packages`
4. Pushes to `changeset-release/main` branch
5. Creates "Version Packages" PR

**Result**: PR ready for review/merge

**Time**: ~3 minutes

**Manual Step**: Merge the Version Packages PR (when you're ready)

### Stage 3: Build & Release (7+ minutes)

**Trigger**: "Version Packages" PR merges to `main`

**Process**:
1. `release.yml` detects version commit
2. Creates version tag: `v0.25.0`
3. Builds app on macOS
4. Extracts CHANGELOG excerpt
5. Creates GitHub Release with artifacts
6. Publishes release

**Result**: 🎉 GitHub Release live with downloadable app

**Time**: ~7 minutes

---

## Commit Message Patterns

The system auto-detects release type based on commit messages:

### Generates Changeset (Triggers Release)
```bash
git commit -m "feat: add user authentication"    # Minor version bump
git commit -m "fix: resolve memory leak"         # Patch version bump  
git commit -m "refactor: simplify data flow"     # Patch/minor bump
git commit -m "perf: optimize rendering"         # Patch/minor bump
```

### No Changeset (Skipped)
```bash
git commit -m "docs: improve README"             # No version bump
git commit -m "chore: update dependencies"       # No version bump
git commit -m "ci: fix GitHub Actions"           # No version bump
git commit -m "test: add unit tests"             # No version bump
```

**Convention**: Follow [Conventional Commits](https://www.conventionalcommits.org/)

---

## Timeline Example

Here's a real-world example of the full pipeline:

```
Monday 10:00 AM
└─ You commit and merge: feat: add dark mode toggle

Monday 10:05 AM
└─ CI passes (lint-and-build check)
   └─ auto-changeset workflow runs
   └─ Generates: .changeset/bright-tigers-swim.md
   └─ Creates changeset-auto PR

Monday 10:07 AM
└─ changeset-auto PR auto-merges
   └─ .changeset file now on main

Monday 10:10 AM
└─ create-version-packages-pr job runs
   └─ Detects changeset file
   └─ Runs npm version
   └─ Updates package.json: 0.24.2 → 0.25.0
   └─ Generates CHANGELOG entry
   └─ Creates Version Packages PR

Monday 10:13 AM
└─ Version Packages PR created
   └─ You review and merge it (1 click)

Monday 10:15 AM
└─ release.yml triggers
   └─ Creates tag: v0.25.0
   └─ Builds macOS app
   └─ Extracts CHANGELOG

Monday 10:22 AM
└─ 🎉 GitHub Release Published!
   └─ App available for download
   └─ CHANGELOG as release notes
   └─ Ready for users

Total time: 22 minutes (mostly automatic)
Manual time: ~1 minute (reviewing & merging)
```

---

## Files Involved

### Workflow Files
- **`.github/workflows/auto-changeset.yml`** (230 lines)
  - Changeset detection and Version Packages PR creation
  - Runs on: push to main after CI passes
  
- **`.github/workflows/release.yml`** (210 lines)
  - Version tag creation and GitHub Release building
  - Runs on: "chore: version packages" commit OR manual trigger

- **`.github/workflows/ci.yml`** (110 lines)
  - Linting, testing, building
  - Prerequisite for changesets to trigger

### Configuration Files
- **`.changeset/config.json`** - Changeset configuration
- **`auto-changeset.cjs`** - Script for parsing commits and generating changesets
- **`package.json`** - Contains release scripts and dependencies

### Generated Files
- **`.changeset/*.md`** - Auto-generated changeset files (one per feature)
- **`CHANGELOG.md`** - Auto-generated from changesets
- **`package.json`** - Version field auto-updated

---

## Key Scripts

### For Developers

```bash
# Generate changeset manually (for pending work)
npm run changeset:add

# Check what changesets are pending
npm run changeset:status

# Update version, changelog, and commit locally
npm run version

# Automatic changeset generation (used by workflow)
npm run changeset:auto

# Full release (build + tag + push)
npm run release
```

### For Maintainers

```bash
# Check workflow status
gh workflow list
gh run list

# View recent releases
gh release list

# Re-run a failed workflow
gh run rerun <run-id>

# Manually trigger release (if needed)
gh workflow run release.yml -f force_build=true
```

---

## Troubleshooting

### Changeset Not Generated
**Symptoms**: 30+ minutes after merge, no changeset appears

**Check**:
1. Commit message uses conventional format (`feat:`, `fix:`, etc.)
2. CI workflow (`ci.yml`) passed successfully
3. Check GitHub Actions logs for `auto-changeset.yml`

**Fix**: Push another commit with proper message

---

### Version Packages PR Not Created
**Symptoms**: Changeset created, but no Version Packages PR

**Check**:
1. Changeset file actually merged to `main`: `git log --all -- ".changeset/*.md"`
2. `create-version-packages-pr` job ran: Check Actions logs
3. Branch `changeset-release/main` exists: `git branch -r | grep changeset`

**Fix**: Check GitHub Actions logs for detailed error

---

### Release Not Published
**Symptoms**: Version Packages PR merged, but no GitHub Release

**Check**:
1. Last commit message contains "version packages": `git log -1`
2. `release.yml` `create-version-tag` job ran successfully
3. Tag was created: `git tag | tail -1`

**Fix**: Check GitHub Actions logs, verify permissions

---

## Settings Required

### GitHub Branch Protection Rules (Already Configured)

- ✅ Require pull request before merging
- ✅ Require status check: `lint-and-build`
- ✅ Allow GitHub Actions to bypass: ✓ (for auto-merges)

### GitHub Actions Permissions (Already Configured)

- ✅ Read and write repository contents
- ✅ Workflow: `read and write`

### Secrets Configured

- ✅ `GITHUB_TOKEN` (auto-provided by GitHub Actions)
- ⚠️ `APPLE_CERTIFICATE` (for macOS signing - only for production builds)
- ⚠️ `APPLE_CERTIFICATE_PASSWORD` (for macOS signing)

---

## Manual Release Process (If Needed)

If the automated pipeline fails, you can manually release:

```bash
# 1. Update version locally
npm run version

# 2. Review changes
git log -1
cat CHANGELOG.md | head -50

# 3. Push to main
git push origin main

# 4. Create tag
git tag -a v0.25.0 -m "Release v0.25.0"
git push origin v0.25.0

# 5. Trigger build (if not automatic)
gh workflow run release.yml -f force_build=true

# 6. Create release manually (if workflow fails)
gh release create v0.25.0 \
  --generate-notes \
  --notes-file CHANGELOG.md
```

---

## Version Numbers

This project uses **Semantic Versioning**:

- **Major (X)**: Breaking changes
- **Minor (.Y)**: New features (backward compatible)
- **Patch (.Z)**: Bug fixes only

**Examples**:
- `0.24.2` → `0.25.0` (new feature: minor bump)
- `0.25.0` → `0.25.1` (bug fix: patch bump)
- `0.25.1` → `1.0.0` (breaking change: major bump)

---

## Best Practices

### Commit Messages
✅ Use conventional format: `feat: ...`, `fix: ...`, `docs: ...`  
❌ Don't use: "updated", "work in progress", "temp commit"

### PRs Before Merge
✅ Always review Version Packages PR before merging  
✅ Check version number is reasonable  
✅ Review CHANGELOG for accuracy

### Testing
✅ Let CI pass before triggering changesets  
✅ Test the built app in beta release before promoting  
✅ Check GitHub Release notes look good

### Frequency
✅ Release whenever you have meaningful changes  
✅ Can release multiple times per day  
✅ Or batch features into weekly releases

---

## Rollback Process

If you need to roll back a release:

```bash
# 1. Delete the GitHub Release
gh release delete v0.25.0

# 2. Delete the git tag
git tag -d v0.25.0
git push origin :v0.25.0

# 3. Revert the version commit
git revert <version-commit-hash>
git push origin main

# 4. Delete the version PR (if still open)
gh pr close <pr-number>
```

---

## Future Enhancements

Potential improvements to the pipeline:

- [ ] Multi-platform builds (Windows, Linux)
- [ ] Pre-release manual approval step
- [ ] Release notes generation (auto-extract GitHub PR titles)
- [ ] Beta/canary release channels
- [ ] Rollback automation
- [ ] Performance monitoring

---

## Related Documentation

- **[RELEASE_PIPELINE_CHEATSHEET.md](./RELEASE_PIPELINE_CHEATSHEET.md)** - Quick reference for developers
- **[DEPLOYMENT_COMPLETE.md](./DEPLOYMENT_COMPLETE.md)** - Deployment details and testing
- **[WORKFLOW_ANALYSIS.md](./WORKFLOW_ANALYSIS.md)** - Deep dive into pipeline architecture
- **[README.md](./README.md)** - General project documentation

---

## Questions?

- Check the cheatsheet for quick answers: `RELEASE_PIPELINE_CHEATSHEET.md`
- See full workflow analysis: `WORKFLOW_ANALYSIS.md`
- Review workflow files: `.github/workflows/*.yml`
- Check GitHub Actions logs: Repository → Actions tab

---

**Last Updated**: February 1, 2025  
**Status**: ✅ Fully Automated & Production Ready  
**Maintainer**: Automated Release Pipeline
