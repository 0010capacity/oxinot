# oxinot

## 0.9.0

### Minor Changes

- bd28b86: - Ensure Space inserts during IME and completion
  - fix component reusability, styling, i18n, and accessibility (#197)
- bd28b86: - Ensure Space inserts during IME and completion
  - fix component reusability, styling, i18n, and accessibility (#197)
  - add IPC input validation and enable CSP (#199)

### Patch Changes

- bd28b86: - Ensure Space inserts during IME and completion
- bd28b86: - Ensure Space inserts during IME and completion

## 0.8.0

### Minor Changes

- 82a7e02: - use Path/PathBuf methods for cross-platform path handling (#183)
  - introduce thiserror for structured error handling (#184)
- 82a7e02: - use Path/PathBuf methods for cross-platform path handling (#183)
- fcfa422: - use Path/PathBuf methods for cross-platform path handling (#183)
  - introduce thiserror for structured error handling (#184)
  - flush pending block updates on component unmount (#187)
  - split block UI state into separate blockUIStore (#188)
  - implement event-based git monitoring (#191)
  - Ensure Space inserts during IME and completion (#193)
- 82a7e02: - use Path/PathBuf methods for cross-platform path handling (#183)
  - introduce thiserror for structured error handling (#184)
- 82a7e02: - use Path/PathBuf methods for cross-platform path handling (#183)
  - introduce thiserror for structured error handling (#184)
  - flush pending block updates on component unmount (#187)
  - split block UI state into separate blockUIStore (#188)
- 5e09f6f: - use Path/PathBuf methods for cross-platform path handling (#183)
  - introduce thiserror for structured error handling (#184)
  - flush pending block updates on component unmount (#187)
  - split block UI state into separate blockUIStore (#188)
  - implement event-based git monitoring (#191)
- 82a7e02: - use Path/PathBuf methods for cross-platform path handling (#183)
  - introduce thiserror for structured error handling (#184)
  - flush pending block updates on component unmount (#187)
  - split block UI state into separate blockUIStore (#188)

## 0.7.0

### Minor Changes

- 47be2f6: - prevent infinite changeset loop and auto-create version tags
  - remove invalid publish parameter from changesets action
  - open external links via shell plugin
  - handle external links (#171)
  - clean local changes before branch checkout in auto-changeset
  - trigger CI for Version Packages PR created by changesets/action
  - make build-and-release run after version tag is created
  - add custom context menus with text selection support (#175)
  - prevent changeset file deletion in auto-changeset

## 0.6.1

### Patch Changes

- 657a3d2: - prevent infinite changeset loop and auto-create version tags
  - remove invalid publish parameter from changesets action

## 0.6.0

### Minor Changes

- 3efdc59: - remove commit input to enforce PR workflow for changesets
  - add manual trigger option to release workflow
  - detect untracked files in auto-changeset workflow
  - use force push for auto-changeset branch to avoid non-fast-forward errors
  - complete wiki link indexing system with code quality improvements (#152)
  - add snowfall toggle button to bottom controls (#153)
- 3efdc59: - remove commit input to enforce PR workflow for changesets
  - add manual trigger option to release workflow
  - detect untracked files in auto-changeset workflow
  - use force push for auto-changeset branch to avoid non-fast-forward errors
  - complete wiki link indexing system with code quality improvements (#152)
  - add snowfall toggle button to bottom controls (#153)
- 3efdc59: - remove commit input to enforce PR workflow for changesets
  - add manual trigger option to release workflow
  - detect untracked files in auto-changeset workflow
  - use force push for auto-changeset branch to avoid non-fast-forward errors
  - complete wiki link indexing system with code quality improvements (#152)
  - add snowfall toggle button to bottom controls (#153)
- 3efdc59: - remove commit input to enforce PR workflow for changesets
  - add manual trigger option to release workflow
  - detect untracked files in auto-changeset workflow
  - use force push for auto-changeset branch to avoid non-fast-forward errors
  - complete wiki link indexing system with code quality improvements (#152)
  - add snowfall toggle button to bottom controls (#153)

### Patch Changes

- 26d8003: - set default language based on system locale (#165)
- 26d8003: - set default language based on system locale (#165)
- 02e1e99: - set default language based on system locale (#165)

## 0.5.0

### Minor Changes

- 79ff844: - remove commit input to enforce PR workflow for changesets
  - add manual trigger option to release workflow
  - detect untracked files in auto-changeset workflow
  - use force push for auto-changeset branch to avoid non-fast-forward errors
- 79ff844: - remove commit input to enforce PR workflow for changesets
  - add manual trigger option to release workflow
  - detect untracked files in auto-changeset workflow
  - use force push for auto-changeset branch to avoid non-fast-forward errors
  - complete wiki link indexing system with code quality improvements (#152)
- 76d2ff3: - remove commit input to enforce PR workflow for changesets
  - add manual trigger option to release workflow
  - detect untracked files in auto-changeset workflow
  - use force push for auto-changeset branch to avoid non-fast-forward errors
  - complete wiki link indexing system with code quality improvements (#152)
  - add snowfall toggle button to bottom controls (#153)
- 1fb9536: - remove commit input to enforce PR workflow for changesets
  - add manual trigger option to release workflow
  - detect untracked files in auto-changeset workflow
  - use force push for auto-changeset branch to avoid non-fast-forward errors
  - complete wiki link indexing system with code quality improvements (#152)
- 79ff844: - remove commit input to enforce PR workflow for changesets
  - add manual trigger option to release workflow
  - detect untracked files in auto-changeset workflow
  - use force push for auto-changeset branch to avoid non-fast-forward errors
- 79ff844: - remove commit input to enforce PR workflow for changesets
  - add manual trigger option to release workflow
  - detect untracked files in auto-changeset workflow
  - use force push for auto-changeset branch to avoid non-fast-forward errors

## 0.4.2

### Patch Changes

- c51d2a6: fix(updater): enable process restart capability for auto-updates

## 0.4.1

### Patch Changes

- d0027e3: Force release to fix CI workflow

## 0.4.0

### Minor Changes

- ef7a699: - run CI for changeset PRs but skip lint and build
  - enable devtools feature flag for release builds (#144)
  - remove syntax error in release.yml

## 0.3.1

### Patch Changes

- 154a427: - enable devtools and improve error logging

## 0.3.0

### Minor Changes

- fd63efa: - update wiki links on file rename (#103)
  - update wiki links on page move/rename (#108)
  - always run CI and short-circuit docs-only changes
  - run required checks via pull_request_target (#109)
  - fix enter key behavior and enforce block-level rendering rules (#113)
  - restore autocomplete keyboard navigation in link completion (#114)
  - incremental patching for bullet edits (Closes #106) (#120)
  - enable safe incremental insertion patching (#122)
  - enable safe incremental relocation patching (#124)
  - unify and stabilize block merge/split/create system (#130)
- 149cd2a: - update wiki links on file rename (#103)
  - update wiki links on page move/rename (#108)
- 60ff13e: - update wiki links on file rename (#103)
- 5b2f718: - update wiki links on file rename (#103)
- d5107f3: - update wiki links on file rename (#103)
  - update wiki links on page move/rename (#108)
  - always run CI and short-circuit docs-only changes
  - run required checks via pull_request_target (#109)
  - fix enter key behavior and enforce block-level rendering rules (#113)
  - restore autocomplete keyboard navigation in link completion (#114)
  - incremental patching for bullet edits (Closes #106) (#120)
  - enable safe incremental insertion patching (#122)
- eddbf7c: - update wiki links on file rename (#103)
  - update wiki links on page move/rename (#108)
  - always run CI and short-circuit docs-only changes
  - run required checks via pull_request_target (#109)
- bd842fb: - update wiki links on file rename (#103)
  - update wiki links on page move/rename (#108)
  - always run CI and short-circuit docs-only changes
  - run required checks via pull_request_target (#109)
  - fix enter key behavior and enforce block-level rendering rules (#113)
  - restore autocomplete keyboard navigation in link completion (#114)
  - incremental patching for bullet edits (Closes #106) (#120)
- c6d2753: - update wiki links on file rename (#103)
  - update wiki links on page move/rename (#108)
  - always run CI and short-circuit docs-only changes
  - run required checks via pull_request_target (#109)
  - fix enter key behavior and enforce block-level rendering rules (#113)
  - restore autocomplete keyboard navigation in link completion (#114)
  - incremental patching for bullet edits (Closes #106) (#120)
  - enable safe incremental insertion patching (#122)
  - enable safe incremental relocation patching (#124)
- 5a5c4fd: - update wiki links on file rename (#103)
  - update wiki links on page move/rename (#108)
  - always run CI and short-circuit docs-only changes
- 2c98169: - update wiki links on file rename (#103)
  - update wiki links on page move/rename (#108)
  - always run CI and short-circuit docs-only changes
  - run required checks via pull_request_target (#109)
  - fix enter key behavior and enforce block-level rendering rules (#113)
  - restore autocomplete keyboard navigation in link completion (#114)

## 0.2.0

### Minor Changes

- 39239b5: - migrate to GitHub Actions with concurrency control (#29)
  - create PR for changesets instead of direct push (#31)
  - replace peter-evans action with gh CLI (#33)
  - add initial i18n support with English and Korean locales (#38)
  - fix invalid syntax in auto-changeset workflow (#42)
  - integrate changeset generation into CI workflow (#44)
  - skip CI checks for changeset-only PRs
  - add proper type casting for Tauri invoke responses
  - create PR for changeset instead of direct push to main
  - add pull-requests write permission for changeset PR creation
  - skip entire lint-and-build job for changeset-only PRs
  - Complete i18n support for Settings and UI tooltips (#48)
  - prevent race condition causing duplicate empty blocks (#49)
  - add custom context menu with rename and delete actions (#51)
  - reset to picker when deleting active workspace (#52)
  - prevent infinite loop in workspace initialization
  - fix workspace delete dialog z-index and auto theme behavior
  - complete auto-update functionality and move check to info tab (#64)
- a8e668a: - add automatic changeset generation via Git hooks
  - convert auto-changeset to CommonJS format
  - add null safety checks to auto-changeset script
  - add comprehensive GitHub issue and PR templates
  - use ubuntu-22.04 for webkit2gtk compatibility
  - resolve tauri config duplicate key and ci compatibility
  - relax biome rules and make CI lint non-blocking
  - remove invalid biome format check command
  - auto-close PRs when CI fails
  - remove invalid tauri macOS bundle settings
  - add timezone, indent size, and cache clear settings
  - enhance settings modal UI with theme and update options
  - prevent duplicate timezone in Select component
- 859af13: - migrate to GitHub Actions with concurrency control (#29)
  - create PR for changesets instead of direct push (#31)
  - replace peter-evans action with gh CLI (#33)
  - add initial i18n support with English and Korean locales (#38)
  - fix invalid syntax in auto-changeset workflow (#42)
  - integrate changeset generation into CI workflow (#44)
  - skip CI checks for changeset-only PRs
  - add proper type casting for Tauri invoke responses
  - create PR for changeset instead of direct push to main
  - add pull-requests write permission for changeset PR creation
  - skip entire lint-and-build job for changeset-only PRs
- 3d316d8: - migrate to GitHub Actions with concurrency control (#29)
  - create PR for changesets instead of direct push (#31)
  - replace peter-evans action with gh CLI (#33)
  - add initial i18n support with English and Korean locales (#38)
  - fix invalid syntax in auto-changeset workflow (#42)
  - integrate changeset generation into CI workflow (#44)
  - skip CI checks for changeset-only PRs
  - add proper type casting for Tauri invoke responses
  - create PR for changeset instead of direct push to main
  - add pull-requests write permission for changeset PR creation
  - skip entire lint-and-build job for changeset-only PRs
  - Complete i18n support for Settings and UI tooltips (#48)
  - prevent race condition causing duplicate empty blocks (#49)
  - add custom context menu with rename and delete actions (#51)
  - reset to picker when deleting active workspace (#52)
  - prevent infinite loop in workspace initialization
  - fix workspace delete dialog z-index and auto theme behavior
  - complete auto-update functionality and move check to info tab (#64)
  - update updater status messages (#68)
  - inline updater UI in Settings modal (#71)
  - resolve technical debt by removing biome-ignore (#76)
  - add Tauri signing environment variables to CI build
  - add block drag-and-drop reordering (#86)
  - persist file deletion to database (#89)
  - refresh file tree after creating daily note hierarchy (#90)
- 31ffd41: - migrate to GitHub Actions with concurrency control (#29)
  - create PR for changesets instead of direct push (#31)
  - replace peter-evans action with gh CLI (#33)
  - add initial i18n support with English and Korean locales (#38)
  - fix invalid syntax in auto-changeset workflow (#42)
  - integrate changeset generation into CI workflow (#44)
  - skip CI checks for changeset-only PRs
  - add proper type casting for Tauri invoke responses
  - create PR for changeset instead of direct push to main
  - add pull-requests write permission for changeset PR creation
  - skip entire lint-and-build job for changeset-only PRs
  - Complete i18n support for Settings and UI tooltips (#48)
  - prevent race condition causing duplicate empty blocks (#49)
  - add custom context menu with rename and delete actions (#51)
  - reset to picker when deleting active workspace (#52)
  - prevent infinite loop in workspace initialization
  - fix workspace delete dialog z-index and auto theme behavior
  - complete auto-update functionality and move check to info tab (#64)
  - update updater status messages (#68)
  - inline updater UI in Settings modal (#71)
- 1c940a9: - migrate to GitHub Actions with concurrency control (#29)
  - create PR for changesets instead of direct push (#31)
  - replace peter-evans action with gh CLI (#33)
  - add initial i18n support with English and Korean locales (#38)
  - fix invalid syntax in auto-changeset workflow (#42)
  - integrate changeset generation into CI workflow (#44)
  - skip CI checks for changeset-only PRs
  - add proper type casting for Tauri invoke responses
  - create PR for changeset instead of direct push to main
  - add pull-requests write permission for changeset PR creation
  - skip entire lint-and-build job for changeset-only PRs
  - Complete i18n support for Settings and UI tooltips (#48)
  - prevent race condition causing duplicate empty blocks (#49)
  - add custom context menu with rename and delete actions (#51)
  - reset to picker when deleting active workspace (#52)
  - prevent infinite loop in workspace initialization
  - fix workspace delete dialog z-index and auto theme behavior
  - complete auto-update functionality and move check to info tab (#64)
  - update updater status messages (#68)
  - inline updater UI in Settings modal (#71)
- 491c119: - migrate to GitHub Actions with concurrency control (#29)
  - create PR for changesets instead of direct push (#31)
  - replace peter-evans action with gh CLI (#33)
  - add initial i18n support with English and Korean locales (#38)
  - fix invalid syntax in auto-changeset workflow (#42)
  - integrate changeset generation into CI workflow (#44)
  - skip CI checks for changeset-only PRs
  - add proper type casting for Tauri invoke responses
  - create PR for changeset instead of direct push to main
  - add pull-requests write permission for changeset PR creation
  - skip entire lint-and-build job for changeset-only PRs
  - Complete i18n support for Settings and UI tooltips (#48)
  - prevent race condition causing duplicate empty blocks (#49)
  - add custom context menu with rename and delete actions (#51)
  - reset to picker when deleting active workspace (#52)
  - prevent infinite loop in workspace initialization
  - fix workspace delete dialog z-index and auto theme behavior
  - complete auto-update functionality and move check to info tab (#64)
  - update updater status messages (#68)
  - inline updater UI in Settings modal (#71)
  - resolve technical debt by removing biome-ignore (#76)
  - add Tauri signing environment variables to CI build
  - add block drag-and-drop reordering (#86)
  - persist file deletion to database (#89)
  - refresh file tree after creating daily note hierarchy (#90)
  - implement working block drag-and-drop and remove hover background
- 501233b: - migrate to GitHub Actions with concurrency control (#29)
  - create PR for changesets instead of direct push (#31)
  - replace peter-evans action with gh CLI (#33)
  - add initial i18n support with English and Korean locales (#38)
  - fix invalid syntax in auto-changeset workflow (#42)
  - integrate changeset generation into CI workflow (#44)
  - skip CI checks for changeset-only PRs
  - add proper type casting for Tauri invoke responses
  - create PR for changeset instead of direct push to main
  - add pull-requests write permission for changeset PR creation
- 6acb574: - migrate to GitHub Actions with concurrency control (#29)
  - create PR for changesets instead of direct push (#31)
  - replace peter-evans action with gh CLI (#33)
  - add initial i18n support with English and Korean locales (#38)
  - fix invalid syntax in auto-changeset workflow (#42)
  - integrate changeset generation into CI workflow (#44)
  - skip CI checks for changeset-only PRs
  - add proper type casting for Tauri invoke responses
  - create PR for changeset instead of direct push to main
  - add pull-requests write permission for changeset PR creation
  - skip entire lint-and-build job for changeset-only PRs
  - Complete i18n support for Settings and UI tooltips (#48)
- 8046082: - migrate to GitHub Actions with concurrency control (#29)
  - create PR for changesets instead of direct push (#31)
  - replace peter-evans action with gh CLI (#33)
  - add initial i18n support with English and Korean locales (#38)
  - fix invalid syntax in auto-changeset workflow (#42)
  - integrate changeset generation into CI workflow (#44)
  - skip CI checks for changeset-only PRs
  - add proper type casting for Tauri invoke responses
  - create PR for changeset instead of direct push to main
  - add pull-requests write permission for changeset PR creation
  - skip entire lint-and-build job for changeset-only PRs
  - Complete i18n support for Settings and UI tooltips (#48)
  - prevent race condition causing duplicate empty blocks (#49)
  - add custom context menu with rename and delete actions (#51)
  - reset to picker when deleting active workspace (#52)
  - prevent infinite loop in workspace initialization
  - fix workspace delete dialog z-index and auto theme behavior
  - complete auto-update functionality and move check to info tab (#64)
  - update updater status messages (#68)
- 908e8f4: - migrate to GitHub Actions with concurrency control (#29)
  - create PR for changesets instead of direct push (#31)
  - replace peter-evans action with gh CLI (#33)
  - add initial i18n support with English and Korean locales (#38)
  - fix invalid syntax in auto-changeset workflow (#42)
  - integrate changeset generation into CI workflow (#44)
  - skip CI checks for changeset-only PRs
  - add proper type casting for Tauri invoke responses
  - create PR for changeset instead of direct push to main
  - add pull-requests write permission for changeset PR creation
  - skip entire lint-and-build job for changeset-only PRs
  - Complete i18n support for Settings and UI tooltips (#48)
  - prevent race condition causing duplicate empty blocks (#49)
  - add custom context menu with rename and delete actions (#51)
  - reset to picker when deleting active workspace (#52)
  - prevent infinite loop in workspace initialization
  - fix workspace delete dialog z-index and auto theme behavior
  - complete auto-update functionality and move check to info tab (#64)
  - update updater status messages (#68)
  - inline updater UI in Settings modal (#71)
  - resolve technical debt by removing biome-ignore (#76)
  - add Tauri signing environment variables to CI build
  - add block drag-and-drop reordering (#86)
  - persist file deletion to database (#89)
  - refresh file tree after creating daily note hierarchy (#90)
- e57ced4: - migrate to GitHub Actions with concurrency control (#29)
  - create PR for changesets instead of direct push (#31)
  - replace peter-evans action with gh CLI (#33)
  - add initial i18n support with English and Korean locales (#38)
  - fix invalid syntax in auto-changeset workflow (#42)
  - integrate changeset generation into CI workflow (#44)
  - skip CI checks for changeset-only PRs
  - add proper type casting for Tauri invoke responses
  - create PR for changeset instead of direct push to main
  - add pull-requests write permission for changeset PR creation
  - skip entire lint-and-build job for changeset-only PRs
  - Complete i18n support for Settings and UI tooltips (#48)
  - prevent race condition causing duplicate empty blocks (#49)
  - add custom context menu with rename and delete actions (#51)
  - reset to picker when deleting active workspace (#52)
  - prevent infinite loop in workspace initialization
- 5dc4e76: - migrate to GitHub Actions with concurrency control (#29)
  - create PR for changesets instead of direct push (#31)
  - replace peter-evans action with gh CLI (#33)
  - add initial i18n support with English and Korean locales (#38)
  - fix invalid syntax in auto-changeset workflow (#42)
  - integrate changeset generation into CI workflow (#44)
  - skip CI checks for changeset-only PRs
  - add proper type casting for Tauri invoke responses
  - create PR for changeset instead of direct push to main
  - add pull-requests write permission for changeset PR creation
  - skip entire lint-and-build job for changeset-only PRs
  - Complete i18n support for Settings and UI tooltips (#48)
  - prevent race condition causing duplicate empty blocks (#49)
- 3c73769: - migrate to GitHub Actions with concurrency control (#29)
  - create PR for changesets instead of direct push (#31)
  - replace peter-evans action with gh CLI (#33)
  - add initial i18n support with English and Korean locales (#38)
  - fix invalid syntax in auto-changeset workflow (#42)
  - integrate changeset generation into CI workflow (#44)
  - skip CI checks for changeset-only PRs
  - add proper type casting for Tauri invoke responses
  - create PR for changeset instead of direct push to main
  - add pull-requests write permission for changeset PR creation
  - skip entire lint-and-build job for changeset-only PRs
  - Complete i18n support for Settings and UI tooltips (#48)
  - prevent race condition causing duplicate empty blocks (#49)
  - add custom context menu with rename and delete actions (#51)
  - reset to picker when deleting active workspace (#52)
- 1f440df: - migrate to GitHub Actions with concurrency control (#29)
  - create PR for changesets instead of direct push (#31)
  - replace peter-evans action with gh CLI (#33)
  - add initial i18n support with English and Korean locales (#38)
  - fix invalid syntax in auto-changeset workflow (#42)
  - integrate changeset generation into CI workflow (#44)
  - skip CI checks for changeset-only PRs
  - add proper type casting for Tauri invoke responses
  - create PR for changeset instead of direct push to main
  - add pull-requests write permission for changeset PR creation
  - skip entire lint-and-build job for changeset-only PRs
  - Complete i18n support for Settings and UI tooltips (#48)
  - prevent race condition causing duplicate empty blocks (#49)
  - add custom context menu with rename and delete actions (#51)
- a95091e: - migrate to GitHub Actions with concurrency control (#29)
  - create PR for changesets instead of direct push (#31)
  - replace peter-evans action with gh CLI (#33)
  - add initial i18n support with English and Korean locales (#38)
  - fix invalid syntax in auto-changeset workflow (#42)
  - integrate changeset generation into CI workflow (#44)
  - skip CI checks for changeset-only PRs
  - add proper type casting for Tauri invoke responses
  - create PR for changeset instead of direct push to main
  - add pull-requests write permission for changeset PR creation
  - skip entire lint-and-build job for changeset-only PRs
  - Complete i18n support for Settings and UI tooltips (#48)
  - prevent race condition causing duplicate empty blocks (#49)
  - add custom context menu with rename and delete actions (#51)
  - reset to picker when deleting active workspace (#52)
  - prevent infinite loop in workspace initialization
  - fix workspace delete dialog z-index and auto theme behavior
  - complete auto-update functionality and move check to info tab (#64)
  - update updater status messages (#68)
  - inline updater UI in Settings modal (#71)
  - resolve technical debt by removing biome-ignore (#76)
- 2b284e9: - migrate to GitHub Actions with concurrency control (#29)
  - create PR for changesets instead of direct push (#31)
  - replace peter-evans action with gh CLI (#33)
  - add initial i18n support with English and Korean locales (#38)
  - fix invalid syntax in auto-changeset workflow (#42)
  - integrate changeset generation into CI workflow (#44)
  - skip CI checks for changeset-only PRs
  - add proper type casting for Tauri invoke responses
  - create PR for changeset instead of direct push to main
  - add pull-requests write permission for changeset PR creation
  - skip entire lint-and-build job for changeset-only PRs
  - Complete i18n support for Settings and UI tooltips (#48)
  - prevent race condition causing duplicate empty blocks (#49)
  - add custom context menu with rename and delete actions (#51)
  - reset to picker when deleting active workspace (#52)
  - prevent infinite loop in workspace initialization
  - fix workspace delete dialog z-index and auto theme behavior
  - complete auto-update functionality and move check to info tab (#64)
  - update updater status messages (#68)
  - inline updater UI in Settings modal (#71)
  - resolve technical debt by removing biome-ignore (#76)
  - add Tauri signing environment variables to CI build
  - add block drag-and-drop reordering (#86)
- 2d46168: - migrate to GitHub Actions with concurrency control (#29)
  - create PR for changesets instead of direct push (#31)
  - replace peter-evans action with gh CLI (#33)
  - add initial i18n support with English and Korean locales (#38)
  - fix invalid syntax in auto-changeset workflow (#42)
  - integrate changeset generation into CI workflow (#44)
  - skip CI checks for changeset-only PRs
  - add proper type casting for Tauri invoke responses
  - create PR for changeset instead of direct push to main
  - add pull-requests write permission for changeset PR creation
  - skip entire lint-and-build job for changeset-only PRs
  - Complete i18n support for Settings and UI tooltips (#48)
  - prevent race condition causing duplicate empty blocks (#49)
  - add custom context menu with rename and delete actions (#51)
  - reset to picker when deleting active workspace (#52)
  - prevent infinite loop in workspace initialization
  - fix workspace delete dialog z-index and auto theme behavior
  - complete auto-update functionality and move check to info tab (#64)
  - update updater status messages (#68)
  - inline updater UI in Settings modal (#71)
  - resolve technical debt by removing biome-ignore (#76)
  - add Tauri signing environment variables to CI build
- c0894bf: - migrate to GitHub Actions with concurrency control (#29)
  - create PR for changesets instead of direct push (#31)
  - replace peter-evans action with gh CLI (#33)
  - add initial i18n support with English and Korean locales (#38)
  - fix invalid syntax in auto-changeset workflow (#42)
  - integrate changeset generation into CI workflow (#44)
  - skip CI checks for changeset-only PRs
  - add proper type casting for Tauri invoke responses
  - create PR for changeset instead of direct push to main
  - add pull-requests write permission for changeset PR creation
  - skip entire lint-and-build job for changeset-only PRs
  - Complete i18n support for Settings and UI tooltips (#48)
  - prevent race condition causing duplicate empty blocks (#49)
  - add custom context menu with rename and delete actions (#51)
  - reset to picker when deleting active workspace (#52)
  - prevent infinite loop in workspace initialization
  - fix workspace delete dialog z-index and auto theme behavior
- cbcb3a1: - migrate to GitHub Actions with concurrency control (#29)
  - create PR for changesets instead of direct push (#31)
  - replace peter-evans action with gh CLI (#33)
  - add initial i18n support with English and Korean locales (#38)
  - fix invalid syntax in auto-changeset workflow (#42)
  - integrate changeset generation into CI workflow (#44)
  - skip CI checks for changeset-only PRs
  - add proper type casting for Tauri invoke responses
  - create PR for changeset instead of direct push to main
  - add pull-requests write permission for changeset PR creation
  - skip entire lint-and-build job for changeset-only PRs
  - Complete i18n support for Settings and UI tooltips (#48)
  - prevent race condition causing duplicate empty blocks (#49)
  - add custom context menu with rename and delete actions (#51)
  - reset to picker when deleting active workspace (#52)
- 29d3b30: - migrate to GitHub Actions with concurrency control (#29)
  - create PR for changesets instead of direct push (#31)
  - replace peter-evans action with gh CLI (#33)
  - add initial i18n support with English and Korean locales (#38)
  - fix invalid syntax in auto-changeset workflow (#42)
  - integrate changeset generation into CI workflow (#44)
  - skip CI checks for changeset-only PRs
  - add proper type casting for Tauri invoke responses
  - create PR for changeset instead of direct push to main
  - add pull-requests write permission for changeset PR creation
  - skip entire lint-and-build job for changeset-only PRs
  - Complete i18n support for Settings and UI tooltips (#48)
  - prevent race condition causing duplicate empty blocks (#49)
  - add custom context menu with rename and delete actions (#51)
  - reset to picker when deleting active workspace (#52)
  - prevent infinite loop in workspace initialization
  - fix workspace delete dialog z-index and auto theme behavior
  - complete auto-update functionality and move check to info tab (#64)
  - update updater status messages (#68)
  - inline updater UI in Settings modal (#71)
  - resolve technical debt by removing biome-ignore (#76)
  - add Tauri signing environment variables to CI build
  - add block drag-and-drop reordering (#86)
- afe4f7b: - migrate to GitHub Actions with concurrency control (#29)
  - create PR for changesets instead of direct push (#31)
  - replace peter-evans action with gh CLI (#33)
  - add initial i18n support with English and Korean locales (#38)
  - fix invalid syntax in auto-changeset workflow (#42)
  - integrate changeset generation into CI workflow (#44)
  - skip CI checks for changeset-only PRs
  - add proper type casting for Tauri invoke responses
  - create PR for changeset instead of direct push to main
  - add pull-requests write permission for changeset PR creation
  - skip entire lint-and-build job for changeset-only PRs
  - Complete i18n support for Settings and UI tooltips (#48)
  - prevent race condition causing duplicate empty blocks (#49)
  - add custom context menu with rename and delete actions (#51)
  - reset to picker when deleting active workspace (#52)
  - prevent infinite loop in workspace initialization
  - fix workspace delete dialog z-index and auto theme behavior
  - complete auto-update functionality and move check to info tab (#64)
  - update updater status messages (#68)
  - inline updater UI in Settings modal (#71)
- 6950bb2: - migrate to GitHub Actions with concurrency control (#29)
  - create PR for changesets instead of direct push (#31)
  - replace peter-evans action with gh CLI (#33)
  - add initial i18n support with English and Korean locales (#38)
  - fix invalid syntax in auto-changeset workflow (#42)
  - integrate changeset generation into CI workflow (#44)
  - skip CI checks for changeset-only PRs
  - add proper type casting for Tauri invoke responses
  - create PR for changeset instead of direct push to main
  - add pull-requests write permission for changeset PR creation
  - skip entire lint-and-build job for changeset-only PRs
  - Complete i18n support for Settings and UI tooltips (#48)
  - prevent race condition causing duplicate empty blocks (#49)
  - add custom context menu with rename and delete actions (#51)
  - reset to picker when deleting active workspace (#52)
  - prevent infinite loop in workspace initialization
  - fix workspace delete dialog z-index and auto theme behavior
  - complete auto-update functionality and move check to info tab (#64)
  - update updater status messages (#68)
  - inline updater UI in Settings modal (#71)
- de6f2ce: - migrate to GitHub Actions with concurrency control (#29)
  - create PR for changesets instead of direct push (#31)
  - replace peter-evans action with gh CLI (#33)
  - add initial i18n support with English and Korean locales (#38)
  - fix invalid syntax in auto-changeset workflow (#42)
  - integrate changeset generation into CI workflow (#44)
  - skip CI checks for changeset-only PRs
  - add proper type casting for Tauri invoke responses
  - create PR for changeset instead of direct push to main
  - add pull-requests write permission for changeset PR creation
  - skip entire lint-and-build job for changeset-only PRs
  - Complete i18n support for Settings and UI tooltips (#48)
  - prevent race condition causing duplicate empty blocks (#49)
  - add custom context menu with rename and delete actions (#51)
  - reset to picker when deleting active workspace (#52)
  - prevent infinite loop in workspace initialization
  - fix workspace delete dialog z-index and auto theme behavior
  - complete auto-update functionality and move check to info tab (#64)
  - update updater status messages (#68)
  - inline updater UI in Settings modal (#71)
  - resolve technical debt by removing biome-ignore (#76)
  - add Tauri signing environment variables to CI build
  - add block drag-and-drop reordering (#86)
  - persist file deletion to database (#89)
  - refresh file tree after creating daily note hierarchy (#90)
