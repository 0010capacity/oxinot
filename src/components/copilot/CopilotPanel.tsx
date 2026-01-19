import {
  ActionIcon,
  Button,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Menu,
  Box,
  LoadingOverlay,
  Badge,
  Loader,
  Portal,
} from "@mantine/core";
import {
  IconArrowUp,
  IconTemplate,
  IconX,
  IconMaximize,
  IconMinimize,
  IconReplace,
  IconDownload,
  IconTrash,
  IconUser,
  IconRobot,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import {
  useCopilotUiStore,
} from "../../stores/copilotUiStore";
import { useAISettingsStore } from "../../stores/aiSettingsStore";
import { createAIProvider } from "../../services/ai/factory";
import { useBlockStore } from "../../stores/blockStore";
import { useBlockUIStore } from "../../stores/blockUIStore";
import { renderMarkdownToHtml } from "../../outliner/markdownRenderer";
import { usePageStore } from "../../stores/pageStore";
import { isTypingMention, parseMentions } from "../../services/ai/mentions/parser";
import { MentionAutocomplete, type MentionSuggestion } from "./MentionAutocomplete";
import { toolRegistry } from "../../services/ai/tools/registry";
import { executeTool } from "../../services/ai/tools/executor";
import { blockTools } from "../../services/ai/tools/block";
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
  const pendingCalls = useToolApprovalStore(state => state.pendingCalls);
  const approve = useToolApprovalStore(state => state.approve);
  const deny = useToolApprovalStore(state => state.deny);

  // Settings
  const { provider, apiKey, baseUrl, model, promptTemplates } =
    useAISettingsStore();

  // Local state
  const [isExpanded, setIsExpanded] = useState(false);
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
      if (m.type === 'current') {
        const focusedId = uiStore.focusedBlockId;
        if (focusedId && !processedIds.has(focusedId)) {
          const block = blockStore.blocksById[focusedId];
          if (block) {
            contextString += `\n[Context: Current Focused Block]\n${block.content}\n`;
            processedIds.add(focusedId);
          }
        }
      } else if (m.type === 'selection') {
        const selectedIds = uiStore.selectedBlockIds;
        if (selectedIds.length > 0) {
          contextString += `\n[Context: Selected Blocks]\n`;
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
      } else if (m.type === 'block' && m.uuid) {
        if (!processedIds.has(m.uuid)) {
          const block = blockStore.blocksById[m.uuid];
          if (block) {
            contextString += `\n[Context: Block ${m.uuid}]\n${block.content}\n`;
            processedIds.add(m.uuid);
          }
        }
      } else if (m.type === 'page' && m.uuid) {
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

  const gatherHints = (): { hint: string; systemPrompt?: string } => {
    const blockStore = useBlockStore.getState();
    const uiStore = useBlockUIStore.getState();
    const pageStore = usePageStore.getState();

    let hint = "";
    const systemPrompt =
      "You are an AI assistant integrated into 'Oxinot', a block-based outliner app.\n" +
      "CRITICAL RULE: When the user asks to create, write, add, insert, update, or delete content, you MUST use the provided tools to perform the action directly in the document.\n" +
      "DO NOT just generate text in the chat. For example, if the user says 'Write 5 blocks about ABC', you must call 'create_block' tool 5 times.\n" +
      "Context about the current focus and page is provided below.\n" +
      "- If user says 'current block' or 'here', use the focused block ID.\n" +
      "- If user says 'current page', use the current page ID.\n" +
      "- If no parent is specified for creation, use the focused block as parent, or the page root if no focus.";

    const focusedId = uiStore.focusedBlockId;
    if (focusedId) {
      const block = blockStore.blocksById[focusedId];
      if (block) {
        hint = `Current focused block content: "${block.content}" (ID: ${focusedId})`;
      }
    }

    const pageId = blockStore.currentPageId;
    if (pageId) {
      const pageTitle = pageStore.pagesById[pageId]?.title || "Untitled";
      hint += `\nYou are currently on page "${pageTitle}" (ID: ${pageId})`;
    }

    return { hint, systemPrompt };
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const currentInput = inputValue;
    setInputValue("");
    setError(null);
    setIsLoading(true);

    // Add message to UI
    addChatMessage("user", currentInput);
    addChatMessage("assistant", ""); 

    try {
      const aiProvider = createAIProvider(provider, baseUrl);
      
      const resolvedContext = resolveContextFromMentions(currentInput);
      const { hint, systemPrompt } = gatherHints();
      
      let finalPrompt = currentInput;
      if (resolvedContext) {
        finalPrompt = `User Request: ${currentInput}\n\n--- Context Resolved from Mentions ---\n${resolvedContext}`;
      } else if (hint) {
        finalPrompt = `${hint}\n\nUser Request: ${currentInput}`;
      }

      const allTools = toolRegistry.getAll();

      const stream = aiProvider.generateStream({
        prompt: finalPrompt,
        systemPrompt,
        model,
        apiKey,
        baseUrl,
        history: chatMessages, // Pass previous history (excluding currently added ones due to closure)
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
            focusedBlockId: useBlockUIStore.getState().focusedBlockId || undefined,
            selectedBlockIds: useBlockUIStore.getState().selectedBlockIds,
          };

          const result = await executeTool(toolName, params, context);
          return result;
        },
      });

      let fullContent = "";
      for await (const chunk of stream) {
        if (chunk.type === "text" && chunk.content) {
          fullContent += chunk.content;
          updateLastChatMessage(fullContent);
        } else if (chunk.type === "tool_call") {
           addChatMessage("system", `Calling tool: ${chunk.toolCall?.name}`);
        } else if (chunk.type === "tool_result") {
           addChatMessage("system", `Tool result: ${JSON.stringify(chunk.toolResult)}`);
        } else if (chunk.type === "error") {
           setError(chunk.error || "Unknown error");
           updateLastChatMessage(`Error: ${chunk.error}`);
        }
      }
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
    if (mentionAutocomplete?.show && e.key === 'Enter') {
      return;
    }
    
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleApplyLastResponse = async () => {
    const uiStore = useBlockUIStore.getState();
    const blockStore = useBlockStore.getState();
    const focusedId = uiStore.focusedBlockId;

    const contentToApply = chatMessages[chatMessages.length - 1]?.content;

    if (!focusedId || !contentToApply) return;

    try {
      await blockStore.updateBlockContent(focusedId, contentToApply);
    } catch (e) {
      console.error("Failed to apply changes:", e);
      setError("Failed to apply changes");
    }
  };

  const handleInsertBelow = async () => {
    const uiStore = useBlockUIStore.getState();
    const blockStore = useBlockStore.getState();
    const focusedId = uiStore.focusedBlockId;

    const contentToApply = chatMessages[chatMessages.length - 1]?.content;

    if (!focusedId || !contentToApply) return;

    try {
      await blockStore.createBlock(focusedId, contentToApply);
    } catch (e) {
      console.error("Failed to insert block:", e);
      setError("Failed to insert block");
    }
  };

  const handleTemplateSelect = (content: string) => {
    setInputValue(content);
    if (inputRef.current) {
      inputRef.current.focus();
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
    if (match) {
        const triggerStart = match.index!;
        // Use insertText instead of preview/label
        const newBeforeCursor = beforeCursor.slice(0, triggerStart) + suggestion.insertText + ' ';
        const newValue = newBeforeCursor + afterCursor;
        
        setInputValue(newValue);
        setMentionAutocomplete(null);
        inputRef.current?.focus();
    }
  };

  if (!isOpen) return null;

  return (
    <Paper
      shadow="xl"
      radius="md"
      style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: "800px",
        height: isExpanded ? "80vh" : "500px",
        zIndex: 140,
        display: "flex",
        flexDirection: "column",
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        border: "1px solid var(--color-border-primary)",
        backgroundColor: "var(--color-bg-primary)",
        transition: "height 0.3s ease",
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
      {pendingCalls.map(call => (
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
            Use @ to mention blocks or pages
          </Text>
        </Group>
        <Group gap="xs">
          <ActionIcon
            size="sm"
            variant="subtle"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <IconMinimize size={16} />
            ) : (
              <IconMaximize size={16} />
            )}
          </ActionIcon>
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
            {chatMessages.map((msg) => (
              <Group
                key={msg.id}
                align="flex-start"
                wrap="nowrap"
                justify={
                  msg.role === "user"
                    ? "flex-end"
                    : msg.role === "system"
                      ? "center"
                      : "flex-start"
                }
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
                {msg.role === "system" && (
                  <Badge variant="outline" color="gray" size="xs" mt={8}>
                    System
                  </Badge>
                )}
                <Paper
                  p="sm"
                  radius="md"
                  bg={
                    msg.role === "user"
                      ? "var(--color-interactive-primary)"
                      : msg.role === "system"
                        ? "transparent"
                        : "var(--color-bg-secondary)"
                  }
                  c={
                    msg.role === "user"
                      ? "white"
                      : "var(--color-text-primary)"
                  }
                  style={{
                    maxWidth: "85%",
                    border:
                      msg.role === "system"
                        ? "1px dashed var(--color-border-primary)"
                        : "none",
                  }}
                >
                  <div
                    className="markdown-preview"
                    style={{
                      fontSize: msg.role === "system" ? "12px" : "14px",
                      lineHeight: "1.5",
                      fontStyle:
                        msg.role === "system" ? "italic" : "normal",
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
            ))}
            {isLoading &&
              chatMessages[chatMessages.length - 1]?.role === "user" && (
                <Group align="center" gap="xs" ml="xs">
                  <Loader size="xs" type="dots" />
                </Group>
              )}
          </Stack>
        </ScrollArea>
      </Box>

      {/* Footer / Input Area */}
      <div
        style={{
          padding: "12px",
          borderTop: "1px solid var(--color-border-primary)",
          backgroundColor: "var(--color-bg-secondary)",
        }}
      >
        <Stack gap="xs">
          <Group align="flex-end" gap="xs">
            <Menu shadow="md" width={200} position="bottom-start">
              <Menu.Target>
                <ActionIcon variant="light" size="lg" radius="md" mb={4}>
                  <IconTemplate size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{t("settings.ai.templates")}</Menu.Label>
                {promptTemplates.length > 0 ? (
                  promptTemplates.map((t) => (
                    <Menu.Item
                      key={t.id}
                      onClick={() => handleTemplateSelect(t.content)}
                    >
                      {t.name}
                    </Menu.Item>
                  ))
                ) : (
                  <Menu.Item disabled>No templates</Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>

            <Textarea
              ref={inputRef}
              placeholder={t("settings.ai.copilot.placeholder")}
              value={inputValue}
              onChange={(e) => handleInputChange(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              autosize
              minRows={1}
              maxRows={5}
              style={{ flex: 1 }}
              disabled={isLoading}
            />

            <Button
              size="md"
              variant="filled"
              color="violet"
              onClick={handleSend}
              loading={isLoading}
              disabled={!inputValue.trim()}
              mb={4}
            >
              <IconArrowUp size={18} />
            </Button>
          </Group>

          {chatMessages.length > 0 && !isLoading && (
            <Group justify="flex-end" pt="xs">
              <Button
                variant="subtle"
                size="xs"
                color="gray"
                leftSection={<IconTrash size={14} />}
                onClick={() => clearChatMessages()}
              >
                Clear Chat
              </Button>
              <Button
                variant="light"
                size="xs"
                color="teal"
                leftSection={<IconDownload size={14} />}
                onClick={handleInsertBelow}
              >
                Insert Last Below
              </Button>
              <Button
                variant="filled"
                size="xs"
                color="violet"
                leftSection={<IconReplace size={14} />}
                onClick={handleApplyLastResponse}
              >
                Apply Last
              </Button>
            </Group>
          )}
        </Stack>
      </div>
    </Paper>
  );
}