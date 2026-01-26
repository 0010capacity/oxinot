import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

describe("Copilot Tool Efficiency Fix - System Prompt Validation", () => {
  let systemPromptContent: string;

  beforeEach(() => {
    const systemPromptPath = path.join(__dirname, "..", "system-prompt.md");
    systemPromptContent = readFileSync(systemPromptPath, "utf-8");
  });

  describe("Step 2: Tool Recommendation", () => {
    it("should recommend create_blocks_batch as primary approach for markdown structures", () => {
      expect(systemPromptContent).toContain("create_blocks_batch");
      expect(systemPromptContent).toContain("RECOMMENDED FOR ALL CASES");
    });

    it("should explain why create_blocks_batch works best", () => {
      expect(systemPromptContent).toContain("automatically parses indentation");
      expect(systemPromptContent).toContain("parent-child relationships");
    });

    it("should show create_page_with_blocks only for flat structures", () => {
      expect(systemPromptContent).toContain("create_page_with_blocks");
      expect(systemPromptContent).toContain("ONLY IF NO INDENTATION");
    });

    it("should guide AI away from manual block array creation", () => {
      expect(systemPromptContent).toContain("❌");
      expect(systemPromptContent).toContain(
        "Trying to manually calculate parentBlockId",
      );
    });
  });

  describe("Step 3: Markdown Structure Requirements", () => {
    it("should explain 2-space indentation requirement", () => {
      expect(systemPromptContent).toContain("2 spaces per nesting level");
      expect(systemPromptContent).toContain("not tabs");
    });

    it("should require dash-space marker on every line", () => {
      expect(systemPromptContent).toContain("Every line must start with `- `");
      expect(systemPromptContent).toContain("dash + space");
    });

    it("should list common mistakes to avoid", () => {
      expect(systemPromptContent).toContain("Common mistakes to avoid");
      expect(systemPromptContent).toContain("Mixed tabs and spaces");
      expect(systemPromptContent).toContain("Inconsistent indentation");
      expect(systemPromptContent).toContain("Lines without `- ` marker");
    });
  });

  describe("Step 4: Validation & Error Recovery", () => {
    it("should recommend validation before create_blocks_batch", () => {
      expect(systemPromptContent).toContain("validate_markdown_structure");
      expect(systemPromptContent).toContain("Step B:");
    });

    it("should explain validation response format", () => {
      expect(systemPromptContent).toContain("isValid:");
      expect(systemPromptContent).toContain("blockCount:");
      expect(systemPromptContent).toContain("maxDepth:");
    });

    it("should provide error recovery steps", () => {
      expect(systemPromptContent).toContain("If validation fails");
      expect(systemPromptContent).toContain("Read the error");
      expect(systemPromptContent).toContain("Fix the markdown");
      expect(systemPromptContent).toContain("Re-validate");
    });
  });

  describe("Overall Structure Quality", () => {
    it("should have clear workflow sections", () => {
      expect(systemPromptContent).toContain("Step 1:");
      expect(systemPromptContent).toContain("Step 2:");
      expect(systemPromptContent).toContain("Step 3:");
      expect(systemPromptContent).toContain("Step 4:");
    });

    it("should feature create_blocks_batch prominently in step 2", () => {
      const step2Section = systemPromptContent.substring(
        systemPromptContent.indexOf("#### Step 2:"),
        systemPromptContent.indexOf("#### Step 3:"),
      );

      expect(step2Section).toContain("create_blocks_batch");
      expect(step2Section).toContain("RECOMMENDED FOR ALL CASES");
      expect(step2Section).toContain("validate_markdown_structure");
    });
  });

  describe("Tool Examples", () => {
    it("should show 3-step workflow with create_blocks_batch", () => {
      const step2Section = systemPromptContent.substring(
        systemPromptContent.indexOf("#### Step 2:"),
        systemPromptContent.indexOf("#### Step 3:"),
      );

      expect(step2Section).toContain("Step A:");
      expect(step2Section).toContain("Step B:");
      expect(step2Section).toContain("Step C:");
      expect(step2Section).toContain("create_blocks_batch");
    });

    it("should show create_page_with_blocks example for flat structures only", () => {
      const step2Section = systemPromptContent.substring(
        systemPromptContent.indexOf("#### Step 2:"),
        systemPromptContent.indexOf("#### Step 3:"),
      );

      expect(step2Section).toContain("create_page_with_blocks");
      expect(step2Section).toContain("ONLY IF NO INDENTATION");
    });

    it("should show markdown structure examples", () => {
      expect(systemPromptContent).toContain("```markdown");
      expect(systemPromptContent).toContain("- Root item");
      expect(systemPromptContent).toContain("- Nested item");
    });
  });
});
