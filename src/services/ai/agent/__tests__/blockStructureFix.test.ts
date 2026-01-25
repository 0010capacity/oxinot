import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

describe("Copilot Block Structure Fix - System Prompt Validation", () => {
  let systemPromptContent: string;

  beforeEach(() => {
    const orchestratorPath = path.join(__dirname, "..", "orchestrator.ts");
    const content = readFileSync(orchestratorPath, "utf-8");
    const promptStart = content.indexOf("let systemPrompt = `");
    const promptEnd = content.indexOf("`;", promptStart);
    systemPromptContent = content.substring(promptStart, promptEnd);
  });

  describe("Markdown-to-Blocks Conversion Guidance", () => {
    it("should include CRITICAL marker for block structure", () => {
      expect(systemPromptContent).toContain("⭐ CRITICAL");
      expect(systemPromptContent).toContain("MARKDOWN TO BLOCKS CONVERSION");
    });

    it("should explain fundamental rule about block separation", () => {
      expect(systemPromptContent).toContain("convert markdown with newlines");
      expect(systemPromptContent).toContain("into SEPARATE BLOCKS");
      expect(systemPromptContent).toContain("CANNOT put multi-line text");
    });

    it("should explain why block separation matters", () => {
      expect(systemPromptContent).toContain("WHY THIS MATTERS");
      expect(systemPromptContent).toContain("user presses Enter");
      expect(systemPromptContent).toContain("Logseq style");
    });
  });

  describe("Conversion Algorithm", () => {
    it("should provide step-by-step algorithm", () => {
      expect(systemPromptContent).toContain(
        "MARKDOWN → BLOCKS CONVERSION ALGORITHM",
      );
      expect(systemPromptContent).toContain("1. Parse your markdown");
      expect(systemPromptContent).toContain("2. For each non-empty line");
      expect(systemPromptContent).toContain("3. Result:");
    });

    it("should explain heading detection", () => {
      expect(systemPromptContent).toContain("heading level");
      expect(systemPromptContent).toContain("# symbols");
    });

    it("should explain indent calculation", () => {
      expect(systemPromptContent).toContain("indent");
      expect(systemPromptContent).toContain("heading_level - 1");
    });
  });

  describe("Concrete Examples", () => {
    it("should include wrong example", () => {
      expect(systemPromptContent).toContain("WRONG");
      expect(systemPromptContent).toContain("❌");
      expect(systemPromptContent).toContain("Do NOT do this");
    });

    it("should show wrong approach with newlines", () => {
      expect(systemPromptContent).toContain("content:");
      expect(systemPromptContent).toContain("\\n");
    });

    it("should include right example", () => {
      expect(systemPromptContent).toContain("RIGHT");
      expect(systemPromptContent).toContain("✅");
      expect(systemPromptContent).toContain("Do THIS instead");
    });

    it("should show right approach with separate blocks", () => {
      expect(systemPromptContent).toContain("blocks: [");
      expect(systemPromptContent).toContain("indent: 0");
      expect(systemPromptContent).toContain("indent: 1");
      expect(systemPromptContent).toContain("indent: 2");
    });
  });

  describe("Indent Calculation Rules", () => {
    it("should specify indent for top-level headings", () => {
      expect(systemPromptContent).toContain("# (top heading)");
      expect(systemPromptContent).toContain("indent: 0");
    });

    it("should specify indent for nested content", () => {
      expect(systemPromptContent).toContain("Content under #");
      expect(systemPromptContent).toContain("indent: 1");
    });

    it("should have rules for all heading levels", () => {
      expect(systemPromptContent).toContain("##");
      expect(systemPromptContent).toContain("###");
    });

    it("should mention list item nesting", () => {
      expect(systemPromptContent).toContain("List items");
      expect(systemPromptContent).toContain("nesting level");
    });
  });

  describe("Verification Checklist", () => {
    it("should include verification checklist", () => {
      expect(systemPromptContent).toContain("VERIFICATION CHECKLIST");
      expect(systemPromptContent).toContain("- [ ]");
    });

    it("should check for single-line blocks", () => {
      expect(systemPromptContent).toContain("SINGLE LINE");
      expect(systemPromptContent).toContain("no \\n");
    });

    it("should check for heading symbols", () => {
      expect(systemPromptContent).toContain("starts with #");
    });

    it("should check hierarchy consistency", () => {
      expect(systemPromptContent).toContain("Heading blocks");
      expect(systemPromptContent).toContain("lower indent");
    });

    it("should check for empty blocks", () => {
      expect(systemPromptContent).toContain("empty blocks");
    });
  });

  describe("Tool Recommendations", () => {
    it("should recommend create_page_with_blocks", () => {
      expect(systemPromptContent).toContain("create_page_with_blocks");
      expect(systemPromptContent).toContain("initial structured content");
    });

    it("should mention create_block for single blocks", () => {
      expect(systemPromptContent).toContain("create_block");
    });

    it("should mention insert_block_below", () => {
      expect(systemPromptContent).toContain("insert_block_below");
      expect(systemPromptContent).toContain("precise placement");
    });
  });

  describe("Clarity and Formatting", () => {
    it("should have clear visual separators", () => {
      expect(systemPromptContent).toContain("━━━━");
    });

    it("should use success and failure markers", () => {
      expect(systemPromptContent).toContain("❌");
      expect(systemPromptContent).toContain("✅");
    });

    it("should have section headers", () => {
      expect(systemPromptContent).toContain("WHY");
      expect(systemPromptContent).toContain("RULES");
      expect(systemPromptContent).toContain("CHECKLIST");
    });
  });

  describe("Integration with Agent Behavior", () => {
    it("should be part of system prompt not just comments", () => {
      expect(systemPromptContent).toContain("let systemPrompt");
    });

    it("should use emphasis for critical guidance", () => {
      expect(systemPromptContent).toContain("FUNDAMENTAL RULE");
    });

    it("should provide actionable guidance", () => {
      expect(systemPromptContent).toContain("MUST");
      expect(systemPromptContent).toContain("CANNOT");
    });
  });
});
