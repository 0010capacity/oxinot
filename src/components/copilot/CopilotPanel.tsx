import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  LoadingOverlay,
  Menu,
  Paper,
  Portal,
  ScrollArea,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";

import {
  IconArrowUp,
  IconChevronDown,
  IconDeviceDesktop,
  IconPlayerStop,
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
import { classifyIntent } from "../../services/ai/utils/intentClassifier";
import { selectToolsByIntent } from "../../services/ai/utils/toolSelector";
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

// Provider icons mapping
const PROVIDER_ICONS: Record<string, React.ReactNode> = {
  google: <IconDeviceDesktop size={16} />,
  openai: <IconDeviceDesktop size={16} />,
  claude: <IconDeviceDesktop size={16} />,
  ollama: <IconDeviceDesktop size={16} />,
  lmstudio: <IconDeviceDesktop size={16} />,
  custom: <IconDeviceDesktop size={16} />,
  zai: <IconDeviceDesktop size={16} />,
  "zai-coding-plan": <IconDeviceDesktop size={16} />,
};

interface ModelSelectorDropdownProps {
  currentProvider: string;
  currentModel: string;
  allConfigs: Record<string, { models: string[]; apiKey: string }>;
  onProviderChange: (provider: string) => void;
  onModelChange: (provider: string, model: string) => void;
  disabled?: boolean;
}

function ModelSelectorDropdown({
  currentProvider,
  currentModel,
  allConfigs,
  onProviderChange,
  onModelChange,
  disabled = false,
}: ModelSelectorDropdownProps) {
  return (
    <Menu position="top-end" withinPortal disabled={disabled}>
      <Menu.Target>
        <Button
          variant="subtle"
          size="xs"
          radius="xl"
          title={`Model: ${currentProvider}/${currentModel}`}
          disabled={disabled}
          px={10}
          py={4}
          style={{
            minWidth: "110px",
            height: "28px",
          }}
        >
          <Group gap={4} wrap="nowrap">
            <Text
              size="xs"
              style={{ textOverflow: "ellipsis", overflow: "hidden" }}
            >
              {currentModel}
            </Text>
            <IconChevronDown size={12} />
          </Group>
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        {Object.entries(allConfigs)
          .filter(([_, config]) => config?.apiKey && config?.models?.length > 0)
          .map(([provider, config]) => (
            <div key={provider}>
              <Menu.Label>
                <Group gap={6} wrap="nowrap">
                  {PROVIDER_ICONS[provider]}
                  <span>{provider}</span>
                </Group>
              </Menu.Label>
              {(config?.models || []).map((model) => (
                <Menu.Item
                  key={model}
                  onClick={() => {
                    onProviderChange(provider);
                    onModelChange(provider, model);
                  }}
                  style={{
                    fontWeight:
                      provider === currentProvider && model === currentModel
                        ? 600
                        : 400,
                  }}
                >
                  {model}
                </Menu.Item>
              ))}
              {provider !==
                Object.entries(allConfigs)
                  .filter(
                    ([_, config]) =>
                      config?.apiKey && config?.models?.length > 0,
                  )
                  .map(([p]) => p)
                  .pop() && <Menu.Divider />}
            </div>
          ))}
      </Menu.Dropdown>
    </Menu>
  );
}

export function CopilotPanel() {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const orchestratorRef = useRef<AgentOrchestrator | null>(null);

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
  const currentStep = useCopilotUiStore((state) => state.currentStep);
  const currentToolName = useCopilotUiStore((state) => state.currentToolName);
  const setCurrentStep = useCopilotUiStore((state) => state.setCurrentStep);
  const toggle = useCopilotUiStore((state) => state.toggle);

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
  const { provider, baseUrl, apiKey, models, temperature, configs } =
    useAISettingsStore();

  // Use first model from the list as active model
  const activeModel = models[0] || "";

  // Handler for changing provider
  const handleProviderChange = (newProvider: string) => {
    useAISettingsStore
      .getState()
      .setProvider(
        newProvider as
          | "google"
          | "openai"
          | "claude"
          | "ollama"
          | "lmstudio"
          | "custom",
      );
  };

  // Handler for changing model
  const handleModelChange = (newProvider: string, newModel: string) => {
    // First switch provider if different
    if (newProvider !== provider) {
      handleProviderChange(newProvider);
    }
    // Then set the model
    useAISettingsStore.getState().setModel(newModel);
  };

  // Local state
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
      // Classify user intent first
      const classificationResult = classifyIntent(currentInput);
      const intent = classificationResult.intent;
      console.log(
        "[Copilot] Intent classified:",
        intent,
        `(confidence: ${(classificationResult.confidence * 100).toFixed(0)}%)`,
      );

      // Always use orchestrator - intent classification only for tool selection
      const aiProvider = createAIProvider(provider, baseUrl);
      aiProvider.id = provider;

      const workspacePath = useWorkspaceStore.getState().workspacePath;
      if (!workspacePath) {
        throw new Error("No workspace path available");
      }

      console.log("[Copilot] AI Config:", {
        provider,
        baseUrl,
        hasApiKey: !!apiKey,
        apiKeyLength: apiKey?.length || 0,
        activeModel,
      });

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

      // Select tools based on classified intent
      const selectedTools = selectToolsByIntent(intent);
      console.log("[Copilot] Selected tools for intent:", {
        intent,
        toolCount: selectedTools.length,
        toolNames: selectedTools.map((t) => t.name),
      });

      console.log("[Copilot] Passing to orchestrator:", {
        enrichedGoal: enrichedGoal.substring(0, 100),
        hasApiKey: !!apiKey,
        hasBaseUrl: !!baseUrl,
        hasModel: !!activeModel,
        selectedToolCount: selectedTools.length,
      });

      const orchestrator = new AgentOrchestrator(aiProvider);
      orchestratorRef.current = orchestrator;

      const agentStore = useAgentStore.getState();
      agentStore.reset();

      for await (const step of orchestrator.execute(enrichedGoal, {
        maxIterations: 50,
        verbose: true,
        context,
        apiKey,
        baseUrl,
        model: activeModel,
        temperature,
      })) {
        console.log("[Copilot Agent] Step:", step.type);

        agentStore.addStep(step);

        if (step.type === "thought") {
          // No notification - keep it clean
        } else if (step.type === "tool_call") {
          // No notification - keep it clean
        } else if (step.type === "observation") {
          // No notification - keep it clean
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
        addChatMessage(
          "assistant",
          `Error: ${finalState.error || "Unknown error"}`,
        );
      }
    } catch (err: unknown) {
      console.error("AI Generation Error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to generate response";
      addChatMessage("assistant", `Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setCurrentStep(null);
      orchestratorRef.current = null;
    }
  };

  const handleStop = () => {
    if (orchestratorRef.current) {
      orchestratorRef.current.stop();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionAutocomplete?.show && e.key === "Enter") {
      return;
    }

    // Cmd/Ctrl + Enter to send message
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      // Stop current execution if running, then send
      if (isLoading && orchestratorRef.current) {
        orchestratorRef.current.stop();
      }
      handleSend();
      return;
    }

    // Enter to send (without Shift for newline)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Stop current execution if running, then send
      if (isLoading && orchestratorRef.current) {
        orchestratorRef.current.stop();
      }
      handleSend();
    }

    // Escape to stop or close panel
    if (e.key === "Escape") {
      if (isLoading && orchestratorRef.current) {
        handleStop();
      } else {
        close();
      }
    }
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Shift + K to toggle panel
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "k") {
        e.preventDefault();
        toggle();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [toggle]);

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
      <Group justify="flex-end" p="xs">
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

        {/* Progress Indicator */}
        {isLoading && chatMessages.length > 0 && (
          <Group
            align="center"
            gap="xs"
            p="xs"
            style={{
              borderBottom: "1px solid var(--color-border)",
              backgroundColor: "var(--color-bg-secondary)",
            }}
          >
            <Loader size="xs" type="dots" color="var(--color-text-tertiary)" />
            <Text size="xs" c="dimmed">
              {currentStep === "thinking" && "Analyzing..."}
              {currentStep === "tool_call" &&
                `Running ${currentToolName || "tool"}...`}
              {currentStep === "observation" && "Processing..."}
              {currentStep === "final" && "Generating..."}
            </Text>
          </Group>
        )}

        <ScrollArea h="100%" p="md" viewportRef={scrollViewportRef}>
          <Stack gap="md">
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
                    <Paper
                      p="sm"
                      radius="md"
                      bg={
                        msg.role === "user"
                          ? "var(--color-interactive-primary)"
                          : "transparent"
                      }
                      c={
                        msg.role === "user"
                          ? "white"
                          : "var(--color-text-primary)"
                      }
                      style={{
                        maxWidth: "85%",
                        border:
                          msg.role === "user"
                            ? "none"
                            : "1px solid var(--color-border-primary)",
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
          padding: "4px 12px 8px",
          borderTop: "1px solid var(--color-border-primary)",
          backgroundColor: "transparent",
        }}
      >
        <Stack gap={2}>
          {/* Top: Input */}
          <Textarea
            ref={inputRef}
            placeholder={t("settings.ai.copilot.input.placeholder")}
            value={inputValue}
            onChange={(e) => handleInputChange(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            autosize
            minRows={4}
            maxRows={10}
            style={{
              fontSize: "14px",
              background: "transparent",
              border: "none",
              padding: "6px 4px",
              verticalAlign: "top",
              textAlign: "left",
            }}
            classNames={{
              input: "copilot-input-minimal",
              wrapper: "copilot-input-wrapper",
            }}
          />

          {/* Bottom: Model Selector & Stop/Send Button */}
          <Group justify="flex-end" gap={4}>
            <ModelSelectorDropdown
              currentProvider={provider}
              currentModel={activeModel}
              allConfigs={configs}
              onProviderChange={handleProviderChange}
              onModelChange={handleModelChange}
              disabled={isLoading}
            />

            {isLoading && !inputValue.trim() ? (
              <ActionIcon
                size="xs"
                variant="filled"
                color="red"
                radius="xl"
                onClick={handleStop}
                title="Stop execution"
              >
                <IconPlayerStop size={12} />
              </ActionIcon>
            ) : (
              <ActionIcon
                size="xs"
                variant="filled"
                color="violet"
                radius="xl"
                onClick={() => {
                  if (isLoading && orchestratorRef.current) {
                    orchestratorRef.current.stop();
                  }
                  handleSend();
                }}
                disabled={!inputValue.trim()}
                title={isLoading ? "Stop and send new request" : "Send"}
              >
                <IconArrowUp size={12} />
              </ActionIcon>
            )}
          </Group>
        </Stack>
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

export default CopilotPanel;
