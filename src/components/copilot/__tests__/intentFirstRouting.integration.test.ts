import { classifyIntent } from "@/services/ai/utils/intentClassifier";
import { selectToolsByIntent } from "@/services/ai/utils/toolSelector";
import { describe, expect, it } from "vitest";

describe("Intent-First Routing Integration", () => {
  describe("Intent Hierarchy Principle", () => {
    it("respects intent classification hierarchy", () => {
      const conversational = classifyIntent("thanks");
      const information = classifyIntent("what are my pages?");
      const creation = classifyIntent("create a note");
      const modification = classifyIntent("delete this");

      expect(conversational.intent).toBe("CONVERSATIONAL");
      expect(information.intent).toBe("INFORMATION_REQUEST");
      expect(creation.intent).toBe("CONTENT_CREATION");
      expect(modification.intent).toBe("CONTENT_MODIFICATION");
    });
  });

  describe("Conversational Path", () => {
    it("detects casual user interactions", () => {
      const inputs = [
        "hi",
        "hello",
        "thanks",
        "cool!",
        "awesome",
        "good point",
      ];

      for (const input of inputs) {
        const result = classifyIntent(input);
        expect(result.intent).toBe("CONVERSATIONAL");
      }
    });

    it("provides zero tools for conversational", () => {
      const result = classifyIntent("hey there");
      const tools = selectToolsByIntent(result.intent);
      expect(tools).toEqual([]);
    });
  });

  describe("Information Request Path", () => {
    it("detects question and lookup patterns", () => {
      const inputs = [
        "what are my pages?",
        "show me the notes",
        "list all blocks",
        "find the document",
        "where is this?",
      ];

      for (const input of inputs) {
        const result = classifyIntent(input);
        expect(result.intent).toBe("INFORMATION_REQUEST");
      }
    });
  });

  describe("Content Creation Path", () => {
    it("detects creation intents", () => {
      const inputs = [
        "create a note",
        "write a summary",
        "generate an outline",
        "make a todo list",
      ];

      for (const input of inputs) {
        const result = classifyIntent(input);
        expect(result.intent).toBe("CONTENT_CREATION");
      }
    });

    it("handles multi-sentence creation requests", () => {
      const input =
        "Create a project plan with timeline and deliverables for Q4";
      const result = classifyIntent(input);
      expect(result.intent).toBe("CONTENT_CREATION");
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe("Content Modification Path", () => {
    it("detects modification intents", () => {
      const inputs = [
        "update the title",
        "delete old notes",
        "edit this section",
        "reorganize my pages",
        "remove the duplicate",
      ];

      for (const input of inputs) {
        const result = classifyIntent(input);
        expect(result.intent).toBe("CONTENT_MODIFICATION");
      }
    });
  });

  describe("Real-World Scenarios", () => {
    it("scenario: User greeting → conversational", () => {
      const intent = classifyIntent("hey, how are you?");
      expect(intent.intent).toBe("CONVERSATIONAL");
    });

    it("scenario: User asks for information → information request", () => {
      const intent = classifyIntent("Can you show me my recent notes?");
      expect(intent.intent).toBe("INFORMATION_REQUEST");
    });

    it("scenario: User creates content → creation", () => {
      const intent = classifyIntent("Create a project plan with timeline");
      expect(intent.intent).toBe("CONTENT_CREATION");
    });

    it("scenario: User modifies content → modification", () => {
      const intent = classifyIntent("Delete the outdated document");
      expect(intent.intent).toBe("CONTENT_MODIFICATION");
    });
  });

  describe("Intent Confidence Scoring", () => {
    it("provides high confidence for clear signals", () => {
      const clear = classifyIntent("delete_block abc123");
      expect(clear.confidence).toBeGreaterThan(0.85);
    });

    it("provides lower confidence for ambiguous input", () => {
      const ambiguous = classifyIntent("interesting");
      expect(ambiguous.confidence).toBeLessThan(0.85);
    });

    it("includes reasoning for classification", () => {
      const result = classifyIntent("what is this?");
      expect(result.reasoning).toBeTruthy();
      expect(result.reasoning.length).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    it("handles empty input gracefully", () => {
      const result = classifyIntent("");
      expect(result.intent).toBe("CONVERSATIONAL");
      expect(result.confidence).toBeLessThan(0.6);
    });

    it("handles very long input", () => {
      const longInput =
        "Create a comprehensive project plan including tasks, timeline, budget, and team assignments for our new initiative";
      const result = classifyIntent(longInput);
      expect(result.intent).toBe("CONTENT_CREATION");
    });

    it("is case-insensitive", () => {
      const lower = classifyIntent("delete this note");
      const upper = classifyIntent("DELETE THIS NOTE");
      const mixed = classifyIntent("DeLeTe ThIs NoTe");

      expect(lower.intent).toBe(upper.intent);
      expect(upper.intent).toBe(mixed.intent);
    });
  });
});
