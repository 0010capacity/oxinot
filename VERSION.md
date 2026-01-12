# Oxinot Versioning Guide

## Semantic Versioning

This project follows [Semantic Versioning 2.0.0](https://semver.org/).

Version format: `MAJOR.MINOR.PATCH`

### MAJOR Version
Increment when making incompatible API changes:
- Breaking changes to block structure or data format
- Incompatible database schema changes
- Breaking changes to Tauri command API
- Major feature removals

### MINOR Version
Increment when adding functionality in a backward-compatible manner:
- New features or enhancements
- New Tauri commands
- UI/UX improvements
- New configuration options

### PATCH Version
Increment when making backward-compatible bug fixes:
- Bug fixes and stability improvements
- Performance optimizations
- Documentation updates
- Minor UI tweaks

## Commit Message Conventions

Follow conventional commits format for clarity:

```
type(scope): subject

body

footer
```

### Commit Types
- **feat**: A new feature (minor version bump)
- **fix**: A bug fix (patch version bump)
- **improve**: Enhancement or improvement (minor version bump)
- **docs**: Documentation changes only (no version bump)
- **refactor**: Code refactoring without feature changes (no version bump)
- **perf**: Performance improvement (patch version bump)
- **test**: Test-related changes (no version bump)
- **chore**: Build, dependency, or tooling changes (no version bump)

### Breaking Changes
Append `BREAKING CHANGE:` in the footer to indicate a major version bump:

```
feat(api): redesign block structure

BREAKING CHANGE: Block data format changed from `content` to `text`
```

## Version Update Process

1. Review commits since last version
2. Determine version bump type (major, minor, or patch)
3. Update version in:
   - `package.json`
   - `src-tauri/tauri.conf.json`
   - `src-tauri/Cargo.toml`
4. Create a version commit (e.g., "chore: release v0.1.0")
5. Tag the commit (e.g., `git tag v0.1.0`)

## Current Version History

- v0.0.1: Initial development
- v0.1.0: IME composition handling improvements and block split fixes