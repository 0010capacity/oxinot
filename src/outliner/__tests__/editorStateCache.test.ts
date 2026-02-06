import type { EditorState } from "@codemirror/state";
import { beforeEach, describe, expect, it } from "vitest";
import { editorStateCache } from "../editorStateCache";

function createMockEditorState(content = "test content"): EditorState {
  return {
    doc: { length: content.length, toString: () => content },
  } as unknown as EditorState;
}

describe("EditorStateCache", () => {
  beforeEach(() => {
    editorStateCache.clearAll();
  });

  describe("set", () => {
    it("should store editor state by blockId", () => {
      const state = createMockEditorState();
      const initialSize = editorStateCache.size();

      editorStateCache.set("block-1", state);

      expect(editorStateCache.size()).toBe(initialSize + 1);
    });
  });

  describe("get", () => {
    it("should retrieve stored editor state", () => {
      const state = createMockEditorState("hello world");

      editorStateCache.set("block-1", state);
      const retrieved = editorStateCache.get("block-1");

      expect(retrieved).toBe(state);
    });

    it("should return undefined for missing blockId", () => {
      const result = editorStateCache.get("non-existent-block");

      expect(result).toBeUndefined();
    });
  });

  describe("has", () => {
    it("should return true for cached blockId", () => {
      const state = createMockEditorState();
      editorStateCache.set("block-1", state);

      expect(editorStateCache.has("block-1")).toBe(true);
    });

    it("should return false for never-cached blockId", () => {
      expect(editorStateCache.has("unknown-block")).toBe(false);
    });
  });

  describe("clear", () => {
    it("should remove specific block from cache", () => {
      const state1 = createMockEditorState("first");
      const state2 = createMockEditorState("second");
      const state3 = createMockEditorState("third");

      editorStateCache.set("block-1", state1);
      editorStateCache.set("block-2", state2);
      editorStateCache.set("block-3", state3);

      editorStateCache.clear("block-2");

      expect(editorStateCache.has("block-1")).toBe(true);
      expect(editorStateCache.has("block-2")).toBe(false);
      expect(editorStateCache.has("block-3")).toBe(true);
    });
  });

  describe("clearAll", () => {
    it("should empty entire cache", () => {
      editorStateCache.set("block-1", createMockEditorState());
      editorStateCache.set("block-2", createMockEditorState());
      editorStateCache.set("block-3", createMockEditorState());

      editorStateCache.clearAll();

      expect(editorStateCache.size()).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("should overwrite state when setting same blockId twice", () => {
      const state1 = createMockEditorState("first");
      const state2 = createMockEditorState("second");

      editorStateCache.set("block-1", state1);
      editorStateCache.set("block-1", state2);

      const retrieved = editorStateCache.get("block-1");
      expect(retrieved).toBe(state2);
      expect(retrieved).not.toBe(state1);
      expect(editorStateCache.size()).toBe(1);
    });

    it("should handle same state object for multiple blocks", () => {
      const sharedState = createMockEditorState("shared content");

      editorStateCache.set("block-1", sharedState);
      editorStateCache.set("block-2", sharedState);

      expect(editorStateCache.get("block-1")).toBe(sharedState);
      expect(editorStateCache.get("block-2")).toBe(sharedState);
      expect(editorStateCache.size()).toBe(2);
    });
  });

  describe("size", () => {
    it("should correctly count cached items", () => {
      expect(editorStateCache.size()).toBe(0);

      editorStateCache.set("block-1", createMockEditorState());
      expect(editorStateCache.size()).toBe(1);

      editorStateCache.set("block-2", createMockEditorState());
      expect(editorStateCache.size()).toBe(2);

      editorStateCache.set("block-3", createMockEditorState());
      expect(editorStateCache.size()).toBe(3);
    });

    it("should decrease after clear()", () => {
      editorStateCache.set("block-1", createMockEditorState());
      editorStateCache.set("block-2", createMockEditorState());
      editorStateCache.set("block-3", createMockEditorState());

      expect(editorStateCache.size()).toBe(3);

      editorStateCache.clear("block-2");
      expect(editorStateCache.size()).toBe(2);

      editorStateCache.clear("block-1");
      expect(editorStateCache.size()).toBe(1);
    });

    it("should return 0 after clearAll()", () => {
      editorStateCache.set("block-1", createMockEditorState());
      editorStateCache.set("block-2", createMockEditorState());

      expect(editorStateCache.size()).toBe(2);

      editorStateCache.clearAll();
      expect(editorStateCache.size()).toBe(0);
    });
  });
});
