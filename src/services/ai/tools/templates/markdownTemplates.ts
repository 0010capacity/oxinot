/**
 * Markdown Templates Library
 *
 * Pre-built markdown structures for common note-taking patterns.
 * Each template provides a starting structure that the copilot can use or expand upon.
 */

export interface MarkdownTemplate {
  name: string;
  description: string;
  category: string;
  markdown: string;
}

export const markdownTemplates: MarkdownTemplate[] = [
  {
    name: "Meeting Notes",
    description:
      "Structure for capturing meeting details, attendees, and action items",
    category: "meetings",
    markdown: `# Meeting: [Title]
  Date: [Date]
  Attendees: [Names]
  Duration: [Time]
## Agenda
  - [Item 1]
  - [Item 2]
  - [Item 3]
## Discussion
  - [Key point 1]
  - [Key point 2]
  - [Decisions made]
## Action Items
  - [ ] [Action 1] - Owner: [Name]
  - [ ] [Action 2] - Owner: [Name]
## Next Steps
  - Schedule follow-up meeting
  - Document decisions
## Notes
  [Additional notes here]`,
  },
  {
    name: "Project Planning",
    description:
      "Structure for organizing project goals, phases, and deliverables",
    category: "projects",
    markdown: `# Project: [Project Name]
  Status: [Active/Planning/On Hold]
  Start Date: [Date]
  Target Completion: [Date]
## Overview
  [Project description and purpose]
## Goals
  - [Goal 1]
  - [Goal 2]
  - [Goal 3]
## Phases
  ### Phase 1: [Name]
    Start: [Date]
    End: [Date]
    Deliverables:
      - [Deliverable 1]
      - [Deliverable 2]
  ### Phase 2: [Name]
    Start: [Date]
    End: [Date]
    Deliverables:
      - [Deliverable 1]
## Resources
  - Team members: [Names]
  - Budget: [Amount]
  - Tools needed: [Tools]
## Risks & Mitigation
  - Risk: [Risk description] - Mitigation: [Strategy]
## Timeline
  [Visual or detailed timeline here]`,
  },
  {
    name: "Research Notes",
    description: "Structure for organizing research, sources, and findings",
    category: "research",
    markdown: `# Research: [Topic]
  Started: [Date]
  Status: [In Progress/Complete]
## Research Question
  [Main question being investigated]
## Key Findings
  - [Finding 1]
  - [Finding 2]
  - [Finding 3]
## Sources
  ### Primary Sources
    - [Source 1] - URL/Reference
    - [Source 2] - URL/Reference
  ### Secondary Sources
    - [Source 1] - URL/Reference
    - [Source 2] - URL/Reference
## Analysis
  [Detailed analysis of findings]
## Synthesis
  [How findings relate to each other and to research question]
## Conclusions
  - [Conclusion 1]
  - [Conclusion 2]
## Related Topics
  - [Topic 1]
  - [Topic 2]
## To Investigate
  - [ ] [Question 1]
  - [ ] [Question 2]`,
  },
  {
    name: "Learning Journal",
    description: "Structure for documenting learning progress and reflections",
    category: "learning",
    markdown: `# Learning: [Topic]
  Started: [Date]
  Goal: [What you want to achieve]
## Today's Learning
  ### New Concepts
    - [Concept 1]: [Brief explanation]
    - [Concept 2]: [Brief explanation]
  ### Practical Application
    - [What I did]
    - [Results]
  ### Questions
    - [Question 1]
    - [Question 2]
## Resources Used
  - [Resource 1]
  - [Resource 2]
## Key Takeaways
  - [Takeaway 1]
  - [Takeaway 2]
## Practice Areas
  - [ ] [Practice area 1]
  - [ ] [Practice area 2]
## Reflection
  [How this connects to prior knowledge, what to focus on next]
## Progress Tracker
  Week 1: [Summary]
  Week 2: [Summary]`,
  },
  {
    name: "Decision Log",
    description:
      "Structure for documenting important decisions and their rationale",
    category: "decisions",
    markdown: `# Decision: [Decision Title]
  Date: [Date Made]
  Owner: [Person/Team]
  Status: [Active/Implemented/Reversed]
## Context
  [What situation prompted this decision]
## Options Considered
  ### Option 1: [Name]
    Pros:
      - [Pro 1]
      - [Pro 2]
    Cons:
      - [Con 1]
      - [Con 2]
  ### Option 2: [Name]
    Pros:
      - [Pro 1]
      - [Pro 2]
    Cons:
      - [Con 1]
      - [Con 2]
## Decision
  [The chosen option and why]
## Implementation Plan
  - [Step 1]
  - [Step 2]
  - [Step 3]
## Expected Outcomes
  - [Outcome 1]
  - [Outcome 2]
## Review Date
  [When to reassess this decision]
## Lessons Learned
  [What we learned from this decision]`,
  },
  {
    name: "Feature Specification",
    description:
      "Structure for detailing a software feature or product requirement",
    category: "development",
    markdown: `# Feature: [Feature Name]
  Version: [Version]
  Status: [Proposed/In Review/In Development/Complete]
  Priority: [Critical/High/Medium/Low]
## Overview
  [Brief description of what this feature does]
## User Story
  As a [user type], I want [capability], so that [benefit]
## Requirements
  ### Functional Requirements
    - [Requirement 1]
    - [Requirement 2]
  ### Non-Functional Requirements
    - [Requirement 1: Performance]
    - [Requirement 2: Security]
## Acceptance Criteria
  - [ ] [Criterion 1]
  - [ ] [Criterion 2]
  - [ ] [Criterion 3]
## Design & Architecture
  [Technical approach, diagrams if applicable]
## Dependencies
  - [Dependency 1]
  - [Dependency 2]
## Timeline
  Estimate: [Duration]
  Start: [Date]
  Target Complete: [Date]
## Testing Plan
  - [Test scenario 1]
  - [Test scenario 2]`,
  },
  {
    name: "Book Summary",
    description: "Structure for documenting key insights from a book",
    category: "reading",
    markdown: `# Book: [Title]
  Author: [Author Name]
  Published: [Year]
  Pages: [Number]
  Rating: [Rating]
## Summary
  [Brief overview of the book's main theme and premise]
## Main Ideas
  - [Idea 1]: [Explanation]
  - [Idea 2]: [Explanation]
  - [Idea 3]: [Explanation]
## Key Quotes
  > "[Quote 1]" - Page [number]
  > "[Quote 2]" - Page [number]
## Concepts Explained
  ### [Concept 1]
    [Detailed explanation]
  ### [Concept 2]
    [Detailed explanation]
## Personal Insights
  [How this book changed your thinking, what resonates]
## Practical Application
  - [How to apply idea 1]
  - [How to apply idea 2]
## Related Books
  - [Related book 1]
  - [Related book 2]
## For Further Exploration
  - [Topic 1]
  - [Topic 2]`,
  },
  {
    name: "Problem-Solving",
    description: "Structure for documenting a problem, analysis, and solution",
    category: "problem-solving",
    markdown: `# Problem: [Problem Title]
  Date Identified: [Date]
  Severity: [Critical/High/Medium/Low]
  Status: [Open/In Progress/Resolved]
## Problem Statement
  [Clear description of the problem]
## Symptoms
  - [Symptom 1]
  - [Symptom 2]
  - [Symptom 3]
## Root Cause Analysis
  ### Potential Causes
    - [Cause 1]
    - [Cause 2]
  ### Most Likely Cause
    [Which cause is most probable and why]
## Solution Approaches
  ### Approach 1
    [Description and feasibility]
  ### Approach 2
    [Description and feasibility]
## Recommended Solution
  [Which approach chosen and rationale]
## Implementation Steps
  - [ ] [Step 1]
  - [ ] [Step 2]
  - [ ] [Step 3]
## Verification
  - [How to verify solution works]
  - [Expected results]
## Lessons Learned
  [What was learned to prevent similar problems]`,
  },
];

/**
 * Get a template by name
 * @param name - Template name (exact match)
 * @returns Template if found, undefined otherwise
 */
export function getTemplate(name: string): MarkdownTemplate | undefined {
  return markdownTemplates.find((t) => t.name === name);
}

/**
 * Get all template names for UI display
 * @returns Array of template names
 */
export function getTemplateNames(): string[] {
  return markdownTemplates.map((t) => t.name);
}

/**
 * Get templates by category
 * @param category - Category name
 * @returns Array of templates in that category
 */
export function getTemplatesByCategory(category: string): MarkdownTemplate[] {
  return markdownTemplates.filter((t) => t.category === category);
}

/**
 * Get all unique categories
 * @returns Array of category names
 */
export function getAllCategories(): string[] {
  const categories = new Set(markdownTemplates.map((t) => t.category));
  return Array.from(categories).sort();
}
