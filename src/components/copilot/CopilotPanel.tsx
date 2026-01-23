import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Loader,
  LoadingOverlay,
  Paper,
  Portal,
  ScrollArea,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import {
  IconArrowUp,
  IconRobot,
  IconTrash,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { renderMarkdownToHtml } from "../../outliner/markdownRenderer";
import { AgentOrchestrator } from "../../services/ai/agent";
import { createAIProvider } from "../../services/ai/factory";
import {
  isTypingMention,
  parseMentions,
} from "../../services/ai/mentions/parser";
import { blockTools } from "../../services/ai/tools/block";
import { contextTools } from "../../services/ai/tools/context";
import { exposeDebugToWindow } from "../../services/ai/tools/debug";
import { initializeToolRegistry } from "../../services/ai/tools/initialization";
import { pageTools } from "../../services/ai/tools/page";
import { toolRegistry } from "../../services/ai/tools/registry";
import { useAgentStore } from "../../stores/agentStore";
import { useAISettingsStore } from "../../stores/aiSettingsStore";
import { useBlockStore } from "../../stores/blockStore";
import { useBlockUIStore } from "../../stores/blockUIStore";
import { useCopilotUiStore } from "../../stores/copilotUiStore";
import { usePageStore } from "../../stores/pageStore";
import { useToolApprovalStore } from "../../stores/toolApprovalStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import {
  MentionAutocomplete,
  type MentionSuggestion,
} from "./MentionAutocomplete";
import { ResizableHandle } from "./ResizableHandle";
import { ToolApprovalModal } from "./ToolApprovalModal";

export function CopilotPanel() {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);

  // Initialize tool registry on first mount
  useEffect(() => {
    console.log(
      "[CopilotPanel] Initializing tool registry and debug utilities",
    );
    initializeToolRegistry();
    exposeDebugToWindow();
    console.log("[CopilotPanel] ✓ Copilot panel initialized");
  }, []);

  const isOpen = useCopilotUiStore((state) => state.isOpen);
  const close = useCopilotUiStore((state) => state.close);
  const inputValue = useCopilotUiStore((state) => state.inputValue);
  const setInputValue = useCopilotUiStore((state) => state.setInputValue);
  const isLoading = useCopilotUiStore((state) => state.isLoading);
  const setIsLoading = useCopilotUiStore((state) => state.setIsLoading);
  const setPanelWidth = useCopilotUiStore((state) => state.setPanelWidth);
  const panelWidth = useCopilotUiStore((state) => state.panelWidth);

  const chatMessages = useCopilotUiStore((state) => state.chatMessages);
  const addChatMessage = useCopilotUiStore((state) => state.addChatMessage);
  const clearChatMessages = useCopilotUiStore(
    (state) => state.clearChatMessages,
  );

  // Tool Approval State
  const pendingCalls = useToolApprovalStore((state) => state.pendingCalls);
  const approve = useToolApprovalStore((state) => state.approve);
  const deny = useToolApprovalStore((state) => state.deny);

  // Settings
  const { provider, baseUrl } = useAISettingsStore();

  // Local state
  const [error, setError] = useState<string | null>(null);

  // Mention Autocomplete State
  const [mentionAutocomplete, setMentionAutocomplete] = useState<{
    show: boolean;
    query: string;
    position: { top: number; left: number };
  } | null>(null);

  // Register tools
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
      console.warn("Tools already registered or error:", e);
    }
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Auto-scroll to bottom
  // biome-ignore lint/correctness/useExhaustiveDependencies: Need full chatMessages to trigger scroll on content updates
  useEffect(() => {
    if (scrollViewportRef.current) {
      scrollViewportRef.current.scrollTop =
        scrollViewportRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const resolveContextFromMentions = (text: string): string => {
    const mentions = parseMentions(text);
    const blockStore = useBlockStore.getState();
    const uiStore = useBlockUIStore.getState();
    const pageStore = usePageStore.getState();

    let contextString = "";
    const processedIds = new Set<string>();

    for (const m of mentions) {
      if (m.type === "current") {
        const focusedId = uiStore.focusedBlockId;
        if (focusedId && !processedIds.has(focusedId)) {
          const block = blockStore.blocksById[focusedId];
          if (block) {
            contextString += `\n[Context: Current Focused Block]\n${block.content}\n`;
            processedIds.add(focusedId);
          }
        }
      } else if (m.type === "selection") {
        const selectedIds = uiStore.selectedBlockIds;
        if (selectedIds.length > 0) {
          contextString += "\n[Context: Selected Blocks]\n";
          for (const id of selectedIds) {
            if (!processedIds.has(id)) {
              const block = blockStore.blocksById[id];
              if (block) {
                contextString += `- ${block.content}\n`;
                processedIds.add(id);
              }
            }
          }
        }
      } else if (m.type === "block" && m.uuid) {
        if (!processedIds.has(m.uuid)) {
          const block = blockStore.blocksById[m.uuid];
          if (block) {
            contextString += `\n[Context: Block ${m.uuid}]\n${block.content}\n`;
            processedIds.add(m.uuid);
          }
        }
      } else if (m.type === "page" && m.uuid) {
        if (!processedIds.has(m.uuid)) {
          const page = pageStore.pagesById[m.uuid];
          if (page) {
            contextString += `\n[Context: Page "${page.title}"]\n(Page ID: ${m.uuid})\n`;
            processedIds.add(m.uuid);
          }
        }
      }
    }

    return contextString;
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const currentInput = inputValue;
    setInputValue("");
    setError(null);
    setIsLoading(true);

    const pageStore = usePageStore.getState();
    const blockStore = useBlockStore.getState();
    const currentPageId = blockStore.currentPageId;
    if (currentPageId) {
      const pageTitle = pageStore.pagesById[currentPageId]?.title || "Untitled";
      useCopilotUiStore.getState().updatePageContext(currentPageId, pageTitle);
    }

    console.log("[Copilot] User message:", currentInput.substring(0, 50));
    addChatMessage("user", currentInput);

    try {
      const aiProvider = createAIProvider(provider, baseUrl);
      aiProvider.id = provider;

      const workspacePath = useWorkspaceStore.getState().workspacePath;
      if (!workspacePath) {
        throw new Error("No workspace path available");
      }

      const context = {
        workspacePath,
        currentPageId: currentPageId || undefined,
        focusedBlockId: useBlockUIStore.getState().focusedBlockId || undefined,
        selectedBlockIds: useBlockUIStore.getState().selectedBlockIds,
      };

      const resolvedContext = resolveContextFromMentions(currentInput);
      let enrichedGoal = currentInput;
      if (resolvedContext) {
        enrichedGoal += `\n\n--- Context from Mentions ---\n${resolvedContext}`;
      }

      const orchestrator = new AgentOrchestrator(aiProvider);

      const agentStore = useAgentStore.getState();
      agentStore.reset();

      for await (const step of orchestrator.execute(enrichedGoal, {
        maxIterations: 10,
        verbose: true,
        context,
      })) {
        console.log("[Copilot Agent] Step:", step.type);

        agentStore.addStep(step);

        if (step.type === "thought") {
          addChatMessage("system", `💭 ${step.thought}`);
        } else if (step.type === "tool_call") {
          addChatMessage("system", `🔧 Using tool: ${step.toolName}`);
        } else if (step.type === "observation") {
          if (step.toolResult?.success) {
            addChatMessage("system", "✅ Tool executed successfully");
          } else {
            addChatMessage(
              "system",
              `❌ Tool failed: ${step.toolResult?.error || "Unknown error"}`,
            );
          }
        } else if (step.type === "final_answer") {
          addChatMessage("assistant", step.content || "");
        }

        if (scrollViewportRef.current) {
          scrollViewportRef.current.scrollTop =
            scrollViewportRef.current.scrollHeight;
        }
      }

      const finalState = orchestrator.getState();
      console.log("[Copilot Agent] Final state:", finalState.status);

      if (finalState.status === "failed") {
        setError(finalState.error || "Agent failed to complete task");
        addChatMessage(
          "system",
          `⚠️ Task incomplete: ${finalState.error || "Unknown error"}`,
        );
      }
    } catch (err: unknown) {
      console.error("AI Generation Error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to generate response";
      setError(errorMessage);
      addChatMessage("assistant", `Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionAutocomplete?.show && e.key === "Enter") {
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);

    const cursorPos = inputRef.current?.selectionStart || value.length;
    const typingMention = isTypingMention(value, cursorPos);

    if (typingMention) {
      const rect = inputRef.current?.getBoundingClientRect();
      if (rect) {
        setMentionAutocomplete({
          show: true,
          query: typingMention.query,
          position: {
            top: rect.top - 200,
            left: rect.left,
          },
        });
      }
    } else {
      setMentionAutocomplete(null);
    }
  };

  const handleMentionSelect = (suggestion: MentionSuggestion) => {
    const cursorPos = inputRef.current?.selectionStart || inputValue.length;
    const beforeCursor = inputValue.slice(0, cursorPos);
    const afterCursor = inputValue.slice(cursorPos);

    const match = beforeCursor.match(/@([\w:]*)$/);
    if (match && match.index !== undefined) {
      const triggerStart = match.index;
      // Use insertText instead of preview/label
      const newBeforeCursor = `${beforeCursor.slice(0, triggerStart)}${
        suggestion.insertText
      } `;
      const newValue = newBeforeCursor + afterCursor;

      setInputValue(newValue);
      setMentionAutocomplete(null);
      inputRef.current?.focus();
    }
  };

  if (!isOpen) return null;

  const handleResize = (deltaX: number) => {
    setPanelWidth(panelWidth + deltaX);
  };

  return (
    <Paper
      shadow="none"
      radius={0}
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid var(--color-border-primary)",
        backgroundColor: "var(--color-bg-primary)",
        position: "relative",
      }}
    >
      <ResizableHandle onResize={handleResize} />
      {/* Mention Autocomplete */}
      {mentionAutocomplete?.show && (
        <Portal>
          <MentionAutocomplete
            query={mentionAutocomplete.query}
            onSelect={handleMentionSelect}
            position={mentionAutocomplete.position}
          />
        </Portal>
      )}

      {/* Tool Approval Modals */}
      {pendingCalls.map((call) => (
        <ToolApprovalModal
          key={call.id}
          toolCall={call}
          onApprove={() => approve(call.id)}
          onDeny={() => deny(call.id)}
        />
      ))}

      {/* Header */}
      <Group
        justify="space-between"
        p="xs"
        style={{ borderBottom: "1px solid var(--color-border-primary)" }}
      >
        <Group gap="xs">
          <Badge
            variant="light"
            color="violet"
            size="lg"
            leftSection={<IconRobot size={12} />}
          >
            Assistant
          </Badge>
          <Text size="xs" c="dimmed">
            Use @ to mention
          </Text>
        </Group>
        <Group gap="xs">
          {chatMessages.length > 0 && (
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={() => clearChatMessages()}
              title="Clear chat"
            >
              <IconTrash size={16} />
            </ActionIcon>
          )}
          <ActionIcon size="sm" variant="subtle" color="gray" onClick={close}>
            <IconX size={16} />
          </ActionIcon>
        </Group>
      </Group>

      {/* Content Area */}
      <Box
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <LoadingOverlay
          visible={isLoading && chatMessages.length === 0}
          zIndex={10}
          overlayProps={{ blur: 1 }}
        />

        {error && (
          <div
            style={{
              padding: "12px",
              backgroundColor: "var(--mantine-color-red-1)",
              color: "var(--mantine-color-red-9)",
            }}
          >
            <Text size="sm">{error}</Text>
          </div>
        )}

        <ScrollArea h="100%" p="md" viewportRef={scrollViewportRef}>
          <Stack gap="md">
            {chatMessages.length === 0 && (
              <Stack
                align="center"
                justify="center"
                h="200px"
                style={{ opacity: 0.5 }}
              >
                <IconRobot size={48} stroke={1.5} />
                <Text size="sm" c="dimmed">
                  How can I help you today?
                </Text>
              </Stack>
            )}
            {chatMessages
              .filter((msg) => msg.content.trim() !== "")
              .map((msg) => {
                if (msg.role === "system") {
                  return (
                    <Group key={msg.id} justify="center" gap="xs">
                      <Badge
                        size="sm"
                        variant="light"
                        color="gray"
                        style={{
                          fontSize: "11px",
                          padding: "4px 8px",
                          opacity: 0.5,
                          fontWeight: 400,
                        }}
                      >
                        {msg.content}
                      </Badge>
                    </Group>
                  );
                }

                return (
                  <Group
                    key={msg.id}
                    align="flex-start"
                    wrap="nowrap"
                    justify={msg.role === "user" ? "flex-end" : "flex-start"}
                  >
                    {msg.role === "assistant" && (
                      <ActionIcon
                        variant="light"
                        color="violet"
                        radius="xl"
                        size="sm"
                        mt={4}
                      >
                        <IconRobot size={14} />
                      </ActionIcon>
                    )}
                    <Paper
                      p="sm"
                      radius="md"
                      bg={
                        msg.role === "user"
                          ? "var(--color-interactive-primary)"
                          : "var(--color-interactive-selected)"
                      }
                      c={
                        msg.role === "user"
                          ? "white"
                          : "var(--color-text-primary)"
                      }
                      style={{
                        maxWidth: "85%",
                        border: "none",
                      }}
                    >
                      <div
                        className="markdown-preview"
                        style={{
                          fontSize: "14px",
                          lineHeight: "1.5",
                          fontStyle: "normal",
                          color: "inherit",
                        }}
                        // biome-ignore lint/security/noDangerouslySetInnerHtml: content is sanitized markdown
                        dangerouslySetInnerHTML={{
                          __html: renderMarkdownToHtml(msg.content, {
                            allowBlocks: true,
                          }),
                        }}
                      />
                    </Paper>
                    {msg.role === "user" && (
                      <ActionIcon
                        variant="filled"
                        color="gray"
                        radius="xl"
                        size="sm"
                        mt={4}
                      >
                        <IconUser size={14} />
                      </ActionIcon>
                    )}
                  </Group>
                );
              })}
            {isLoading &&
              chatMessages[chatMessages.length - 1]?.role === "user" && (
                <Group align="center" gap="xs" ml="xs">
                  <Loader size="xs" type="dots" />
                </Group>
              )}
          </Stack>
        </ScrollArea>
      </Box>

      {/* Footer / Input Area - Zed Style Minimal */}
      <div
        style={{
          padding: "4px 12px 12px",
          borderTop: "1px solid var(--color-border-primary)",
          backgroundColor: "transparent",
        }}
      >
        <Group align="flex-end" gap={16} wrap="nowrap">
          {/* Center: Input */}
          <Textarea
            ref={inputRef}
            placeholder={t("settings.ai.copilot.input.placeholder")}
            value={inputValue}
            onChange={(e) => handleInputChange(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            autosize
            minRows={3}
            maxRows={8}
            style={{
              flex: 1,
              fontSize: "14px",
              background: "transparent",
              border: "none",
              padding: "8px 4px",
              verticalAlign: "top",
              textAlign: "left",
            }}
            disabled={isLoading}
            classNames={{
              input: "copilot-input-minimal",
              wrapper: "copilot-input-wrapper",
            }}
          />

          {/* Right: Send Button */}
          <ActionIcon
            size="sm"
            variant="filled"
            color="violet"
            radius="xl"
            onClick={handleSend}
            loading={isLoading}
            disabled={!inputValue.trim()}
          >
            <IconArrowUp size={14} />
          </ActionIcon>
        </Group>
      </div>
      <style>{`
        .copilot-input-wrapper {
          margin: 0 !important;
          padding: 0 !important;
        }
        .copilot-input-minimal {
          background: transparent !important;
          border: none !important;
          padding: 2px 0 !important;
          color: var(--color-text-primary);
          margin: 0 !important;
          line-height: 1.4 !important;
        }
        .copilot-input-minimal::placeholder {
          color: var(--color-text-tertiary);
          opacity: 0.6;
        }
        .copilot-input-minimal:focus {
          outline: none;
          border: none !important;
          box-shadow: none !important;
        }
      `}</style>
    </Paper>
  );
}
