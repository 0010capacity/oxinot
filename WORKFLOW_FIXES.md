# Workflow Fixes - Solution Documentation

## Overview

Fixed two critical issues in the GitHub Actions workflow system that were preventing proper automation of the release process:

1. **Infinite Changeset Loop** - Workflow-generated commits were triggering endless changeset generation
2. **Missing Version Tags** - Version bump commits weren't automatically creating git tags needed for releases

## Issue 1: Infinite Changeset Loop

### Problem

When the `auto-changeset.yml` workflow created a PR with the commit message "chore: auto-generate changeset", and that PR was merged to main, the workflow would run again. However, it treated the "chore: auto-generate changeset" commit itself as a new change requiring a changeset, creating an infinite loop:

```
PR with code changes merges
  ↓
auto-changeset runs → generates changeset → creates "chore: auto-generate changeset" PR
  ↓
User/system merges "chore: auto-generate changeset" PR to main
  ↓
auto-changeset runs AGAIN → sees "chore: auto-generate changeset" commit as NEW change
  ↓
Generates ANOTHER changeset for the workflow commit itself
  ↓
Loop repeats infinitely
```

### Root Cause

The `auto-changeset.yml` workflow had no mechanism to differentiate between:
- Commits requiring changesets (actual code/feature changes)
- Commits from workflow automation (github-actions bot commits)

So it treated both the same way, causing the loop.

### Solution

Added a "Check if we should skip changeset generation" step in `auto-changeset.yml` that:

1. Reads the last commit's author and message
2. Checks if the author is `github-actions[bot]`
3. Checks if the message contains `"chore: auto-generate changeset"`
4. If both conditions are true, skips changeset generation entirely
5. Otherwise, proceeds normally

```yaml
- name: Check if we should skip changeset generation
  id: check_skip
  run: |
    LAST_COMMIT_MESSAGE=$(git log -1 --pretty=%B)
    LAST_COMMIT_AUTHOR=$(git log -1 --pretty=%an)
    
    if [[ "$LAST_COMMIT_AUTHOR" == "github-actions[bot]" ]] && \
       [[ "$LAST_COMMIT_MESSAGE" == *"chore: auto-generate changeset"* ]]; then
      echo "skip=true" >> "$GITHUB_OUTPUT"
    else
      echo "skip=false" >> "$GITHUB_OUTPUT"
    fi

- name: Generate Changeset
  if: steps.check_skip.outputs.skip == 'false'
  # ... rest of generation logic
```

This ensures workflow commits are never processed as changes needing changesets.

## Issue 2: Missing Version Tags

### Problem

When the `changesets/action` created and merged a "chore: Version Packages" PR (which bumps the version in `package.json`), the `release.yml` workflow had a step to create a git tag. However, this step only ran if `steps.changesets.outputs.published == 'true'`.

The issue: The changesets action's `publish` parameter doesn't support `false` as a value in changesets/action@v1. By default, when the `publish` parameter is omitted, the action only creates a PR without publishing. The `published` output is only set to `true` when using a valid publish command that actually publishes releases. Since we only wanted to create a PR (not publish), we needed to omit the `publish` parameter entirely.

Without the tag:
- The tag that should be created was missing
- The `build-and-release` job only runs on tag pushes
- No release was ever created
- Users had to manually force the release

### Root Cause

The release workflow had two logical flaws:

1. **Invalid publish configuration**: Using `publish: false` is not valid syntax for changesets/action@v1. The action treats any value (including "false") as a command to execute, causing it to fail with "The process '/usr/bin/false' failed with exit code 1"
2. **Tag creation dependency**: The tag creation step depended on a `published` output that would never be true for our workflow

### Solution

Two changes were needed:

**First:** Remove the invalid `publish` parameter. By omitting it, the action correctly skips publishing and only creates/updates a PR.

```yaml
uses: changesets/action@v1
with:
  version: npm run version
  # Omit 'publish' parameter to skip publishing
  title: "chore: Version Packages"
  createGithubReleases: false
```

**Second:** Create a separate `create-version-tag` job that runs independently on main pushes (not dependent on the action's `published` output). This job:

1. Runs independently on main pushes (in parallel with the `changeset` job)
2. Detects when the version has been bumped by checking:
   - Current version from `package.json`
   - Whether a git tag already exists for that version
   - Whether the last commit message contains "Version Packages" (indicating this is a version bump commit)
3. If all conditions are met, creates and pushes the git tag
4. The tag push automatically triggers the `build-and-release` job

```yaml
create-version-tag:
  name: Create Version Tag
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  runs-on: ubuntu-latest
  permissions:
    contents: write
  steps:
    - uses: actions/checkout@v4
    
    - name: Check if version tag should be created
      id: check_tag
      run: |
        CURRENT_VERSION=$(node -p "require('./package.json').version")
        TAG_NAME="v${CURRENT_VERSION}"
        
        # Check if tag already exists
        if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
          echo "should_tag=false" >> "$GITHUB_OUTPUT"
          exit 0
        fi
        
        # Check if last commit is a version bump
        LAST_COMMIT_MESSAGE=$(git log -1 --pretty=%B)
        if [[ "$LAST_COMMIT_MESSAGE" == *"Version Packages"* ]]; then
          echo "should_tag=true" >> "$GITHUB_OUTPUT"
          echo "version=$CURRENT_VERSION" >> "$GITHUB_OUTPUT"
        fi
    
    - name: Create and Push Version Tag
      if: steps.check_tag.outputs.should_tag == 'true'
      run: |
        VERSION="${{ steps.check_tag.outputs.version }}"
        git config user.name "github-actions[bot]"
        git config user.email "github-actions[bot]@users.noreply.github.com"
        git tag -a "v${VERSION}" -m "Release v${VERSION}"
        git push origin "v${VERSION}"
```

This approach is:
- **Robust**: Doesn't depend on action outputs that might be unclear
- **Safe**: Checks that tag doesn't already exist before creating
- **Clear**: Explicitly detects version bump commits
- **Automatic**: Requires no additional manual steps
- **Valid**: Uses only valid changesets/action parameters

## Updated Workflow Flow

The release process now works as intended:

```
1. Developer merges code PR to main
   ↓
2. CI tests run and pass
   ↓
3. auto-changeset.yml detects new commits
   → Generates changeset for code changes
   → Creates "chore: auto-generate changeset" PR
   ↓
4. User merges "chore: auto-generate changeset" PR
   ↓
5. CI runs on main again
   → Skips (no code changes, only .changeset/ files)
   ↓
6. changesets/action creates/updates "chore: Version Packages" PR
   ↓
7. User merges "chore: Version Packages" PR
   ↓
8. Version bump commit pushed to main
   ↓
9. create-version-tag job detects version bump
   → Creates git tag v*.*.* 
   → Pushes tag to origin
   ↓
10. Tag push triggers build-and-release job
    → Builds application
    → Creates GitHub Release with binaries
    ↓
11. Release complete, users notified
```

## Files Changed

- `.github/workflows/auto-changeset.yml` - Added skip check for workflow commits
- `.github/workflows/release.yml` - Added automatic version tag creation, cleaned up publish config

## Testing the Fix

To verify the fixes work:

1. Create a feature PR with code changes
2. Merge it to main
3. Watch CI pass
4. Verify `auto-changeset.yml` creates "chore: auto-generate changeset" PR (not looping)
5. Merge the changeset PR
6. Verify `changesets/action` creates "chore: Version Packages" PR
7. Merge the version PR
8. Verify git tag is automatically created
9. Verify `build-and-release` job runs and creates a release

## Breaking Changes

None. These are pure bug fixes that make the existing intended workflow actually work.