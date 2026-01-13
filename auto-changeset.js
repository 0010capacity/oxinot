#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Auto-generate changesets based on commit message
 * Runs as a post-commit hook
 */

const CHANGESET_DIR = path.join(__dirname, '.changeset');

// Get the last commit message
function getLastCommitMessage() {
  try {
    return execSync('git log -1 --pretty=%B', { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

// Parse commit message to extract type and scope
function parseCommitMessage(message) {
  const match = message.match(/^(\w+)(\([\w-]+\))?:\s*(.+)/);
  if (!match) return null;

  return {
    type: match[1],
    scope: match[2] ? match[2].slice(1, -1) : '',
    subject: match[3]
  };
}

// Determine version bump type based on commit type
function getVersionBump(commitType) {
  switch (commitType) {
    case 'feat':
    case 'improve':
      return 'minor';
    case 'fix':
    case 'perf':
      return 'patch';
    default:
      return null; // No changeset needed
  }
}

// Check if commit message contains breaking change
function hasBreakingChange(message) {
  return /^BREAKING CHANGE:/m.test(message);
}

// Generate a unique changeset filename
function generateChangesetFilename() {
  const adjectives = ['happy', 'lazy', 'quiet', 'bright', 'clever', 'swift', 'proud', 'brave', 'kind', 'wise'];
  const animals = ['bear', 'cat', 'dog', 'eagle', 'fox', 'lion', 'owl', 'panda', 'tiger', 'wolf'];
  const verbs = ['jump', 'run', 'walk', 'fly', 'swim', 'climb', 'dance', 'sing', 'play', 'laugh'];

  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const verb = verbs[Math.floor(Math.random() * verbs.length)];

  return `${adj}-${animal}s-${verb}`;
}

// Check if a changeset already exists for this commit
function changesetAlreadyExists() {
  const files = fs.readdirSync(CHANGESET_DIR);
  // If there are any .md files other than README.md and config.json, assume changeset exists
  const changesetFiles = files.filter(f => f.endsWith('.md') && f !== 'README.md');

  // Get the current timestamp to see if a changeset was just created
  const now = Date.now();
  for (const file of changesetFiles) {
    const filePath = path.join(CHANGESET_DIR, file);
    const stat = fs.statSync(filePath);
    // If a changeset was created in the last 5 seconds, assume it's for this commit
    if (now - stat.mtimeMs < 5000) {
      return true;
    }
  }

  return false;
}

// Create changeset file
function createChangeset(versionBump, subject, scope) {
  if (changesetAlreadyExists()) {
    return; // Changeset already exists for this commit
  }

  const filename = generateChangesetFilename();
  const filepath = path.join(CHANGESET_DIR, `${filename}.md`);

  // Create a user-friendly description from commit subject
  let description = subject;
  if (scope) {
    description = `${description} (${scope})`;
  }

  const content = `---
"oxinot": ${versionBump}
---

${description}
`;

  fs.writeFileSync(filepath, content);

  // Stage the changeset file
  try {
    execSync(`git add ${filepath}`, { stdio: 'pipe' });
  } catch {
    // If git add fails, silently continue
  }
}

// Main function
function main() {
  const commitMessage = getLastCommitMessage();

  if (!commitMessage) {
    return; // No commit message found
  }

  const parsed = parseCommitMessage(commitMessage);

  if (!parsed) {
    return; // Commit message doesn't follow conventional commits
  }

  // Check for breaking changes (takes precedence)
  if (hasBreakingChange(commitMessage)) {
    createChangeset('major', parsed.subject, parsed.scope);
    return;
  }

  // Get version bump based on commit type
  const versionBump = getVersionBump(parsed.type);

  if (versionBump) {
    createChangeset(versionBump, parsed.subject, parsed.scope);
  }
}

main();
