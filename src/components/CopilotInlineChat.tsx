import { AgentOrchestrator } from "@/services/ai/agent/orchestrator";
import { createAIProvider } from "@/services/ai/factory";
import { blockTools } from "@/services/ai/tools/block";
import { contextTools } from "@/services/ai/tools/context";
import { pageTools } from "@/services/ai/tools/page";
import { toolRegistry } from "@/services/ai/tools/registry";
import type { AIProvider } from "@/stores/aiSettingsStore";
import { useAISettingsStore } from "@/stores/aiSettingsStore";
import { useBlockStore } from "@/stores/blockStore";
import {
  useCurrentSession,
  useFloatingPanelStore,
} from "@/stores/floatingPanelStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import MarkdownIt from "markdown-it";
import { useCallback, useEffect, useRef, useState } from "react";

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  action: () => void;
}

const SLASH_COMMANDS = [
  { command: "/new", description: "New conversation" },
  { command: "/model", description: "Switch AI model" },
  { command: "/session", description: "Switch session" },
] as const;

async function generateSessionTitle(userMessage: string): Promise<string> {
  const { provider, apiKey, baseUrl, models } = useAISettingsStore.getState();
  const activeModel = models[0] || "";
  if (!apiKey)
    return userMessage.slice(0, 30) + (userMessage.length > 30 ? "..." : "");
  try {
    const aiProvider = createAIProvider(provider as AIProvider, baseUrl || "");
    aiProvider.id = provider;
    const response = await aiProvider.generate({
      prompt: userMessage,
      systemPrompt:
        "Generate a very short title (max 5 words) for this conversation. Only return the title, nothing else.",
      model: activeModel,
      temperature: 0.3,
      apiKey,
      baseUrl,
    });
    return response.trim().slice(0, 50) || "New Chat";
  } catch {
    return userMessage.slice(0, 30) + (userMessage.length > 30 ? "..." : "");
  }
}

export function CopilotInlineChat() {
  const {
    isExecuting,
    setExecuting,
    addUserMessage,
    addAssistantMessage,
    completeAssistantMessage,
    setCurrentStreamingContent,
    currentStreamingContent,
    updateSessionTitle,
    createNewSession,
    switchSession,
    sessions,
  } = useFloatingPanelStore();

  const currentSession = useCurrentSession();
  const messages = currentSession?.messages || [];
  const { models, provider, apiKey, baseUrl, temperature, setModel } =
    useAISettingsStore();
  const activeModel = models[0] || "";
  const workspacePath = useWorkspaceStore((s) => s.workspacePath);

  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [latestResponse, setLatestResponse] = useState<string | null>(null);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const orchestratorRef = useRef<AgentOrchestrator | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const getCommandItems = useCallback((): CommandItem[] => {
    if (!inputValue.startsWith("/")) return [];

    const lowerInput = inputValue.toLowerCase();

    if (lowerInput.startsWith("/model")) {
      if (inputValue === "/model" || inputValue === "/model ") {
        return models.map((model) => ({
          id: model,
          label: model,
          action: () => {
            setModel(model);
            setInputValue("");
          },
        }));
      }
      const search = inputValue.slice(7).toLowerCase();
      return models
        .filter((m) => m.toLowerCase().includes(search))
        .map((model) => ({
          id: model,
          label: model,
          action: () => {
            setModel(model);
            setInputValue("");
          },
        }));
    }

    if (lowerInput.startsWith("/session")) {
      if (inputValue === "/session" || inputValue === "/session ") {
        return sessions
          .slice()
          .reverse()
          .slice(0, 10)
          .map((session) => ({
            id: session.id,
            label: session.title || "Untitled",
            description: new Date(session.updatedAt).toLocaleDateString(),
            action: () => {
              switchSession(session.id);
              setInputValue("");
            },
          }));
      }
      const search = inputValue.slice(9).toLowerCase();
      return sessions
        .filter((s) => (s.title || "Untitled").toLowerCase().includes(search))
        .slice()
        .reverse()
        .slice(0, 10)
        .map((session) => ({
          id: session.id,
          label: session.title || "Untitled",
          description: new Date(session.updatedAt).toLocaleDateString(),
          action: () => {
            switchSession(session.id);
            setInputValue("");
          },
        }));
    }

    return SLASH_COMMANDS.filter((cmd) =>
      cmd.command.toLowerCase().startsWith(lowerInput),
    ).map((cmd) => ({
      id: cmd.command,
      label: cmd.command,
      description: cmd.description,
      action: () => {
        setInputValue(cmd.command + " ");
      },
    }));
  }, [inputValue, models, sessions, setModel, switchSession]);

  const commandItems = getCommandItems();

  useEffect(() => {
    try {
      if (!toolRegistry.has("get_block")) toolRegistry.registerMany(blockTools);
      if (!toolRegistry.has("open_page")) toolRegistry.registerMany(pageTools);
      if (!toolRegistry.has("get_current_context"))
        toolRegistry.registerMany(contextTools);
    } catch (e) {
      console.warn("[CopilotInlineChat] Tools registration error:", e);
    }
  }, []);

  useEffect(() => {
    return () => orchestratorRef.current?.stop();
  }, []);

  useEffect(() => {
    if (!latestResponse) return;
    const timer = setTimeout(() => setLatestResponse(null), 10000);
    return () => clearTimeout(timer);
  }, [latestResponse]);

  useEffect(() => {
    setSelectedCommandIndex(0);
  }, [commandItems.length]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages, currentStreamingContent]);

  const handleSubmit = useCallback(async () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput || isExecuting || !workspacePath) return;

    if (trimmedInput === "/new") {
      createNewSession();
      setInputValue("");
      setLatestResponse(null);
      return;
    }

    const { currentPageId } = useBlockStore.getState();
    const isFirstMessage = messages.length === 0;

    setExecuting(true);
    addUserMessage(trimmedInput);
    const assistantMessageId = addAssistantMessage("", "");
    setInputValue("");

    if (isFirstMessage) {
      generateSessionTitle(trimmedInput).then((title) => {
        const sessionId = useFloatingPanelStore.getState().currentSessionId;
        if (sessionId) {
          updateSessionTitle(sessionId, title);
        }
      });
    }

    try {
      const orchestrator = new AgentOrchestrator(
        createAIProvider(provider as AIProvider, baseUrl || ""),
      );
      orchestratorRef.current = orchestrator;

      const toolContext = {
        workspacePath,
        currentPageId: currentPageId || undefined,
        selectedBlockIds: [],
      };

      let finalContent = "";
      for await (const step of orchestrator.execute(trimmedInput, {
        maxIterations: 10,
        verbose: true,
        context: toolContext,
        apiKey,
        baseUrl,
        model: activeModel,
        temperature,
      })) {
        if (step.type === "tool_call" && step.toolName) {
          setCurrentStreamingContent(`Running ${step.toolName}...`);
        } else if (step.type === "observation" && step.toolResult) {
          setCurrentStreamingContent(
            step.toolResult.success ? "Done" : "Failed",
          );
        } else if (step.type === "final_answer" && step.content) {
          finalContent = step.content;
          setCurrentStreamingContent(finalContent);
        }
      }

      completeAssistantMessage(
        assistantMessageId,
        finalContent || "Task completed",
      );

      if (!showHistory && finalContent) {
        setLatestResponse(finalContent);
      }
    } catch (error) {
      console.error("[CopilotInlineChat] Error:", error);
      completeAssistantMessage(
        assistantMessageId,
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setExecuting(false);
      orchestratorRef.current = null;
    }
  }, [
    inputValue,
    isExecuting,
    workspacePath,
    messages.length,
    setExecuting,
    addUserMessage,
    addAssistantMessage,
    completeAssistantMessage,
    setCurrentStreamingContent,
    updateSessionTitle,
    createNewSession,
    provider,
    baseUrl,
    apiKey,
    activeModel,
    temperature,
    showHistory,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (commandItems.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedCommandIndex((i) =>
          i < commandItems.length - 1 ? i + 1 : 0,
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedCommandIndex((i) =>
          i > 0 ? i - 1 : commandItems.length - 1,
        );
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        commandItems[selectedCommandIndex].action();
        return;
      }
      if (e.key === "Escape") {
        setInputValue("");
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      inputRef.current?.blur();
    }
  };

  return (
    <>
      {/* Inline Input at bottom right */}
      <div
        style={{
          position: "fixed",
          bottom: "var(--spacing-lg)",
          right: "var(--spacing-lg)",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          gap: "var(--spacing-xs)",
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
          }}
        >
          {commandItems.length > 0 && (
            <div
              style={{
                position: "absolute",
                bottom: "100%",
                left: 0,
                marginBottom: "4px",
                backgroundColor: "var(--color-bg-secondary)",
                border: "1px solid var(--color-border-primary)",
                borderRadius: "var(--radius-sm)",
                boxShadow: "var(--shadow-md)",
                minWidth: "160px",
                maxWidth: "280px",
                overflow: "hidden",
                zIndex: 1001,
                fontSize: "var(--font-size-xs)",
              }}
            >
              {commandItems.map((item, index) => (
                <div
                  key={item.id}
                  style={{
                    padding: "4px 8px",
                    cursor: "pointer",
                    backgroundColor:
                      index === selectedCommandIndex
                        ? "var(--color-accent)"
                        : "transparent",
                    color:
                      index === selectedCommandIndex
                        ? "white"
                        : "var(--color-text-primary)",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    justifyContent: "space-between",
                  }}
                  onMouseEnter={() => setSelectedCommandIndex(index)}
                  onClick={() => {
                    item.action();
                    inputRef.current?.focus();
                  }}
                >
                  <span
                    style={{
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.label}
                  </span>
                  {item.description && (
                    <span
                      style={{
                        color:
                          index === selectedCommandIndex
                            ? "rgba(255,255,255,0.7)"
                            : "var(--color-text-tertiary)",
                        flexShrink: 0,
                      }}
                    >
                      {item.description}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setIsFocused(true);
            }}
            onBlur={() => setIsFocused(false)}
            placeholder="Ask Copilot..."
            disabled={isExecuting}
            className="copilot-input"
            style={{
              width: isFocused ? "360px" : "300px",
              padding: "var(--spacing-sm) var(--spacing-md)",
              paddingRight: "80px",
              backgroundColor: "var(--color-bg-secondary)",
              border: `1px solid ${isFocused ? "var(--color-accent)" : "var(--color-border-primary)"}`,
              borderRadius: "24px",
              color: "var(--color-text-primary)",
              fontSize: "var(--font-size-sm)",
              outline: "none",
              transition: "width 0.3s ease, border-color 0.2s ease",
              boxShadow: isFocused
                ? "0 4px 20px rgba(124, 58, 237, 0.2)"
                : "var(--shadow-md)",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: "8px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setShowHistory(!showHistory);
              }}
              title="Toggle chat history"
              style={{
                padding: "6px",
                background: showHistory ? "var(--color-accent)" : "transparent",
                border: "none",
                borderRadius: "50%",
                cursor: "pointer",
                color: showHistory ? "white" : "var(--color-text-tertiary)",
                display: "flex",
                alignItems: "center",
                transition: "all 0.2s ease",
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
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!inputValue.trim() || isExecuting}
              style={{
                padding: "6px 12px",
                background:
                  inputValue.trim() && !isExecuting
                    ? "var(--color-accent)"
                    : "var(--color-bg-tertiary)",
                border: "none",
                borderRadius: "16px",
                cursor:
                  inputValue.trim() && !isExecuting ? "pointer" : "not-allowed",
                color:
                  inputValue.trim() && !isExecuting
                    ? "white"
                    : "var(--color-text-tertiary)",
                fontSize: "var(--font-size-xs)",
                fontWeight: 500,
                transition: "all 0.2s ease",
              }}
            >
              {isExecuting ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ animation: "spin 1s linear infinite" }}
                  aria-label="Loading"
                >
                  <title>Loading</title>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
                "Send"
              )}
            </button>
          </div>
        </div>
      </div>

      {showHistory && (
        <div
          ref={chatContainerRef}
          className="chat-history-container"
          style={{
            position: "fixed",
            right: "var(--spacing-lg)",
            top: "calc(var(--layout-title-bar-height) + var(--spacing-sm))",
            bottom: "calc(var(--spacing-lg) + 60px)",
            width: "340px",
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-sm)",
            zIndex: 50,
            overflowY: "auto",
          }}
        >
          {messages.length === 0 && (
            <div
              style={{
                textAlign: "center",
                color: "var(--color-text-tertiary)",
                fontSize: "var(--font-size-sm)",
                padding: "var(--spacing-md)",
              }}
            >
              No messages yet
            </div>
          )}
          {messages.map((message) => {
            const isStreamingEmpty =
              message.role === "assistant" &&
              message.isStreaming &&
              !message.content;

            return (
              <div
                key={message.id}
                style={{
                  padding: "var(--spacing-sm) var(--spacing-md)",
                  borderRadius: "var(--radius-lg)",
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
                  boxShadow: "var(--shadow-sm)",
                  alignSelf:
                    message.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "90%",
                  animation: isStreamingEmpty
                    ? "pulseGlow 1.5s ease-in-out infinite"
                    : undefined,
                }}
              >
                {isStreamingEmpty ? (
                  <span style={{ opacity: 0.6 }}>Thinking...</span>
                ) : message.role === "assistant" ? (
                  <span
                    dangerouslySetInnerHTML={{
                      __html: md.render(
                        message.isStreaming && currentStreamingContent
                          ? currentStreamingContent
                          : message.content || "",
                      ),
                    }}
                  />
                ) : (
                  message.content
                )}
              </div>
            );
          })}
        </div>
      )}

      {!showHistory && latestResponse && (
        <div
          style={{
            position: "fixed",
            right: "var(--spacing-lg)",
            bottom: "calc(var(--spacing-lg) + 60px)",
            width: "340px",
            maxHeight: "200px",
            overflowY: "auto",
            padding: "var(--spacing-sm) var(--spacing-md)",
            borderRadius: "var(--radius-lg)",
            backgroundColor: "var(--color-bg-secondary)",
            color: "var(--color-text-primary)",
            fontSize: "var(--font-size-sm)",
            lineHeight: 1.5,
            boxShadow: "var(--shadow-md)",
            zIndex: 999,
            animation: "fadeIn 0.3s ease",
          }}
        >
          <span
            dangerouslySetInnerHTML={{
              __html: md.render(latestResponse),
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .chat-history-container {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .chat-history-container::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </>
  );
}
