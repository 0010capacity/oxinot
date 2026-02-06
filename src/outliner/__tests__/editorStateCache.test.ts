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

  describe("LRU eviction", () => {
    const MAX_ENTRIES = 50;

    it("should evict oldest entry when cache exceeds MAX_ENTRIES", () => {
      // Fill cache beyond MAX_ENTRIES
      for (let i = 0; i < MAX_ENTRIES + 5; i++) {
        editorStateCache.set(
          `block-${i}`,
          createMockEditorState(`content-${i}`)
        );
      }

      // Should only keep MAX_ENTRIES
      expect(editorStateCache.size()).toBe(MAX_ENTRIES);

      // Oldest entries should be evicted
      expect(editorStateCache.has("block-0")).toBe(false);
      expect(editorStateCache.has("block-1")).toBe(false);
      expect(editorStateCache.has("block-2")).toBe(false);
      expect(editorStateCache.has("block-3")).toBe(false);
      expect(editorStateCache.has("block-4")).toBe(false);

      // Newest entries should still exist
      expect(editorStateCache.has("block-50")).toBe(true);
      expect(editorStateCache.has(`block-${MAX_ENTRIES + 4}`)).toBe(true);
    });

    it("should update LRU order on get() access", () => {
      // Fill cache to MAX_ENTRIES
      for (let i = 0; i < MAX_ENTRIES; i++) {
        editorStateCache.set(`block-${i}`, createMockEditorState());
      }

      // Access an older entry (block-10) to make it recently used
      editorStateCache.get("block-10");

      // Add one more entry to trigger eviction
      editorStateCache.set(`block-${MAX_ENTRIES}`, createMockEditorState());

      // block-10 should still exist because it was recently accessed
      expect(editorStateCache.has("block-10")).toBe(true);

      // block-0 should be evicted (oldest and not recently accessed)
      expect(editorStateCache.has("block-0")).toBe(false);
    });

    it("should update LRU order on set() for existing entry", () => {
      // Fill cache to MAX_ENTRIES
      for (let i = 0; i < MAX_ENTRIES; i++) {
        editorStateCache.set(`block-${i}`, createMockEditorState(`v1-${i}`));
      }

      // Update an older entry (block-10)
      editorStateCache.set("block-10", createMockEditorState("v2-updated"));

      // Add one more entry to trigger eviction
      editorStateCache.set(`block-${MAX_ENTRIES}`, createMockEditorState());

      // block-10 should still exist because it was recently updated
      expect(editorStateCache.has("block-10")).toBe(true);

      // block-0 should be evicted
      expect(editorStateCache.has("block-0")).toBe(false);
    });

    it("should evict in correct LRU order with multiple accesses", () => {
      // Fill cache to MAX_ENTRIES
      for (let i = 0; i < MAX_ENTRIES; i++) {
        editorStateCache.set(`block-${i}`, createMockEditorState());
      }

      // Access several older entries in this order: block-5, block-3, block-7
      editorStateCache.get("block-5");
      editorStateCache.get("block-3");
      editorStateCache.get("block-7");

      // Add 5 new entries to trigger multiple evictions
      for (let i = MAX_ENTRIES; i < MAX_ENTRIES + 5; i++) {
        editorStateCache.set(`block-${i}`, createMockEditorState());
      }

      // Recently accessed entries should still exist
      expect(editorStateCache.has("block-5")).toBe(true);
      expect(editorStateCache.has("block-3")).toBe(true);
      expect(editorStateCache.has("block-7")).toBe(true);

      // Unaccessed old entries should be evicted (starting from block-0)
      expect(editorStateCache.has("block-0")).toBe(false);
      expect(editorStateCache.has("block-1")).toBe(false);
      expect(editorStateCache.has("block-2")).toBe(false);
      expect(editorStateCache.has("block-4")).toBe(false);
    });

    it("should maintain correct size after multiple evictions", () => {
      // Add entries in batches to trigger multiple evictions
      for (let batch = 0; batch < 3; batch++) {
        for (let i = 0; i < 25; i++) {
          const id = `block-${batch * 25 + i}`;
          editorStateCache.set(id, createMockEditorState(id));
        }
      }

      // Should never exceed MAX_ENTRIES
      expect(editorStateCache.size()).toBe(MAX_ENTRIES);

      // Only the most recent entries should exist
      for (let i = 0; i < 25; i++) {
        expect(editorStateCache.has(`block-${i}`)).toBe(false);
      }
      for (let i = 25; i < 75; i++) {
        expect(editorStateCache.has(`block-${i}`)).toBe(true);
      }
    });

    it("should remove from access order when clear() is called", () => {
      editorStateCache.set("block-1", createMockEditorState());
      editorStateCache.set("block-2", createMockEditorState());
      editorStateCache.set("block-3", createMockEditorState());

      editorStateCache.clear("block-2");

      // Add 49 entries (block-4 through block-52) to exceed MAX_ENTRIES (50)
      // This triggers eviction of block-1 (oldest entry)
      for (let i = 4; i <= MAX_ENTRIES + 2; i++) {
        editorStateCache.set(`block-${i}`, createMockEditorState());
      }

      // block-2 should not affect eviction since it was cleared
      expect(editorStateCache.has("block-1")).toBe(false);
      expect(editorStateCache.has("block-3")).toBe(true);
      expect(editorStateCache.has(`block-${MAX_ENTRIES + 2}`)).toBe(true);
    });
  });
});
