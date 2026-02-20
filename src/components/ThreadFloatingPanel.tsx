import { AgentOrchestrator } from "@/services/ai/agent/orchestrator";
import { createAIProvider } from "@/services/ai/factory";
import { blockTools } from "@/services/ai/tools/block";
import { contextTools } from "@/services/ai/tools/context";
import { pageTools } from "@/services/ai/tools/page";
import { toolRegistry } from "@/services/ai/tools/registry";
import type { ChatMessage } from "@/services/ai/types";
import type { AIProvider } from "@/stores/aiSettingsStore";
import { useAISettingsStore } from "@/stores/aiSettingsStore";
import { useBlockStore } from "@/stores/blockStore";
import {
  useCurrentSession,
  useFloatingPanelSessions,
  useFloatingPanelStore,
} from "@/stores/floatingPanelStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import MarkdownIt from "markdown-it";
import { memo, useCallback, useEffect, useRef, useState } from "react";

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
});

const PANEL_WIDTH = 380;
const PANEL_HEIGHT = 500;

let messageIdCounter = 0;
const generateId = () => `fp_msg_${Date.now()}_${++messageIdCounter}`;

async function generateSessionTitle(userMessage: string): Promise<string> {
  const { provider, apiKey, baseUrl, models } = useAISettingsStore.getState();
  const activeModel = models[0] || "";

  if (!apiKey) {
    return userMessage.slice(0, 30) + (userMessage.length > 30 ? "..." : "");
  }

  try {
    const aiProvider = createAIProvider(provider as AIProvider, baseUrl || "");
    aiProvider.id = provider;

    const response = await aiProvider.generate({
      prompt: userMessage,
      systemPrompt:
        "Generate a very short title (max 5 words) for this conversation. Only return the title, nothing else. No quotes.",
      model: activeModel,
      temperature: 0.3,
      apiKey,
      baseUrl,
    });

    const title = response.trim().slice(0, 50);
    return title || "New Chat";
  } catch {
    return userMessage.slice(0, 30) + (userMessage.length > 30 ? "..." : "");
  }
}

function SessionList({
  sessions,
  currentSessionId,
  onSelect,
  onDelete,
  onNewSession,
}: {
  sessions: ReturnType<typeof useFloatingPanelSessions>;
  currentSessionId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewSession: () => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,
        backgroundColor: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border-primary)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-lg)",
        maxHeight: "300px",
        overflow: "auto",
        zIndex: 10,
      }}
    >
      <button
        type="button"
        onClick={onNewSession}
        style={{
          width: "100%",
          padding: "var(--spacing-sm) var(--spacing-md)",
          backgroundColor: "transparent",
          border: "none",
          borderBottom: "1px solid var(--color-border-secondary)",
          color: "var(--color-accent)",
          fontSize: "var(--font-size-sm)",
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "var(--spacing-xs)",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        New Chat
      </button>
      {sessions.map((session) => (
        <div
          key={session.id}
          style={{
            display: "flex",
            alignItems: "center",
            backgroundColor:
              session.id === currentSessionId
                ? "var(--color-bg-secondary)"
                : "transparent",
          }}
        >
          <button
            type="button"
            onClick={() => onSelect(session.id)}
            style={{
              flex: 1,
              padding: "var(--spacing-sm) var(--spacing-md)",
              backgroundColor: "transparent",
              border: "none",
              color: "var(--color-text-primary)",
              fontSize: "var(--font-size-sm)",
              textAlign: "left",
              cursor: "pointer",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {session.title}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(session.id);
            }}
            aria-label="Delete session"
            style={{
              padding: "var(--spacing-xs)",
              backgroundColor: "transparent",
              border: "none",
              color: "var(--color-text-tertiary)",
              cursor: "pointer",
              marginRight: "var(--spacing-xs)",
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

function ThreadFloatingPanelInternal() {
  const {
    isOpen,
    openPanel,
    closePanel,
    addUserMessage,
    addAssistantMessage,
    completeAssistantMessage,
    setCurrentStreamingContent,
    currentStreamingContent,
    createNewSession,
    switchSession,
    deleteSession,
    updateSessionTitle,
  } = useFloatingPanelStore();

  const sessions = useFloatingPanelSessions();
  const currentSession = useCurrentSession();
  const messages = currentSession?.messages || [];

  const [inputValue, setInputValue] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [showSessionList, setShowSessionList] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const orchestratorRef = useRef<AgentOrchestrator | null>(null);

  useEffect(() => {
    try {
      if (!toolRegistry.has("get_block")) {
        toolRegistry.registerMany(blockTools);
      }
      if (!toolRegistry.has("open_page")) {
        toolRegistry.registerMany(pageTools);
      }
      if (!toolRegistry.has("get_current_context")) {
        toolRegistry.registerMany(contextTools);
      }
    } catch (e) {
      console.warn("[ThreadFloatingPanel] Tools registration error:", e);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentStreamingContent]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (orchestratorRef.current) {
        orchestratorRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".session-list-container")) {
        setShowSessionList(false);
      }
    };
    if (showSessionList) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSessionList]);

  const handleSubmit = useCallback(async () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput || isExecuting) return;

    const workspacePath = useWorkspaceStore.getState().workspacePath;
    if (!workspacePath) {
      console.error("[ThreadFloatingPanel] No workspace path available");
      return;
    }

    const blockStore = useBlockStore.getState();
    const currentPageId = blockStore.currentPageId || undefined;

    const isFirstMessage = messages.length === 0;

    setInputValue("");
    setIsExecuting(true);

    addUserMessage(trimmedInput);

    if (isFirstMessage) {
      generateSessionTitle(trimmedInput).then((title) => {
        const sessionId = useFloatingPanelStore.getState().currentSessionId;
        if (sessionId) {
          updateSessionTitle(sessionId, title);
        }
      });
    }

    const assistantMessageId = generateId();
    addAssistantMessage(assistantMessageId, "");

    try {
      const { provider, apiKey, baseUrl, temperature, models } =
        useAISettingsStore.getState();
      const activeModel = models[0] || "";

      const aiProvider = createAIProvider(
        provider as AIProvider,
        baseUrl || "",
      );
      aiProvider.id = provider;

      const toolContext = {
        workspacePath,
        currentPageId,
        focusedBlockId: undefined,
        selectedBlockIds: [],
      };

      const history: ChatMessage[] = messages.map((msg) => ({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      }));

      const orchestrator = new AgentOrchestrator(aiProvider);
      orchestratorRef.current = orchestrator;

      let finalContent = "";

      for await (const step of orchestrator.execute(trimmedInput, {
        maxIterations: 8,
        verbose: true,
        context: toolContext,
        apiKey,
        baseUrl,
        model: activeModel,
        temperature,
        history,
      })) {
        if (step.type === "tool_call" && step.toolName) {
          setCurrentStreamingContent(`Running ${step.toolName}...`);
        } else if (step.type === "observation" && step.toolResult) {
          setCurrentStreamingContent(
            step.toolResult.success ? "Completed" : "Failed",
          );
        } else if (step.type === "final_answer" && step.content) {
          finalContent = step.content;
          setCurrentStreamingContent(finalContent);
        }
      }

      const finalState = orchestrator.getState();

      if (finalState.status === "failed") {
        const errorMsg = finalState.error || "Unknown error";
        completeAssistantMessage(assistantMessageId, `Error: ${errorMsg}`);
      } else {
        completeAssistantMessage(assistantMessageId, finalContent);
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Execution failed";
      completeAssistantMessage(assistantMessageId, `Error: ${errorMsg}`);
      console.error("[ThreadFloatingPanel] Execution error:", error);
    } finally {
      orchestratorRef.current = null;
      setIsExecuting(false);
    }
  }, [
    inputValue,
    isExecuting,
    messages.length,
    addUserMessage,
    addAssistantMessage,
    completeAssistantMessage,
    setCurrentStreamingContent,
    updateSessionTitle,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === "Escape") {
        closePanel();
      }
    },
    [handleSubmit, closePanel],
  );

  const handleNewSession = useCallback(() => {
    createNewSession();
    setShowSessionList(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [createNewSession]);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={openPanel}
        aria-label="Open AI panel"
        style={{
          position: "fixed",
          right: "var(--spacing-lg)",
          bottom: "var(--spacing-lg)",
          width: "42px",
          height: "42px",
          backgroundColor: "var(--color-text-primary)",
          border: "none",
          borderRadius: "50%",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "var(--shadow-lg)",
          transition:
            "transform var(--transition-fast), box-shadow var(--transition-fast)",
          zIndex: 1000,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.05)";
          e.currentTarget.style.boxShadow = "var(--shadow-xl)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "var(--shadow-lg)";
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          style={{ color: "var(--color-bg-primary)" }}
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <circle cx="12" cy="12" r="4" fill="currentColor" />
        </svg>
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        right: "var(--spacing-lg)",
        bottom: "var(--spacing-lg)",
        width: `${PANEL_WIDTH}px`,
        height: `${PANEL_HEIGHT}px`,
        backgroundColor: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border-primary)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-xl)",
        display: "flex",
        flexDirection: "column",
        zIndex: 1000,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--spacing-sm) var(--spacing-md)",
          borderBottom: "1px solid var(--color-border-secondary)",
          backgroundColor: "var(--color-bg-tertiary)",
        }}
      >
        <div
          className="session-list-container"
          style={{ position: "relative" }}
        >
          <button
            type="button"
            onClick={() => setShowSessionList(!showSessionList)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-xs)",
              background: "none",
              border: "none",
              padding: "var(--spacing-xs)",
              cursor: "pointer",
              color: "var(--color-text-primary)",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
            <span
              style={{
                fontSize: "var(--font-size-sm)",
                fontWeight: 600,
                maxWidth: "200px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {currentSession?.title || "New Chat"}
            </span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
              style={{
                transform: showSessionList ? "rotate(180deg)" : "none",
                transition: "transform var(--transition-fast)",
              }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {showSessionList && (
            <SessionList
              sessions={sessions}
              currentSessionId={currentSession?.id || null}
              onSelect={(id) => {
                switchSession(id);
                setShowSessionList(false);
              }}
              onDelete={deleteSession}
              onNewSession={handleNewSession}
            />
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-xs)",
          }}
        >
          <button
            type="button"
            onClick={handleNewSession}
            aria-label="New chat"
            style={{
              background: "none",
              border: "none",
              padding: "var(--spacing-xs)",
              cursor: "pointer",
              color: "var(--color-text-tertiary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "var(--radius-sm)",
              transition: "color var(--transition-fast)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--color-text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--color-text-tertiary)";
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button
            type="button"
            onClick={closePanel}
            aria-label="Close panel"
            style={{
              background: "none",
              border: "none",
              padding: "var(--spacing-xs)",
              cursor: "pointer",
              color: "var(--color-text-tertiary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "var(--radius-sm)",
              transition: "color var(--transition-fast)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--color-text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--color-text-tertiary)";
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "var(--spacing-md)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-md)",
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              textAlign: "center",
              color: "var(--color-text-tertiary)",
              fontSize: "var(--font-size-sm)",
              padding: "var(--spacing-xl) var(--spacing-md)",
            }}
          >
            Ask anything about your notes.
            <br />
            Responses will be added to the current page.
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--spacing-xs)",
            }}
          >
            <div
              style={{
                fontSize: "var(--font-size-xs)",
                color: "var(--color-text-tertiary)",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {message.role === "user" ? "You" : "AI"}
            </div>
            <div
              style={{
                padding: "var(--spacing-sm) var(--spacing-md)",
                borderRadius: "var(--radius-md)",
                backgroundColor:
                  message.role === "user"
                    ? "var(--color-accent)"
                    : "var(--color-bg-secondary)",
                color:
                  message.role === "user"
                    ? "white"
                    : "var(--color-text-primary)",
                fontSize: "var(--font-size-sm)",
                lineHeight: 1.5,
                alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "90%",
                wordBreak: "break-word",
              }}
            >
              {message.role === "assistant" ? (
                <span
                  dangerouslySetInnerHTML={{
                    __html: md.render(
                      message.isStreaming && currentStreamingContent
                        ? currentStreamingContent
                        : message.content ||
                            (message.isStreaming ? "Thinking..." : ""),
                    ),
                  }}
                />
              ) : (
                <span
                  dangerouslySetInnerHTML={{
                    __html: md.render(message.content),
                  }}
                />
              )}
              {message.role === "assistant" && message.isStreaming && (
                <span
                  style={{
                    display: "inline-block",
                    width: "6px",
                    height: "6px",
                    backgroundColor: "var(--color-accent)",
                    borderRadius: "50%",
                    marginLeft: "var(--spacing-xs)",
                    animation: "pulse 1s ease-in-out infinite",
                  }}
                />
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: "var(--spacing-sm) var(--spacing-md)",
          borderTop: "1px solid var(--color-border-secondary)",
          backgroundColor: "var(--color-bg-tertiary)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "var(--spacing-sm)",
            alignItems: "center",
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your notes..."
            disabled={isExecuting}
            style={{
              flex: 1,
              padding: "var(--spacing-sm) var(--spacing-md)",
              backgroundColor: "var(--color-bg-primary)",
              border: "1px solid var(--color-border-secondary)",
              borderRadius: "var(--radius-md)",
              color: "var(--color-text-primary)",
              fontSize: "var(--font-size-sm)",
              outline: "none",
              transition: "border-color var(--transition-fast)",
            }}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!inputValue.trim() || isExecuting}
            aria-label="Send message"
            style={{
              padding: "var(--spacing-sm)",
              backgroundColor:
                inputValue.trim() && !isExecuting
                  ? "var(--color-accent)"
                  : "var(--color-bg-tertiary)",
              border: "none",
              borderRadius: "var(--radius-md)",
              cursor:
                inputValue.trim() && !isExecuting ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background-color var(--transition-fast)",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              stroke={
                inputValue.trim() && !isExecuting
                  ? "white"
                  : "var(--color-text-tertiary)"
              }
              strokeWidth="2"
            >
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Add pulse animation */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}
      </style>
    </div>
  );
}

export const ThreadFloatingPanel = memo(ThreadFloatingPanelInternal);
