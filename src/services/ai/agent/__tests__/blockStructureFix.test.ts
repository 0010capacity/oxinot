import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

describe("Copilot System Prompt Validation", () => {
  let systemPromptContent: string;

  beforeEach(() => {
    const systemPromptPath = path.join(__dirname, "..", "system-prompt.md");
    systemPromptContent = readFileSync(systemPromptPath, "utf-8");
  });

  describe("Block & Page Operations Section", () => {
    it("should include comprehensive block operations guide", () => {
      expect(systemPromptContent).toContain("Block & Page Operations");
      expect(systemPromptContent).toContain("Creating Block Structures");
      expect(systemPromptContent).toContain("Markdown-First Workflow");
    });

    it("should include step-by-step workflow for creating structured notes", () => {
      expect(systemPromptContent).toContain("Step 1:");
      expect(systemPromptContent).toContain("Step 2:");
      expect(systemPromptContent).toContain("Step 3:");
      expect(systemPromptContent).toContain("Step 4:");
    });

    it("should explain markdown indentation rules", () => {
      expect(systemPromptContent).toContain("2 spaces per nesting level");
      expect(systemPromptContent).toContain("dash + space");
      expect(systemPromptContent).toContain("not tabs");
    });

    it("should recommend proper tool usage", () => {
      expect(systemPromptContent).toContain("create_page_with_blocks");
      expect(systemPromptContent).toContain("create_blocks_batch");
      expect(systemPromptContent).toContain("validate_markdown_structure");
    });

    it("should include validation and error recovery guidance", () => {
      expect(systemPromptContent).toContain("Validation & Error Recovery");
      expect(systemPromptContent).toContain("If validation fails");
      expect(systemPromptContent).toContain("Read the error");
    });

    it("should include proper examples of block structures", () => {
      expect(systemPromptContent).toContain("```markdown");
      expect(systemPromptContent).toContain("- Root item");
      expect(systemPromptContent).toContain("- Nested item");
    });
  });

  describe("Core Behavior Principles", () => {
    it("should explain fundamental principles", () => {
      expect(systemPromptContent).toContain("Core Behavior Principles");
      expect(systemPromptContent).toContain("Always Use Tools");
      expect(systemPromptContent).toContain("Read Before Write");
      expect(systemPromptContent).toContain("Plan Efficiently");
    });

    it("should emphasize tool-first approach", () => {
      expect(systemPromptContent).toContain("Tool-first philosophy");
      expect(systemPromptContent).toContain("You MUST use tools");
    });

    it("should include error handling guidance", () => {
      expect(systemPromptContent).toContain("Learn from Failures");
      expect(systemPromptContent).toContain("If a tool fails");
      expect(systemPromptContent).toContain("DO NOT retry the same approach");
    });

    it("should provide actionable guidance", () => {
      expect(systemPromptContent).toContain("MUST");
      expect(systemPromptContent).toContain("DO");
    });
  });

  describe("Content Creation Guidelines", () => {
    it("should include content creation guidelines", () => {
      expect(systemPromptContent).toContain("Content Creation Guidelines");
      expect(systemPromptContent).toContain("Writing High-Quality Notes");
    });

    it("should include template patterns", () => {
      expect(systemPromptContent).toContain("Template Patterns");
      expect(systemPromptContent).toContain("Meeting Notes");
      expect(systemPromptContent).toContain("Project Documentation");
    });

    it("should guide on content types", () => {
      expect(systemPromptContent).toContain("Content Types");
      expect(systemPromptContent).toContain("Summarization");
      expect(systemPromptContent).toContain("Expansion");
    });
  });

  describe("Error Handling & Recovery", () => {
    it("should include error handling section", () => {
      expect(systemPromptContent).toContain("Error Handling & Recovery");
      expect(systemPromptContent).toContain("Common Error Types");
    });

    it("should include recovery strategies", () => {
      expect(systemPromptContent).toContain("Recovery Strategy");
      expect(systemPromptContent).toContain("Stop and Analyze");
      expect(systemPromptContent).toContain("Check State");
    });

    it("should guide when to ask for clarification", () => {
      expect(systemPromptContent).toContain("When to Ask for Clarification");
    });
  });

  describe("Available Tools Overview", () => {
    it("should list page tools", () => {
      expect(systemPromptContent).toContain("Page Tools");
      expect(systemPromptContent).toContain("list_pages");
      expect(systemPromptContent).toContain("create_page");
    });

    it("should list block tools", () => {
      expect(systemPromptContent).toContain("Block Tools");
      expect(systemPromptContent).toContain("get_block");
      expect(systemPromptContent).toContain("create_block");
      expect(systemPromptContent).toContain("update_block");
    });

    it("should mention batch creation tools", () => {
      expect(systemPromptContent).toContain("create_blocks_batch");
      expect(systemPromptContent).toContain("validate_markdown_structure");
    });
  });

  describe("Key Reminders Section", () => {
    it("should include key reminders", () => {
      expect(systemPromptContent).toContain("Key Reminders");
    });

    it("should remind about tool usage", () => {
      expect(systemPromptContent).toContain("ALWAYS use tools");
    });

    it("should remind about UUID usage", () => {
      expect(systemPromptContent).toContain("UUIDs, not titles");
    });
  });
});
