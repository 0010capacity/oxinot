import { describe, expect, it } from "vitest";
import {
  classifyIntent,
  isContentModification,
  isConversational,
} from "../intentClassifier";

describe("intentClassifier", () => {
  describe("classifyIntent - Modification Intent", () => {
    it("detects delete operations", () => {
      const inputs = [
        "Delete the first block",
        "Remove this page",
        "Erase all the content",
        "Destroy this block",
      ];

      for (const input of inputs) {
        const result = classifyIntent(input);
        expect(result.intent).toBe("CONTENT_MODIFICATION");
        expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      }
    });

    it("detects update/edit operations", () => {
      const inputs = [
        "Update this block",
        "Edit the first paragraph",
        "Modify the page title",
        "Change the content",
        "Replace this text",
        "Revise the note",
        "Rewrite this section",
      ];

      for (const input of inputs) {
        const result = classifyIntent(input);
        expect(result.intent).toBe("CONTENT_MODIFICATION");
        expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      }
    });

    it("detects reorganization operations", () => {
      const inputs = [
        "Move this block",
        "Rename the page",
        "Reorganize my notes",
        "Reorder the sections",
      ];

      for (const input of inputs) {
        const result = classifyIntent(input);
        expect(result.intent).toBe("CONTENT_MODIFICATION");
      }
    });

    it("detects merge/split operations", () => {
      const inputs = [
        "Merge these blocks",
        "Combine the notes",
        "Split this page",
        "Break this section",
        "Separate the items",
      ];

      for (const input of inputs) {
        const result = classifyIntent(input);
        expect(result.intent).toBe("CONTENT_MODIFICATION");
      }
    });
  });

  describe("classifyIntent - Content Creation Intent", () => {
    it("detects create operations", () => {
      const inputs = [
        "Create a new note",
        "Make a todo list",
        "Add a new block",
        "Write a draft",
        "Generate a list",
      ];

      for (const input of inputs) {
        const result = classifyIntent(input);
        expect(result.intent).toBe("CONTENT_CREATION");
        expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      }
    });

    it("detects page/note creation patterns", () => {
      const inputs = [
        "New page for meeting notes",
        "Write a document",
        "Create a new outline",
        "Compose a proposal",
      ];

      for (const input of inputs) {
        const result = classifyIntent(input);
        expect(result.intent).toBe("CONTENT_CREATION");
      }
    });

    it("detects planning/structuring operations", () => {
      const inputs = [
        "Plan the project",
        "Outline the chapter",
        "Structure my thoughts",
        "Organize the workflow",
      ];

      for (const input of inputs) {
        const result = classifyIntent(input);
        expect(result.intent).toBe("CONTENT_CREATION");
      }
    });

    it("detects conversion operations", () => {
      const inputs = [
        "Convert this into a todo list",
        "Transform the text into a plan",
        "Format as a checklist",
      ];

      for (const input of inputs) {
        const result = classifyIntent(input);
        expect(result.intent).toBe("CONTENT_CREATION");
      }
    });

    it("detects multi-sentence instructions as creation", () => {
      const input =
        "Create a project plan with timeline. Include milestones and deliverables.";
      const result = classifyIntent(input);
      expect(result.intent).toBe("CONTENT_CREATION");
    });
  });

  describe("classifyIntent - Information Request Intent", () => {
    it("detects question words", () => {
      const inputs = [
        "What is the summary?",
        "Where are my notes?",
        "When is the deadline?",
        "Who is assigned?",
        "Which items are done?",
        "Why did this fail?",
        "How does this work?",
      ];

      for (const input of inputs) {
        const result = classifyIntent(input);
        expect(result.intent).toBe("INFORMATION_REQUEST");
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      }
    });

    it("detects information keywords", () => {
      const inputs = [
        "List all my pages",
        "Show the recent blocks",
        "Find the meeting notes",
        "Search for urgency",
        "Look up the details",
        "Get the block content",
        "Retrieve my notes",
      ];

      for (const input of inputs) {
        const result = classifyIntent(input);
        expect(result.intent).toBe("INFORMATION_REQUEST");
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      }
    });

    it("detects polar questions", () => {
      const inputs = [
        "Do you know the answer?",
        "Can you find this?",
        "Could you tell me the status?",
      ];

      for (const input of inputs) {
        const result = classifyIntent(input);
        expect(result.intent).toBe("INFORMATION_REQUEST");
      }
    });
  });

  describe("classifyIntent - Conversational Intent", () => {
    it("detects greetings", () => {
      const inputs = [
        "Hello!",
        "Hi there",
        "Hey",
        "Good morning",
        "Good afternoon",
        "Good evening",
      ];

      for (const input of inputs) {
        const result = classifyIntent(input);
        expect(result.intent).toBe("CONVERSATIONAL");
      }
    });

    it("detects gratitude", () => {
      const inputs = [
        "Thanks",
        "Thank you",
        "I appreciate it",
        "Cool, thanks!",
      ];

      for (const input of inputs) {
        const result = classifyIntent(input);
        expect(result.intent).toBe("CONVERSATIONAL");
      }
    });

    it("detects casual positive responses", () => {
      const inputs = [
        "Awesome!",
        "Nice!",
        "Good",
        "Great!",
        "Okay",
        "Sure",
        "Yeah",
      ];

      for (const input of inputs) {
        const result = classifyIntent(input);
        expect(result.intent).toBe("CONVERSATIONAL");
      }
    });

    it("detects personal conversational statements", () => {
      const inputs = [
        "I'm doing well",
        "Thanks for asking",
        "Pretty good today",
      ];

      for (const input of inputs) {
        const result = classifyIntent(input);
        expect(result.intent).toBe("CONVERSATIONAL");
      }
    });
  });

  describe("classifyIntent - Edge Cases", () => {
    it("handles empty input", () => {
      const result = classifyIntent("");
      expect(result.intent).toBe("CONVERSATIONAL");
      expect(result.confidence).toBeLessThan(0.6);
    });

    it("handles whitespace-only input", () => {
      const result = classifyIntent("   ");
      expect(result.intent).toBe("CONVERSATIONAL");
    });

    it("handles case insensitivity", () => {
      const lowercase = classifyIntent("delete the block");
      const uppercase = classifyIntent("DELETE THE BLOCK");
      expect(lowercase.intent).toBe(uppercase.intent);
      expect(lowercase.intent).toBe("CONTENT_MODIFICATION");
    });

    it("defaults to conversational for single verbs without context", () => {
      const result = classifyIntent("create");
      expect(["CONVERSATIONAL", "CONTENT_CREATION"]).toContain(result.intent);
    });

    it("handles ambiguous but conversational input", () => {
      const result = classifyIntent("interesting");
      expect(result.intent).toBe("CONVERSATIONAL");
      expect(result.confidence).toBeLessThan(0.8);
    });

    it("defaults to conversational for unclear intent", () => {
      const inputs = ["xyz", "lorem ipsum", "the quick brown fox"];
      for (const input of inputs) {
        const result = classifyIntent(input);
        expect(result.intent).toBe("CONVERSATIONAL");
      }
    });
  });

  describe("classifyIntent - Multi-language", () => {
    it("detects modification verbs with context", () => {
      const result = classifyIntent("delete the block");
      expect(result.intent).toBe("CONTENT_MODIFICATION");
    });
  });

  describe("classifyIntent - Confidence Levels", () => {
    it("assigns higher confidence to clear markers", () => {
      const verySpecific = classifyIntent("delete_block abc123");
      const general = classifyIntent("xyz");
      expect(verySpecific.confidence).toBeGreaterThan(general.confidence);
    });

    it("provides reasoning for classification", () => {
      const result = classifyIntent("What is this?");
      expect(result.reasoning).toBeTruthy();
      expect(result.reasoning.length).toBeGreaterThan(0);
    });
  });

  describe("Helper Functions", () => {
    it("isContentModification returns true for creation/modification", () => {
      expect(isContentModification("CONTENT_CREATION")).toBe(true);
      expect(isContentModification("CONTENT_MODIFICATION")).toBe(true);
      expect(isContentModification("CONVERSATIONAL")).toBe(false);
      expect(isContentModification("INFORMATION_REQUEST")).toBe(false);
    });

    it("isConversational returns true only for conversational", () => {
      expect(isConversational("CONVERSATIONAL")).toBe(true);
      expect(isConversational("CONTENT_CREATION")).toBe(false);
      expect(isConversational("CONTENT_MODIFICATION")).toBe(false);
      expect(isConversational("INFORMATION_REQUEST")).toBe(false);
    });
  });

  describe("classifyIntent - Prioritization", () => {
    it("prioritizes modification markers over creation verbs", () => {
      const result = classifyIntent("delete_block item");
      expect(result.intent).toBe("CONTENT_MODIFICATION");
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it("prioritizes modification patterns over information patterns", () => {
      const result = classifyIntent("delete where active = true");
      expect(result.intent).toBe("CONTENT_MODIFICATION");
    });

    it("handles create+update as modification", () => {
      const result = classifyIntent("update and save the document");
      expect(result.intent).toBe("CONTENT_MODIFICATION");
    });
  });

  describe("classifyIntent - Common User Patterns", () => {
    it("handles natural language creation requests", () => {
      const inputs = [
        "I want to create a shopping list",
        "Can you make a project outline?",
        "Please write up meeting notes",
      ];

      for (const input of inputs) {
        const result = classifyIntent(input);
        expect([
          "CONTENT_CREATION",
          "INFORMATION_REQUEST",
          "CONVERSATIONAL",
        ]).toContain(result.intent);
      }
    });

    it("distinguishes between asking for info and creating content", () => {
      const infoRequest = classifyIntent("What are my tasks?");
      const creation = classifyIntent("Create a task list");
      expect(infoRequest.intent).toBe("INFORMATION_REQUEST");
      expect(creation.intent).toBe("CONTENT_CREATION");
    });
  });
});
