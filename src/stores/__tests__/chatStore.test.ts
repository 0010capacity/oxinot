import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChatStore } from "../chatStore";

vi.mock("@tauri-apps/api/path", () => ({
  appDataDir: vi.fn().mockResolvedValue("/mock/app-data/"),
  join: vi
    .fn()
    .mockImplementation((...args: string[]) => Promise.resolve(args.join("/"))),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(""),
}));

describe("chatStore", () => {
  beforeEach(() => {
    useChatStore.setState({
      sessions: {},
      sessionOrder: [],
      messagesBySession: {},
      streamingBySession: {},
      isOpen: false,
      activeSessionId: null,
      panelRect: { width: 420, height: 560, x: 0, y: 0 },
    });
  });

  describe("panel state", () => {
    it("should open panel", () => {
      const { openPanel } = useChatStore.getState();
      openPanel();
      expect(useChatStore.getState().isOpen).toBe(true);
    });

    it("should close panel", () => {
      const { openPanel, closePanel } = useChatStore.getState();
      openPanel();
      closePanel();
      expect(useChatStore.getState().isOpen).toBe(false);
    });

    it("should toggle panel", () => {
      const { togglePanel } = useChatStore.getState();
      expect(useChatStore.getState().isOpen).toBe(false);
      togglePanel();
      expect(useChatStore.getState().isOpen).toBe(true);
      togglePanel();
      expect(useChatStore.getState().isOpen).toBe(false);
    });
  });

  describe("session management", () => {
    it("should create a new session", () => {
      const { createSession } = useChatStore.getState();
      const sessionId = createSession();

      expect(sessionId).toBeDefined();
      expect(useChatStore.getState().sessions[sessionId]).toBeDefined();
      expect(useChatStore.getState().activeSessionId).toBe(sessionId);
      expect(useChatStore.getState().sessionOrder).toContain(sessionId);
    });

    it("should delete a session", () => {
      const { createSession, deleteSession } = useChatStore.getState();
      const sessionId = createSession();

      deleteSession(sessionId);

      expect(useChatStore.getState().sessions[sessionId]).toBeUndefined();
      expect(useChatStore.getState().sessionOrder).not.toContain(sessionId);
    });

    it("should switch active session", () => {
      const { createSession, switchSession } = useChatStore.getState();
      const session1 = createSession();
      const session2 = createSession();

      expect(useChatStore.getState().activeSessionId).toBe(session2);

      switchSession(session1);
      expect(useChatStore.getState().activeSessionId).toBe(session1);
    });

    it("should limit sessions to max 10", () => {
      const { createSession } = useChatStore.getState();
      const sessionIds: string[] = [];

      for (let i = 0; i < 15; i++) {
        sessionIds.push(createSession());
      }

      expect(useChatStore.getState().sessionOrder.length).toBe(10);
      expect(useChatStore.getState().sessions[sessionIds[0]]).toBeUndefined();
      expect(useChatStore.getState().sessions[sessionIds[14]]).toBeDefined();
    });
  });

  describe("message management", () => {
    it("should add a message to session", () => {
      const { createSession, addMessage } = useChatStore.getState();
      const sessionId = createSession();

      const messageId = addMessage(sessionId, {
        role: "user",
        content: "Hello",
      });

      expect(messageId).toBeDefined();
      const messages = useChatStore.getState().messagesBySession[sessionId];
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("user");
      expect(messages[0].content).toBe("Hello");
    });

    it("should update message content", () => {
      const { createSession, addMessage, updateMessage } =
        useChatStore.getState();
      const sessionId = createSession();
      const messageId = addMessage(sessionId, {
        role: "assistant",
        content: "Initial",
      });

      updateMessage(sessionId, messageId, "Updated");

      const messages = useChatStore.getState().messagesBySession[sessionId];
      expect(messages[0].content).toBe("Updated");
    });
  });

  describe("streaming state", () => {
    it("should start streaming", () => {
      const { createSession, startStreaming } = useChatStore.getState();
      const sessionId = createSession();

      startStreaming(sessionId, "run-123");

      const streaming = useChatStore.getState().streamingBySession[sessionId];
      expect(streaming.status).toBe("running");
      expect(streaming.runId).toBe("run-123");
    });

    it("should append stream content", () => {
      const { createSession, startStreaming, appendStreamContent } =
        useChatStore.getState();
      const sessionId = createSession();
      startStreaming(sessionId, "run-123");

      appendStreamContent(sessionId, "Hello ");
      appendStreamContent(sessionId, "World");

      const streaming = useChatStore.getState().streamingBySession[sessionId];
      expect(streaming.partialContent).toBe("Hello World");
    });

    it("should finish streaming and create message", () => {
      const {
        createSession,
        startStreaming,
        appendStreamContent,
        finishStreaming,
      } = useChatStore.getState();
      const sessionId = createSession();
      startStreaming(sessionId, "run-123");
      appendStreamContent(sessionId, "Final answer");

      finishStreaming(sessionId);

      const streaming = useChatStore.getState().streamingBySession[sessionId];
      expect(streaming.status).toBe("idle");

      const messages = useChatStore.getState().messagesBySession[sessionId];
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("assistant");
      expect(messages[0].content).toBe("Final answer");
    });

    it("should fail streaming with error", () => {
      const { createSession, startStreaming, failStreaming } =
        useChatStore.getState();
      const sessionId = createSession();
      startStreaming(sessionId, "run-123");

      failStreaming(sessionId, "Something went wrong");

      const streaming = useChatStore.getState().streamingBySession[sessionId];
      expect(streaming.status).toBe("error");
      expect(streaming.error).toBe("Something went wrong");
    });
  });

  describe("session title", () => {
    it("should update session title", () => {
      const { createSession, updateSessionTitle } = useChatStore.getState();
      const sessionId = createSession();

      updateSessionTitle(sessionId, "New Title");

      expect(useChatStore.getState().sessions[sessionId].title).toBe(
        "New Title",
      );
    });
  });
});
