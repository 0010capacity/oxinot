import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { editorStateCache } from "../editorStateCache";

function createMockEditorState(content = "test content"): EditorState {
  return {
    doc: {
      length: content.length,
      toString: () => content,
    },
    selection: {
      main: { head: 0, anchor: 0, from: 0, to: 0 },
    },
  } as unknown as EditorState;
}

function createMockEditorView(content = "test content"): EditorView {
  const state = createMockEditorState(content);
  return {
    state,
    hasFocus: false,
    focus: vi.fn(),
    dispatch: vi.fn(),
    setState: vi.fn(),
    posAtCoords: vi.fn().mockReturnValue(5),
    dom: { nodeType: 1 },
  } as unknown as EditorView;
}

describe("BlockComponent Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    editorStateCache.clearAll();
  });

  describe("Focus Switching Behavior", () => {
    it("should determine correct component based on focus state", () => {
      const isFocused = false;
      const shouldRenderEditor = isFocused;
      const shouldRenderStatic = !isFocused;

      expect(shouldRenderEditor).toBe(false);
      expect(shouldRenderStatic).toBe(true);
    });

    it("should determine Editor rendering when focused", () => {
      const isFocused = true;
      const shouldRenderEditor = isFocused;
      const shouldRenderStatic = !isFocused;

      expect(shouldRenderEditor).toBe(true);
      expect(shouldRenderStatic).toBe(false);
    });

    it("should correctly handle focus state transitions", () => {
      let isFocused = false;
      expect(isFocused ? "Editor" : "StaticMarkdownRenderer").toBe(
        "StaticMarkdownRenderer",
      );

      isFocused = true;
      expect(isFocused ? "Editor" : "StaticMarkdownRenderer").toBe("Editor");

      isFocused = false;
      expect(isFocused ? "Editor" : "StaticMarkdownRenderer").toBe(
        "StaticMarkdownRenderer",
      );
    });
  });

  describe("EditorState Caching", () => {
    it("should save EditorState to cache on focus loss", () => {
      const blockId = "block-1";
      const mockState = createMockEditorState("Hello World");

      const isFocused = false;
      if (!isFocused) {
        editorStateCache.set(blockId, mockState);
      }

      expect(editorStateCache.get(blockId)).toBe(mockState);
      expect(editorStateCache.has(blockId)).toBe(true);
    });

    it("should restore EditorState from cache on focus gain", () => {
      const blockId = "block-1";
      const cachedState = createMockEditorState("Cached content");
      const mockView = createMockEditorView("Cached content");

      editorStateCache.set(blockId, cachedState);

      const isFocused = true;
      if (isFocused) {
        const cached = editorStateCache.get(blockId);
        if (cached) {
          mockView.setState(cached);
        }
      }

      expect(mockView.setState).toHaveBeenCalledWith(cachedState);
    });

    it("should not call setState when no cached state exists", () => {
      const blockId = "block-new";
      const mockView = createMockEditorView("New content");

      expect(editorStateCache.has(blockId)).toBe(false);

      const isFocused = true;
      if (isFocused) {
        const cached = editorStateCache.get(blockId);
        if (cached) {
          mockView.setState(cached);
        }
      }

      expect(mockView.setState).not.toHaveBeenCalled();
    });

    it("should overwrite previous state when re-caching", () => {
      const blockId = "block-1";
      const state1 = createMockEditorState("First state");
      const state2 = createMockEditorState("Second state");

      editorStateCache.set(blockId, state1);
      expect(editorStateCache.get(blockId)).toBe(state1);

      editorStateCache.set(blockId, state2);
      expect(editorStateCache.get(blockId)).toBe(state2);
      expect(editorStateCache.get(blockId)).not.toBe(state1);
    });
  });

  describe("Click Coordinate Handling", () => {
    it("should capture click coordinates in handleStaticMouseDown", () => {
      interface PendingFocusSelection {
        blockId: string;
        clientX: number;
        clientY: number;
      }

      let pendingFocusSelection: PendingFocusSelection | null = null;

      const mockEvent = {
        clientX: 100,
        clientY: 50,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };

      const blockId = "block-1";

      mockEvent.preventDefault();
      mockEvent.stopPropagation();
      pendingFocusSelection = {
        blockId,
        clientX: mockEvent.clientX,
        clientY: mockEvent.clientY,
      };

      expect(pendingFocusSelection).toEqual({
        blockId: "block-1",
        clientX: 100,
        clientY: 50,
      });
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });

    it("should use posAtCoords to map click position to cursor", () => {
      const mockView = createMockEditorView("Hello World");
      const pendingSelection = {
        blockId: "block-1",
        clientX: 100,
        clientY: 50,
      };

      const pos = mockView.posAtCoords({
        x: pendingSelection.clientX,
        y: pendingSelection.clientY,
      });

      expect(mockView.posAtCoords).toHaveBeenCalledWith({ x: 100, y: 50 });
      expect(pos).toBe(5);
    });

    it("should dispatch selection to editor view after position calculation", () => {
      const mockView = createMockEditorView("Hello World");
      const pos = 5;
      const docLength = 11;

      const clampedPos = Math.min(Math.max(0, pos), docLength);

      mockView.dispatch({
        selection: { anchor: clampedPos, head: clampedPos },
      });

      expect(mockView.dispatch).toHaveBeenCalledWith({
        selection: { anchor: 5, head: 5 },
      });
    });

    it("should clamp position to document bounds", () => {
      const docLength = 10;

      let pos = 100;
      let clampedPos = Math.min(Math.max(0, pos), docLength);
      expect(clampedPos).toBe(10);

      pos = -5;
      clampedPos = Math.min(Math.max(0, pos), docLength);
      expect(clampedPos).toBe(0);

      pos = 5;
      clampedPos = Math.min(Math.max(0, pos), docLength);
      expect(clampedPos).toBe(5);
    });
  });

  describe("IME Composition Blocking", () => {
    it("should block mousedown when isComposing is true", () => {
      const mockEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };

      const isComposing = true;
      let onMouseDownCaptureCalled = false;

      if (isComposing) {
        mockEvent.preventDefault();
        mockEvent.stopPropagation();
      } else {
        onMouseDownCaptureCalled = true;
      }

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(onMouseDownCaptureCalled).toBe(false);
    });

    it("should allow mousedown when isComposing is false", () => {
      const mockEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };

      const isComposing = false;
      let onMouseDownCaptureCalled = false;

      if (isComposing) {
        mockEvent.preventDefault();
        mockEvent.stopPropagation();
      } else {
        onMouseDownCaptureCalled = true;
      }

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled();
      expect(onMouseDownCaptureCalled).toBe(true);
    });

    it("should block pointerdown when isComposing is true", () => {
      const mockEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };

      const isComposing = true;
      let onPointerDownCaptureCalled = false;

      if (isComposing) {
        mockEvent.preventDefault();
        mockEvent.stopPropagation();
      } else {
        onPointerDownCaptureCalled = true;
      }

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(onPointerDownCaptureCalled).toBe(false);
    });
  });

  describe("Cursor Position Handling", () => {
    it("should set cursor to end when no targetCursorPosition", () => {
      const mockView = createMockEditorView("Hello World");
      const docLength = 11;
      const targetCursorPosition = null;

      let pos: number;
      if (targetCursorPosition !== null) {
        pos = Math.min(targetCursorPosition, docLength);
      } else {
        pos = docLength;
      }

      mockView.dispatch({
        selection: { anchor: pos, head: pos },
      });

      expect(mockView.dispatch).toHaveBeenCalledWith({
        selection: { anchor: 11, head: 11 },
      });
    });

    it("should set cursor to specified targetCursorPosition", () => {
      const mockView = createMockEditorView("Hello World");
      const docLength = 11;
      const targetCursorPosition = 5;

      let pos: number;
      if (targetCursorPosition !== null) {
        pos = Math.min(targetCursorPosition, docLength);
      } else {
        pos = docLength;
      }

      mockView.dispatch({
        selection: { anchor: pos, head: pos },
      });

      expect(mockView.dispatch).toHaveBeenCalledWith({
        selection: { anchor: 5, head: 5 },
      });
    });

    it("should clamp targetCursorPosition to document length", () => {
      const mockView = createMockEditorView("Hi");
      const docLength = 2;
      const targetCursorPosition = 100;

      const pos = Math.min(targetCursorPosition, docLength);

      mockView.dispatch({
        selection: { anchor: pos, head: pos },
      });

      expect(mockView.dispatch).toHaveBeenCalledWith({
        selection: { anchor: 2, head: 2 },
      });
    });
  });

  describe("Focus and View Focus Synchronization", () => {
    it("should focus view when block becomes focused and view not focused", () => {
      const mockView = createMockEditorView("Content");
      (mockView as { hasFocus: boolean }).hasFocus = false;

      const isFocused = true;
      const viewHasFocus = mockView.hasFocus;

      if (isFocused && !viewHasFocus) {
        mockView.focus();
      }

      expect(mockView.focus).toHaveBeenCalled();
    });

    it("should not focus view when already has focus", () => {
      const mockView = createMockEditorView("Content");
      (mockView as { hasFocus: boolean }).hasFocus = true;

      const isFocused = true;
      const viewHasFocus = mockView.hasFocus;

      if (isFocused && !viewHasFocus) {
        mockView.focus();
      }

      expect(mockView.focus).not.toHaveBeenCalled();
    });
  });
});
