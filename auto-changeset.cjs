#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

/**
 * Auto-generate changesets based on commit messages
 * Runs in GitHub Actions after PR merge to main branch
 * Prevents duplicate changeset generation by tracking processed commits
 */

const CHANGESET_DIR = path.join(__dirname, ".changeset");
const PROCESSED_COMMITS_FILE = path.join(CHANGESET_DIR, ".processed-commits");

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

// Load previously processed commits
function getProcessedCommits() {
  try {
    if (!fs.existsSync(PROCESSED_COMMITS_FILE)) {
      return new Set();
    }
    const content = fs.readFileSync(PROCESSED_COMMITS_FILE, "utf-8");
    return new Set(content.split("\n").filter((h) => h.trim()));
  } catch {
    return new Set();
  }
}

// Save processed commit hash
function markCommitAsProcessed(hash) {
  try {
    const processed = getProcessedCommits();
    processed.add(hash);
    fs.writeFileSync(
      PROCESSED_COMMITS_FILE,
      `${Array.from(processed).join("\n")}\n`,
    );
  } catch {
    // Silently continue
  }
}

// Get commits since last release
function getCommitsSinceLastRelease() {
  try {
    // Get the last version tag
    const lastTag = execSync(
      'git describe --tags --abbrev=0 2>/dev/null || echo ""',
      {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      },
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
      },
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
  if (!subject || typeof subject !== "string") return null;

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

// Group commits by highest version bump needed
function groupChangesets(commits, processedCommits) {
  const validCommits = [];
  let highestBump = null;

  for (const commit of commits) {
    if (!commit || !commit.subject || !commit.hash) continue;

    // Skip already processed commits
    if (processedCommits.has(commit.hash)) continue;

    const parsed = parseCommitMessage(commit.subject);
    if (!parsed) continue;

    // Check for breaking change
    const versionBump = hasBreakingChange(commit.body, commit.subject)
      ? "major"
      : getVersionBump(parsed.type);

    if (!versionBump) continue;

    validCommits.push({ commit, parsed, versionBump });

    // Track highest bump level
    if (versionBump === "major") {
      highestBump = "major";
    } else if (versionBump === "minor" && highestBump !== "major") {
      highestBump = "minor";
    } else if (highestBump === null) {
      highestBump = "patch";
    }
  }

  if (validCommits.length > 0) {
    return {
      commits: validCommits,
      highestBump: highestBump,
    };
  }

  return null;
}

// Main function
function main() {
  try {
    const branch = getCurrentBranch();

    // Only run on main branch
    if (branch !== "main") {
      console.log("Not on main branch, skipping changeset generation");
      process.exit(0);
    }

    // Get previously processed commits
    const processedCommits = getProcessedCommits();

    // Get commits since last release
    const commits = getCommitsSinceLastRelease();

    if (commits.length === 0) {
      console.log("No commits found since last release");
      process.exit(0);
    }

    // Group commits and find highest version bump
    const grouped = groupChangesets(commits, processedCommits);

    if (!grouped) {
      console.log(
        "No qualifying commits found (all already processed or invalid format)",
      );
      process.exit(0);
    }

    // Create a single changeset for all new commits
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

    // Mark all commits as processed
    for (const item of grouped.commits) {
      markCommitAsProcessed(item.commit.hash);
    }

    console.log(
      `✓ Generated changeset: ${filename}.md (${grouped.highestBump} bump, ${grouped.commits.length} commits)`,
    );
    process.exit(0);
  } catch (error) {
    console.error("✗ Failed to generate changeset:", error.message);
    process.exit(1);
  }
}

main();
