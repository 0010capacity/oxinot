# 🚀 Automated Release Pipeline - Quick Reference

## For Developers: Making Feature Commits

### Step 1: Create Your Feature
```bash
git checkout -b feature/my-awesome-feature
# ... make changes ...
git add .
git commit -m "feat: add awesome feature"
# or
git commit -m "fix: resolve critical bug"
```

### Step 2: Push and Create PR (Standard Workflow)
```bash
git push origin feature/my-awesome-feature
# Create PR on GitHub UI, get review, merge to main
```

**That's it!** The rest is automatic:
1. ✅ Changeset auto-generated from commit message
2. ✅ Version Packages PR auto-created
3. ✅ Release built and published automatically

---

## For Release Engineers: Monitoring

### Check Pipeline Status
```bash
# Via GitHub CLI
gh workflow list
gh run list

# Via GitHub
Go to: Repository → Actions tab
```

### Key Workflows to Monitor
| Workflow | Trigger | Duration | Success Signal |
|----------|---------|----------|-----------------|
| `ci.yml` | Every push | ~5 min | Tests pass ✅ |
| `auto-changeset.yml` | Push to main with real commits | ~2 min | changeset-auto PR merges |
| `create-version-packages-pr` | Changeset files appear | ~3 min | Version Packages PR created |
| `release.yml` | Version Packages PR merges | ~10 min | GitHub Release appears |

### Timeline for a Feature Release
```
14:00  Push feature to main
       ↓ (CI: lint-and-build - 5 min)
14:05  auto-changeset workflow starts
       ├─ Generate changeset (1 min)
       ├─ Create & auto-merge changeset-auto PR (1 min)
       ↓ (5 min total)
14:10  create-version-packages-pr runs
       ├─ Detect changesets (30 sec)
       ├─ Run npm version (1 min)
       ├─ Create Version Packages PR (30 sec)
       ↓ (3 min total)
14:13  Version Packages PR ready for review
       ↓ (manual merge after review - assume 2 min)
14:15  release.yml workflow triggers
       ├─ Create version tag (30 sec)
       ├─ Build macOS app (5 min)
       ├─ Create GitHub Release (1 min)
       ↓ (7 min total)
14:22  🎉 Release published!

Total: ~22 minutes from commit to release
```

---

## Commit Message Patterns (Important!)

The system auto-detects changes based on these patterns:

### Generates Changeset (Triggers Release Pipeline)
```bash
git commit -m "feat: ..."      # New feature → minor bump
git commit -m "fix: ..."       # Bug fix → patch bump
git commit -m "refactor: ..."  # Major refactor → minor/patch
```

### Skipped (No Release Bump)
```bash
git commit -m "docs: ..."      # Documentation only
git commit -m "chore: ..."     # Maintenance (unless version packages)
git commit -m "ci: ..."        # CI/workflow changes
git commit -m "test: ..."      # Test additions
```

**Note**: The `chore: version packages` message is special - it triggers the release job.

---

## Troubleshooting Guide

### Problem: Feature pushed but no changeset appears (20 minutes)

**Check 1**: Did CI pass?
```bash
gh run list  # Look for failed runs
```
→ If failed, fix the code issues first

**Check 2**: Is commit message conventional?
```bash
git log --oneline -5
# Should show: feat: xxx, fix: xxx, etc.
```
→ If not, see commit message patterns above

**Check 3**: Check auto-changeset workflow logs
```bash
gh run list --workflow=auto-changeset.yml -n 1 --json status,conclusion
```

### Problem: Changeset created but no Version Packages PR

**Check 1**: Did changesets merge successfully?
```bash
git log --oneline | grep "chore: auto-generate changeset"
```
→ Should be recent

**Check 2**: Check create-version-packages-pr job
```bash
# Go to: Actions → auto-changeset.yml → latest run
# Look for create-version-packages-pr job
```
→ Check logs for error messages

**Check 3**: Verify branch has write access
```bash
# In GitHub: Settings → Actions → General
# Ensure "Workflow permissions" includes "Read and write"
```

### Problem: Version PR created but Release not published

**Check 1**: Is commit message exactly right?
```bash
git log --oneline | grep "chore: version packages"
```
→ Must contain "version packages" (lowercase)

**Check 2**: Check release.yml workflow
```bash
gh run list --workflow=release.yml -n 1
```
→ Look for `create-version-tag` job success

**Check 3**: Verify tag was created
```bash
git tag | tail -5  # Should see v0.XX.X
```

---

## Manual Commands (Rarely Needed)

### Generate Changeset Manually
```bash
npm run changeset:add
# Follow prompts to create .changeset/{name}.md
```

### Create Version Bump Manually
```bash
npm run version
# Updates package.json and CHANGELOG.md locally
# (You still need to commit and push)
```

### Force Release Build (Bypass checks)
```bash
# Only use if workflow is truly broken
gh workflow run release.yml -f force_build=true
```

---

## Helpful GitHub CLI Commands

### View Recent Runs
```bash
gh run list --limit 10
```

### Re-run Failed Workflow
```bash
gh run rerun <run-id>
```

### View Workflow File
```bash
gh workflow view auto-changeset.yml
```

### Check Changeset Status
```bash
npm run changeset:status
```

---

## Common Questions

**Q: Can I manually merge a changeset-auto PR?**  
A: No, they auto-merge. But you can view them at: GitHub → Pull Requests → `changeset-auto`

**Q: How do I skip a release?**  
A: Use `chore:` prefix (e.g., `chore: update docs`). These don't generate changesets.

**Q: Can I revert a release?**  
A: Manually:
1. Delete the release tag: `git tag -d v0.XX.X && git push origin :v0.XX.X`
2. Revert the version commit: `git revert <version-commit>`
3. Push the revert commit

**Q: Do I need to manually create GitHub Releases?**  
A: No, they're created automatically. Just merge the Version Packages PR.

**Q: What if two features push simultaneously?**  
A: Each gets its own changeset. On next merge to main, they combine into one version bump.

**Q: Can I cherry-pick releases?**  
A: Not recommended. The pipeline assumes main is the source of truth.

---

## 📊 Pipeline Health Check

Run this monthly to verify everything works:

```bash
# 1. Check latest workflow runs
gh run list --limit 5

# 2. Check for any failed runs
gh run list --status failure --limit 10

# 3. Verify recent releases
gh release list --limit 5

# 4. Check for pending changesets
npm run changeset:status
```

---

## 🎓 Learning Resources

- **Full Analysis**: See `WORKFLOW_ANALYSIS.md` for detailed explanations
- **Deployment Guide**: See `DEPLOYMENT_COMPLETE.md` for context
- **Code Examples**: Check `.github/workflows/*.yml` for exact implementations
- **Git History**: Use `git log --all` to see all workflow changes

---

## 📞 Emergency Contacts

If workflow is completely broken:

1. **Check GitHub Status**: https://www.githubstatus.com/
2. **Review recent commits**: `git log --oneline -20`
3. **Check workflow syntax**: `yamllint .github/workflows/*.yml`
4. **Verify Actions permissions**: Settings → Actions → General

---

**Last Updated**: February 1, 2025  
**Pipeline Status**: ✅ Fully Automated & Production Ready
