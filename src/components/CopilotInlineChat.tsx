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
import { showToast } from "@/utils/toast";
import MarkdownIt from "markdown-it";
import { useCallback, useEffect, useRef, useState } from "react";

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

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
  } = useFloatingPanelStore();

  const currentSession = useCurrentSession();
  const messages = currentSession?.messages || [];
  const { models, provider, apiKey, baseUrl, temperature } =
    useAISettingsStore();
  const activeModel = models[0] || "";
  const workspacePath = useWorkspaceStore((s) => s.workspacePath);

  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const orchestratorRef = useRef<AgentOrchestrator | null>(null);

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

  const handleSubmit = useCallback(async () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput || isExecuting || !workspacePath) return;

    const { currentPageId } = useBlockStore.getState();
    const isFirstMessage = messages.length === 0;

    setExecuting(true);
    addUserMessage(trimmedInput);
    addAssistantMessage("", "");
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

      completeAssistantMessage("", finalContent || "Task completed");

      if (!showHistory && finalContent) {
        showToast({
          message:
            finalContent.length > 100
              ? finalContent.slice(0, 100) + "..."
              : finalContent,
          type: "info",
          duration: 4000,
        });
      }
    } catch (error) {
      console.error("[CopilotInlineChat] Error:", error);
      completeAssistantMessage(
        "",
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
    provider,
    baseUrl,
    apiKey,
    activeModel,
    temperature,
    showHistory,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
              width: isFocused ? "400px" : "280px",
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
              onClick={() => setShowHistory(!showHistory)}
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
              {isExecuting ? "..." : "Send"}
            </button>
          </div>
        </div>
      </div>

      {showHistory && (
        <div
          style={{
            position: "fixed",
            right: "var(--spacing-lg)",
            bottom: "calc(var(--spacing-lg) + 60px)",
            width: "340px",
            maxHeight: "400px",
            display: "flex",
            flexDirection: "column-reverse",
            gap: "var(--spacing-sm)",
            zIndex: 999,
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
          {messages.map((message) => (
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
                alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "90%",
              }}
            >
              {message.role === "assistant" ? (
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
          ))}
        </div>
      )}

      {/* Working indicator when panel is closed */}
      {isExecuting && !isFocused && (
        <div
          style={{
            position: "fixed",
            bottom: "calc(var(--spacing-lg) + 50px)",
            right: "var(--spacing-lg)",
            backgroundColor: "var(--color-accent)",
            color: "white",
            padding: "var(--spacing-xs) var(--spacing-md)",
            borderRadius: "var(--radius-lg)",
            fontSize: "var(--font-size-xs)",
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-xs)",
            zIndex: 1000,
            animation: "pulse 1.5s ease-in-out infinite",
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
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="4" fill="currentColor" />
          </svg>
          Copilot is working...
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
