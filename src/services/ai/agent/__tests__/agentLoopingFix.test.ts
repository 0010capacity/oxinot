import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

describe("Agent Looping Fix - System Prompt Validation", () => {
  let systemPromptContent: string;

  beforeEach(() => {
    const systemPromptPath = path.join(__dirname, "..", "system-prompt.md");
    systemPromptContent = readFileSync(systemPromptPath, "utf-8");
  });

  describe("Page Creation ≠ Task Completion", () => {
    it("should state that creating page alone is incomplete", () => {
      expect(systemPromptContent).toContain(
        "Creating a page alone is INCOMPLETE"
      );
    });

    it("should emphasize MUST CREATE BLOCKS after page", () => {
      expect(systemPromptContent).toContain(
        "AFTER CREATING A PAGE, YOU MUST CREATE BLOCKS"
      );
    });

    it("should warn never to provide final answer for empty pages", () => {
      expect(systemPromptContent).toContain(
        "NEVER provide final answer for empty pages"
      );
    });
  });

  describe("8-Step Workflow Clarity", () => {
    it("should include 8-step workflow", () => {
      expect(systemPromptContent).toContain("1. **Understand the Goal**");
      expect(systemPromptContent).toContain("4. **Create Page**");
      expect(systemPromptContent).toContain("6. **Create Blocks**");
      expect(systemPromptContent).toContain("8. **Final Response**");
    });

    it("should show that Step 6 (Create Blocks) includes validation and creation", () => {
      const workflowSection = systemPromptContent.substring(
        systemPromptContent.indexOf("### Standard Execution Pattern"),
        systemPromptContent.indexOf("### When to Stop")
      );
      expect(workflowSection).toContain("6. **Create Blocks**");
      expect(workflowSection).toContain("validate_markdown_structure");
      expect(workflowSection).toContain("create_blocks_from_markdown");
    });
  });

  describe("Complete Workflow Example", () => {
    it("should include Solar System example", () => {
      expect(systemPromptContent).toContain("Solar System");
    });

    it("should show complete Solar System workflow with all steps", () => {
      const exampleSection = systemPromptContent.substring(
        systemPromptContent.indexOf("COMPLETE WORKFLOW EXAMPLE"),
        systemPromptContent.indexOf("INCOMPLETE (DO NOT DO THIS)")
      );
      expect(exampleSection).toContain("Step 1:");
      expect(exampleSection).toContain("Step 2:");
      expect(exampleSection).toContain("Step 3:");
      expect(exampleSection).toContain("Step 4:");
      expect(exampleSection).toContain("Step 5:");
    });

    it("should show create_page in Solar System example", () => {
      const exampleSection = systemPromptContent.substring(
        systemPromptContent.indexOf("COMPLETE WORKFLOW EXAMPLE"),
        systemPromptContent.indexOf("INCOMPLETE (DO NOT DO THIS)")
      );
      expect(exampleSection).toContain("create_page");
    });

    it("should show create_blocks_from_markdown in Solar System example", () => {
      const exampleSection = systemPromptContent.substring(
        systemPromptContent.indexOf("COMPLETE WORKFLOW EXAMPLE"),
        systemPromptContent.indexOf("INCOMPLETE (DO NOT DO THIS)")
      );
      expect(exampleSection).toContain("create_blocks_from_markdown");
    });
  });

  describe("Incompleteness vs Completeness", () => {
    it("should show what is NOT complete", () => {
      expect(systemPromptContent).toContain("**INCOMPLETE (DO NOT DO THIS)**");
      expect(systemPromptContent).toContain(
        "Creating a page then immediately stopping"
      );
    });

    it("should show what IS complete", () => {
      expect(systemPromptContent).toContain("**COMPLETE**:");
      expect(systemPromptContent).toContain(
        "Page created AND blocks added AND properly nested"
      );
    });
  });

  describe("Anti-Pattern: Looping on Queries", () => {
    it("should explicitly forbid looping on list_pages", () => {
      expect(systemPromptContent).toContain(
        "**ANTI-PATTERN - LOOPING ON QUERIES**"
      );
      expect(systemPromptContent).toContain(
        "DON'T call `list_pages` multiple times"
      );
    });

    it("should forbid looping on query_pages", () => {
      expect(systemPromptContent).toContain(
        "DON'T call `query_pages` repeatedly"
      );
    });

    it("should state looping wastes iterations", () => {
      expect(systemPromptContent).toContain(
        "DON'T loop on page listing/query tools - it wastes iterations and locks you in a loop"
      );
    });

    it("should recommend immediate block creation after page", () => {
      expect(systemPromptContent).toContain(
        "IMMEDIATELY proceed to `validate_markdown_structure` → `create_blocks_from_markdown`"
      );
    });
  });

  describe("CRITICAL Section", () => {
    it("should have MOST CRITICAL emphasis", () => {
      expect(systemPromptContent).toContain("⚠️ **MOST CRITICAL** ⚠️");
    });

    it("should emphasize blocks must be created immediately", () => {
      expect(systemPromptContent).toContain(
        "AFTER CREATING A PAGE, YOU MUST CREATE BLOCKS IMMEDIATELY"
      );
    });

    it("should show workflow completion in key reminders", () => {
      expect(systemPromptContent).toContain("**WORKFLOW COMPLETION**");
      expect(systemPromptContent).toContain("Page Create");
      expect(systemPromptContent).toContain("Create Blocks");
    });
  });

  describe("Recovery Strategy Improvements", () => {
    it("should have anti-looping guidance in recovery", () => {
      const recoverySection = systemPromptContent.substring(
        systemPromptContent.indexOf("### Recovery Strategy"),
        systemPromptContent.indexOf("### When to Ask for Clarification")
      );
      expect(recoverySection).toContain(
        "**ANTI-PATTERN - LOOPING ON QUERIES**"
      );
    });

    it("should forbid list_pages looping", () => {
      expect(systemPromptContent).toContain(
        'DON\'T call `list_pages` multiple times to "verify" a page exists'
      );
    });
  });

  describe("Overall Quality", () => {
    it("should be comprehensive", () => {
      expect(systemPromptContent.length).toBeGreaterThan(25000);
    });

    it("should contain all major sections", () => {
      expect(systemPromptContent).toContain("Core Behavior Principles");
      expect(systemPromptContent).toContain("Task Execution Workflow");
      expect(systemPromptContent).toContain("Block & Page Operations");
      expect(systemPromptContent).toContain("Key Reminders");
    });
  });
});
