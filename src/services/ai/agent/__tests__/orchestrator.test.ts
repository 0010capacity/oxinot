import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IAIProvider, StreamChunk } from "../../types";
import { AgentOrchestrator } from "../orchestrator";
import type { AgentStep } from "../types";

// Mock dependencies
vi.mock("../../tools/registry", () => ({
  toolRegistry: {
    getAll: () => [
      { name: "test_tool", description: "A test tool", parameters: {} },
    ],
  },
}));

vi.mock("../../tools/executor", () => ({
  executeTool: vi.fn().mockResolvedValue({ success: true, data: {} }),
}));

vi.mock("../../../stores/blockStore", () => ({
  useBlockStore: {
    getState: () => ({ blocksById: {}, currentPageId: null }),
  },
}));

vi.mock("../../../stores/pageStore", () => ({
  usePageStore: { getState: () => ({ pagesById: {} }) },
}));

vi.mock("../../../stores/blockUIStore", () => ({
  useBlockUIStore: {
    getState: () => ({ focusedBlockId: null, selectedBlockIds: [] }),
  },
}));

// Mock the raw markdown import
vi.mock("../system-prompt.md?raw", () => ({
  default: "Test system prompt",
}));

describe("AgentOrchestrator Phase Transition", () => {
  let mockProvider: IAIProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProvider = {
      id: "test-provider",
      generateStream: vi.fn(),
      generate: vi.fn(),
    } as unknown as IAIProvider;
  });

  it("should yield final_answer immediately when AI returns text-only (no tools)", async () => {
    // Mock provider to return text only
    vi.mocked(mockProvider.generateStream).mockImplementation(
      async function* (): AsyncGenerator<StreamChunk> {
        yield { type: "text", content: "Hello, I can help you!" };
      },
    );

    const orchestrator = new AgentOrchestrator(mockProvider);
    const steps: AgentStep[] = [];

    for await (const step of orchestrator.execute("test", {
      context: {} as any,
    })) {
      steps.push(step);
    }

    const finalSteps = steps.filter((s) => s.type === "final_answer");
    expect(finalSteps).toHaveLength(1);
    expect(finalSteps[0].content).toBe("Hello, I can help you!");

    const state = orchestrator.getState();
    expect(state.status).toBe("completed");
    expect(state.executionPhase).toBe("execution"); // Never transitioned because no tools called
  });

  it("should complete when AI returns text-only after tool calls in previous iteration", async () => {
    let callCount = 0;

    (mockProvider.generateStream as any).mockImplementation(async function* () {
      callCount++;
      if (callCount === 1) {
        yield {
          type: "tool_call",
          toolCall: { id: "1", name: "test_tool", arguments: {} },
        };
      } else {
        yield { type: "text", content: "I completed the task" };
      }
    });

    const orchestrator = new AgentOrchestrator(mockProvider);
    const steps: AgentStep[] = [];

    for await (const step of orchestrator.execute("test", {
      context: {} as any,
    })) {
      steps.push(step);
    }

    const toolCallSteps = steps.filter((s) => s.type === "tool_call");
    const observationSteps = steps.filter((s) => s.type === "observation");
    const finalSteps = steps.filter((s) => s.type === "final_answer");

    expect(toolCallSteps).toHaveLength(1);
    expect(observationSteps).toHaveLength(1);
    expect(finalSteps).toHaveLength(1);
    expect(finalSteps[0].content).toBe("I completed the task");

    const state = orchestrator.getState();
    expect(state.toolCallsMade).toBe(1);
    expect(state.status).toBe("completed");
  });

  it("should produce final step with budget message when tool budget exhausted", async () => {
    // Always return tool calls - will hit budget limit
    vi.mocked(mockProvider.generateStream).mockImplementation(
      async function* (): AsyncGenerator<StreamChunk> {
        yield {
          type: "tool_call",
          toolCall: { id: "1", name: "test_tool", arguments: {} },
        };
      },
    );

    const orchestrator = new AgentOrchestrator(mockProvider);
    const steps: AgentStep[] = [];

    for await (const step of orchestrator.execute("test", {
      context: {} as any,
      maxTotalToolCalls: 2, // Low budget
    })) {
      steps.push(step);
    }

    const finalSteps = steps.filter((s) => s.type === "final_answer");
    expect(finalSteps).toHaveLength(1);
    expect(finalSteps[0].content).toContain("budget");

    const state = orchestrator.getState();
    expect(state.status).toBe("completed");
  });

  it("should not have any TaskProgress references in orchestrator source", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const sourcePath = path.resolve(__dirname, "../orchestrator.ts");
    const source = fs.readFileSync(sourcePath, "utf-8");

    expect(source).not.toContain("TaskProgress");
    expect(source).not.toContain("taskProgress");
    expect(source).not.toContain("task_progress");
  });
});
