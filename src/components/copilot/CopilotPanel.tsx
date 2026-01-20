import {
  ActionIcon,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Box,
  LoadingOverlay,
  Badge,
  Loader,
  Portal,
} from "@mantine/core";
import {
  IconArrowUp,
  IconX,
  IconTrash,
  IconUser,
  IconRobot,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import { useCopilotUiStore } from "../../stores/copilotUiStore";
import { useAISettingsStore } from "../../stores/aiSettingsStore";
import { createAIProvider } from "../../services/ai/factory";
import { useBlockStore } from "../../stores/blockStore";
import { useBlockUIStore } from "../../stores/blockUIStore";
import { renderMarkdownToHtml } from "../../outliner/markdownRenderer";
import { usePageStore } from "../../stores/pageStore";
import {
  isTypingMention,
  parseMentions,
} from "../../services/ai/mentions/parser";
import {
  MentionAutocomplete,
  type MentionSuggestion,
} from "./MentionAutocomplete";
import { toolRegistry } from "../../services/ai/tools/registry";
import { executeTool } from "../../services/ai/tools/executor";
import { blockTools } from "../../services/ai/tools/block";
import { pageTools } from "../../services/ai/tools/page";
import { contextTools } from "../../services/ai/tools/context";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useToolApprovalStore } from "../../stores/toolApprovalStore";
import { ToolApprovalModal } from "./ToolApprovalModal";

export function CopilotPanel() {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);

  // Store state
  const isOpen = useCopilotUiStore((state) => state.isOpen);
  const close = useCopilotUiStore((state) => state.close);
  const inputValue = useCopilotUiStore((state) => state.inputValue);
  const setInputValue = useCopilotUiStore((state) => state.setInputValue);
  const isLoading = useCopilotUiStore((state) => state.isLoading);
  const setIsLoading = useCopilotUiStore((state) => state.setIsLoading);

  // Chat State
  const chatMessages = useCopilotUiStore((state) => state.chatMessages);
  const addChatMessage = useCopilotUiStore((state) => state.addChatMessage);
  const updateLastChatMessage = useCopilotUiStore(
    (state) => state.updateLastChatMessage
  );
  const clearChatMessages = useCopilotUiStore(
    (state) => state.clearChatMessages
  );

  // Tool Approval State
  const pendingCalls = useToolApprovalStore((state) => state.pendingCalls);
  const approve = useToolApprovalStore((state) => state.approve);
  const deny = useToolApprovalStore((state) => state.deny);

  // Settings
  const { provider, apiKey, baseUrl, model } = useAISettingsStore();

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

  const gatherHints = (): string => {
    const blockStore = useBlockStore.getState();
    const uiStore = useBlockUIStore.getState();
    const pageStore = usePageStore.getState();

    let systemPrompt =
      "You are an AI assistant integrated into 'Oxinot', a block-based outliner app.\n" +
      "CRITICAL RULE: When the user asks to create, write, add, insert, update, or delete content, you MUST use the provided tools to perform the action directly in the document.\n" +
      "DO NOT just generate text in the chat. For example, if the user says 'Write 5 blocks about ABC', you must call 'create_block' tool 5 times.\n" +
      "Context about the current focus and page is provided below.\n" +
      "- If user says 'current block' or 'here', use the focused block ID.\n" +
      "- If user says 'current page', use the current page ID.\n" +
      "- If no parent is specified for creation, use the focused block as parent, or the page root if no focus.\n\n";

    const focusedId = uiStore.focusedBlockId;
    if (focusedId) {
      const block = blockStore.blocksById[focusedId];
      if (block) {
        systemPrompt += `Current focused block content: "${block.content}" (ID: ${focusedId})\n`;
      }
    }

    const pageId = blockStore.currentPageId;
    if (pageId) {
      const pageTitle = pageStore.pagesById[pageId]?.title || "Untitled";
      systemPrompt += `You are currently on page "${pageTitle}" (ID: ${pageId})\n`;
    }

    return systemPrompt;
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const currentInput = inputValue;
    setInputValue("");
    setError(null);
    setIsLoading(true);

    // Track page context before sending
    const pageStore = usePageStore.getState();
    const blockStore = useBlockStore.getState();
    const currentPageId = blockStore.currentPageId;
    if (currentPageId) {
      const pageTitle = pageStore.pagesById[currentPageId]?.title || "Untitled";
      useCopilotUiStore.getState().updatePageContext(currentPageId, pageTitle);
    }

    // Add message to UI
    console.log(
      "[Copilot] Adding message - role: user, content:",
      currentInput.substring(0, 50)
    );
    addChatMessage("user", currentInput);
    console.log(
      "[Copilot] Adding message - role: assistant, content: (empty placeholder)"
    );
    addChatMessage("assistant", "");

    try {
      const aiProvider = createAIProvider(provider, baseUrl);

      const resolvedContext = resolveContextFromMentions(currentInput);
      let systemPrompt = gatherHints();

      const finalPrompt = currentInput;
      if (resolvedContext) {
        systemPrompt += `\n--- Context Resolved from Mentions ---\n${resolvedContext}`;
      }

      const allTools = toolRegistry.getAll();

      // Get fresh history from store state
      const allMessages = useCopilotUiStore.getState().chatMessages;

      // Exclude the last two messages we just added (Current User Prompt + Assistant Placeholder)
      // This ensures 'history' only contains past conversation turns
      const pastMessages = allMessages.slice(0, -2);

      // Filter out system messages (tool logs) and empty messages, then map to AI provider format (without id)
      let historyForAI = pastMessages
        .filter(
          (msg) =>
            (msg.role === "user" || msg.role === "assistant") &&
            msg.content.trim() !== ""
        )
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

      // Limit history to last 20 messages (10 turns) to prevent excessive token usage
      const MAX_HISTORY_MESSAGES = 20;
      if (historyForAI.length > MAX_HISTORY_MESSAGES) {
        historyForAI = historyForAI.slice(-MAX_HISTORY_MESSAGES);
      }

      console.log("[Copilot] All messages:", allMessages.length);
      console.log("[Copilot] Past messages:", pastMessages.length);
      console.log("[Copilot] History for AI:");
      historyForAI.forEach((msg, i) => {
        console.log(`  [${i}] ${msg.role}: ${msg.content}`);
      });
      console.log("[Copilot] System prompt:", systemPrompt);
      console.log("[Copilot] Current prompt:", finalPrompt);

      const stream = aiProvider.generateStream({
        prompt: finalPrompt,
        systemPrompt,
        model,
        apiKey,
        baseUrl,
        history: historyForAI,
        tools: allTools,
        onToolCall: async (toolName, params) => {
          console.log(`AI called tool: ${toolName}`, params);

          const workspacePath = useWorkspaceStore.getState().workspacePath;
          if (!workspacePath) {
            throw new Error("No workspace path available");
          }

          const context = {
            workspacePath,
            currentPageId: useBlockStore.getState().currentPageId || undefined,
            focusedBlockId:
              useBlockUIStore.getState().focusedBlockId || undefined,
            selectedBlockIds: useBlockUIStore.getState().selectedBlockIds,
          };

          const result = await executeTool(toolName, params, context);
          return result;
        },
      });

      let currentSegmentContent = "";
      for await (const chunk of stream) {
        if (chunk.type === "text" && chunk.content) {
          // Check if we need a new bubble (if last message is NOT assistant)
          const messages = useCopilotUiStore.getState().chatMessages;
          const lastMsg = messages[messages.length - 1];

          if (!lastMsg || lastMsg.role !== "assistant") {
            console.log(
              "[Copilot] Adding message - role: assistant, content: (empty placeholder for streaming)"
            );
            addChatMessage("assistant", "");
            currentSegmentContent = ""; // Reset for new bubble
          }

          currentSegmentContent += chunk.content;
          console.log(
            "[Copilot] Updating last assistant message, total length:",
            currentSegmentContent.length
          );
          updateLastChatMessage(currentSegmentContent);

          // Auto-scroll during streaming
          if (scrollViewportRef.current) {
            scrollViewportRef.current.scrollTop =
              scrollViewportRef.current.scrollHeight;
          }
        } else if (chunk.type === "tool_call") {
          console.log("[Copilot] Tool call:", chunk.toolCall?.name);
          console.log("[Copilot] Tool call params:", chunk.toolCall?.arguments);
          const toolMessage = `Calling tool: ${chunk.toolCall?.name}`;
          console.log(
            "[Copilot] Adding message - role: system, content:",
            toolMessage
          );
          addChatMessage("system", toolMessage);
        } else if (chunk.type === "tool_result") {
          console.log("[Copilot] Tool result:", chunk.toolResult);
          console.log(
            "[Copilot] Tool result stringified:",
            JSON.stringify(chunk.toolResult, null, 2)
          );
          // User requested minimal UI, so we don't show the detailed result in chat
          // addChatMessage("system", `Tool result: ${JSON.stringify(chunk.toolResult)}`);
        } else if (chunk.type === "error") {
          console.log("[Copilot] Error:", chunk.error);
          setError(chunk.error || "Unknown error");
          updateLastChatMessage(`Error: ${chunk.error}`);
        }
      }
      console.log("[Copilot] Final response segment:", currentSegmentContent);
    } catch (err: unknown) {
      console.error("AI Generation Error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to generate response";
      setError(errorMessage);
      updateLastChatMessage(`Error: ${errorMessage}`);
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
      }}
    >
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
          padding: "4px 4px",
          borderTop: "1px solid var(--color-border-primary)",
          backgroundColor: "transparent",
        }}
      >
        <Group align="flex-end" gap={12} wrap="nowrap">
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
