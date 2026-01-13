#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

/**
 * Auto-generate changesets based on commit messages
 * Only runs on main branch (after PR merge)
 * Analyzes all commits since last changeset creation
 */

const CHANGESET_DIR = path.join(__dirname, ".changeset");

// Get current branch name
function getCurrentBranch() {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
    }).trim();
  } catch {
    return "";
  }
}

// Get all commits since last release tag
function getCommitsSinceLastRelease() {
  try {
    // Get the last version tag
    const lastTag = execSync(
      'git describe --tags --abbrev=0 2>/dev/null || echo ""',
      {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }
    ).trim();

    let commitRange;
    if (lastTag) {
      commitRange = `${lastTag}..HEAD`;
    } else {
      // No tags yet, get all commits
      commitRange = "HEAD";
    }

    const commits = execSync(
      `git log ${commitRange} --pretty=format:"%H|%s|%b" --reverse`,
      {
        encoding: "utf-8",
      }
    ).trim();

    return commits
      .split("\n")
      .filter((c) => c.trim())
      .map((line) => {
        const [hash, subject, body] = line.split("|");
        return { hash, subject, body: body || "" };
      });
  } catch {
    return [];
  }
}

// Parse commit message to extract type and scope
function parseCommitMessage(subject) {
  const match = subject.match(/^(\w+)(\([\w-]+\))?:\s*(.+)/);
  if (!match) return null;

  return {
    type: match[1],
    scope: match[2] ? match[2].slice(1, -1) : "",
    subject: match[3],
  };
}

// Determine version bump type based on commit type
function getVersionBump(commitType) {
  switch (commitType) {
    case "feat":
    case "improve":
      return "minor";
    case "fix":
    case "perf":
      return "patch";
    default:
      return null;
  }
}

// Check if commit has breaking change
function hasBreakingChange(commitBody, subject) {
  return (
    /^BREAKING CHANGE:/m.test(commitBody) || subject.includes("BREAKING CHANGE")
  );
}

// Generate a unique changeset filename
function generateChangesetFilename() {
  const adjectives = [
    "happy",
    "lazy",
    "quiet",
    "bright",
    "clever",
    "swift",
    "proud",
    "brave",
    "kind",
    "wise",
  ];
  const animals = [
    "bear",
    "cat",
    "dog",
    "eagle",
    "fox",
    "lion",
    "owl",
    "panda",
    "tiger",
    "wolf",
  ];
  const verbs = [
    "jump",
    "run",
    "walk",
    "fly",
    "swim",
    "climb",
    "dance",
    "sing",
    "play",
    "laugh",
  ];

  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const verb = verbs[Math.floor(Math.random() * verbs.length)];

  return `${adj}-${animal}s-${verb}`;
}

// Create changeset file
function createChangeset(versionBump, subject, scope) {
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
    execSync(`git add "${filepath}"`, { stdio: "pipe" });
  } catch {
    // Silently continue
  }
}

// Group commits by highest version bump needed
function groupChangesets(commits) {
  const changesets = [];
  let currentGroup = [];
  let highestBump = null;

  for (const commit of commits) {
    const parsed = parseCommitMessage(commit.subject);
    if (!parsed) continue;

    // Check for breaking change
    const versionBump = hasBreakingChange(commit.body, commit.subject)
      ? "major"
      : getVersionBump(parsed.type);

    if (!versionBump) continue;

    currentGroup.push({ commit, parsed, versionBump });

    // Track highest bump level
    if (versionBump === "major") {
      highestBump = "major";
    } else if (versionBump === "minor" && highestBump !== "major") {
      highestBump = "minor";
    } else if (highestBump === null) {
      highestBump = "patch";
    }
  }

  if (currentGroup.length > 0) {
    return {
      commits: currentGroup,
      highestBump: highestBump,
    };
  }

  return null;
}

// Check if changesets already exist for recent commits
function haveRecentChangesets() {
  try {
    const files = fs.readdirSync(CHANGESET_DIR);
    const changesetFiles = files.filter(
      (f) => f.endsWith(".md") && f !== "README.md"
    );

    if (changesetFiles.length === 0) return false;

    // Check if any changeset was created in the last 30 seconds
    const now = Date.now();
    for (const file of changesetFiles) {
      const filePath = path.join(CHANGESET_DIR, file);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs < 30000) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

// Main function
function main() {
  const branch = getCurrentBranch();

  // Only run on main branch
  if (branch !== "main") {
    return;
  }

  // Skip if we recently created changesets
  if (haveRecentChangesets()) {
    return;
  }

  // Get commits since last release
  const commits = getCommitsSinceLastRelease();

  if (commits.length === 0) {
    return;
  }

  // Group commits and find highest version bump
  const grouped = groupChangesets(commits);

  if (!grouped) {
    return;
  }

  // Create a single changeset for all recent commits
  const descriptions = grouped.commits
    .map((item) => `- ${item.parsed.subject}`)
    .join("\n");

  const filename = generateChangesetFilename();
  const filepath = path.join(CHANGESET_DIR, `${filename}.md`);

  const content = `---
"oxinot": ${grouped.highestBump}
---

${descriptions}
`;

  fs.writeFileSync(filepath, content);

  // Stage the changeset file
  try {
    execSync(`git add "${filepath}"`, { stdio: "pipe" });
  } catch {
    // Silently continue
  }
}

main();
