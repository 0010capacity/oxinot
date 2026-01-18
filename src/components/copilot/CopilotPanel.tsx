import {
  ActionIcon,
  Button,
  Group,
  Paper,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  Menu,
  Box,
  LoadingOverlay,
  Badge,
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
  IconRefresh,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import { useCopilotUiStore, type CopilotMode, type CopilotScope } from "../../stores/copilotUiStore";
import { useAISettingsStore } from "../../stores/aiSettingsStore";
import { createAIProvider } from "../../services/ai/factory";
import { useBlockStore } from "../../stores/blockStore";
import { useBlockUIStore } from "../../stores/blockUIStore";
import { renderMarkdownToHtml } from "../../outliner/markdownRenderer";
import { usePageStore } from "../../stores/pageStore";

export function CopilotPanel() {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  
  // Store state
  const isOpen = useCopilotUiStore((state) => state.isOpen);
  const close = useCopilotUiStore((state) => state.close);
  const mode = useCopilotUiStore((state) => state.mode);
  const setMode = useCopilotUiStore((state) => state.setMode);
  const scope = useCopilotUiStore((state) => state.scope);
  const setScope = useCopilotUiStore((state) => state.setScope);
  const inputValue = useCopilotUiStore((state) => state.inputValue);
  const setInputValue = useCopilotUiStore((state) => state.setInputValue);
  const isLoading = useCopilotUiStore((state) => state.isLoading);
  const previewContent = useCopilotUiStore((state) => state.previewContent);
  const setIsLoading = useCopilotUiStore((state) => state.setIsLoading);
  const setPreviewContent = useCopilotUiStore((state) => state.setPreviewContent);
  
  // Settings
  const { provider, apiKey, baseUrl, model, promptTemplates } = useAISettingsStore();

  // Local state
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Auto-scroll to bottom of preview
  useEffect(() => {
    if (scrollViewportRef.current) {
      scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }
  });

  const gatherContext = (): { context: string; systemPrompt?: string } => {
    const blockStore = useBlockStore.getState();
    const uiStore = useBlockUIStore.getState();
    const pageStore = usePageStore.getState();

    let context = "";
    let systemPrompt = "You are a helpful AI assistant integrated into a block-based outliner app.";

    if (scope === "block") {
      const focusedId = uiStore.focusedBlockId;
      if (focusedId) {
        const block = blockStore.blocksById[focusedId];
        if (block) {
          context = `Current Block Content:\n${block.content}`;
          systemPrompt += " The user wants to edit or generate content based on the current block.";
        }
      }
    } else if (scope === "selection") {
      const selectedIds = uiStore.selectedBlockIds;
      if (selectedIds.length > 0) {
        const content = selectedIds
          .map((id) => blockStore.blocksById[id]?.content)
          .filter(Boolean)
          .join("\n");
        context = `Selected Blocks Content:\n${content}`;
        systemPrompt += " The user wants to process the selected blocks.";
      } else {
        // Fallback to focused block if no selection
        const focusedId = uiStore.focusedBlockId;
        if (focusedId) {
          const block = blockStore.blocksById[focusedId];
          if (block) {
            context = `Current Block Content:\n${block.content}`;
          }
        }
      }
    } else if (scope === "page") {
      const pageId = blockStore.currentPageId;
      if (pageId) {
        const pageTitle = pageStore.pagesById[pageId]?.title || "Untitled";
        // Simple context: just title for now to avoid huge context window issues
        // In a real implementation, we would traverse the tree and collect content
        context = `Page Title: ${pageTitle}\n(Page content context is limited for performance)`;
        systemPrompt += " The user is asking about the current page.";
      }
    }

    return { context, systemPrompt };
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    
    setIsLoading(true);
    setPreviewContent("");
    setError(null);

    try {
      const aiProvider = createAIProvider(provider, baseUrl);
      const { context, systemPrompt } = gatherContext();
      
      const prompt = `${context}\n\nUser Request: ${inputValue}`;

      const stream = aiProvider.generateStream({
        prompt,
        systemPrompt,
        model,
        apiKey,
        baseUrl,
      });

      let fullContent = "";
      for await (const chunk of stream) {
        fullContent += chunk;
        setPreviewContent(fullContent);
      }
    } catch (err: unknown) {
      console.error("AI Generation Error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to generate response";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleApplyReplace = async () => {
    const uiStore = useBlockUIStore.getState();
    const blockStore = useBlockStore.getState();
    const focusedId = uiStore.focusedBlockId;

    if (!focusedId) return;

    try {
      await blockStore.updateBlockContent(focusedId, previewContent);
      close();
      setPreviewContent("");
      setInputValue("");
    } catch (e) {
      console.error("Failed to apply changes:", e);
      setError("Failed to apply changes");
    }
  };

  const handleInsertBelow = async () => {
    const uiStore = useBlockUIStore.getState();
    const blockStore = useBlockStore.getState();
    const focusedId = uiStore.focusedBlockId;

    if (!focusedId) return;

    try {
      await blockStore.createBlock(focusedId, previewContent);
      close();
      setPreviewContent("");
      setInputValue("");
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
      {/* Header */}
      <Group justify="space-between" p="xs" style={{ borderBottom: "1px solid var(--color-border-primary)" }}>
        <Group gap="xs">
          <Badge variant="light" color="violet" size="lg" leftSection={<IconArrowUp size={12} />}>
            Copilot
          </Badge>
          <SegmentedControl
            size="xs"
            value={mode}
            onChange={(val) => setMode(val as CopilotMode)}
            data={[
              { label: t("settings.ai.copilot.mode.edit"), value: "edit" },
              { label: t("settings.ai.copilot.mode.generate"), value: "generate" },
              { label: t("settings.ai.copilot.mode.chat"), value: "chat" },
            ]}
          />
          <SegmentedControl
            size="xs"
            value={scope}
            onChange={(val) => setScope(val as CopilotScope)}
            data={[
              { label: t("settings.ai.copilot.scope.block"), value: "block" },
              { label: t("settings.ai.copilot.scope.selection"), value: "selection" },
              { label: t("settings.ai.copilot.scope.page"), value: "page" },
            ]}
          />
        </Group>
        <Group gap="xs">
          <ActionIcon size="sm" variant="subtle" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <IconMinimize size={16} /> : <IconMaximize size={16} />}
          </ActionIcon>
          <ActionIcon size="sm" variant="subtle" color="gray" onClick={close}>
            <IconX size={16} />
          </ActionIcon>
        </Group>
      </Group>

      {/* Content Area */}
      <Box style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <LoadingOverlay visible={isLoading && !previewContent} zIndex={10} overlayProps={{ blur: 1 }} />
        
        {error && (
          <div style={{ padding: "12px", backgroundColor: "var(--mantine-color-red-1)", color: "var(--mantine-color-red-9)" }}>
             <Text size="sm">{error}</Text>
          </div>
        )}

        <ScrollArea h="100%" p="md" viewportRef={scrollViewportRef}>
          {previewContent ? (
            <div>
              <Text size="xs" fw={700} c="dimmed" mb="xs" style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {t("settings.ai.copilot.preview_title")}
              </Text>
              <div 
                className="markdown-preview"
                style={{ fontSize: "15px", lineHeight: "1.6" }}
                dangerouslySetInnerHTML={{ 
                  __html: renderMarkdownToHtml(previewContent, { allowBlocks: true }) 
                }} 
              />
            </div>
          ) : (
             <Stack align="center" justify="center" h="100%" style={{ opacity: 0.5, minHeight: "200px" }}>
               <Text size="sm" c="dimmed">Select a block and ask AI to edit or generate content.</Text>
             </Stack>
          )}
        </ScrollArea>
      </Box>

      {/* Footer / Input Area */}
      <div style={{ padding: "12px", borderTop: "1px solid var(--color-border-primary)", backgroundColor: "var(--color-bg-secondary)" }}>
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
                    <Menu.Item key={t.id} onClick={() => handleTemplateSelect(t.content)}>
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
              onChange={(e) => setInputValue(e.currentTarget.value)}
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
          
          {previewContent && !isLoading && (
            <Group justify="flex-end" pt="xs">
               <Button 
                 variant="subtle" 
                 size="xs" 
                 color="gray" 
                 leftSection={<IconTrash size={14} />}
                 onClick={() => setPreviewContent("")}
               >
                 {t("settings.ai.copilot.actions.discard")}
               </Button>
               <Button 
                 variant="light" 
                 size="xs" 
                 color="blue" 
                 leftSection={<IconRefresh size={14} />}
                 onClick={handleSend}
               >
                 {t("settings.ai.copilot.actions.retry")}
               </Button>
               <Button 
                 variant="light" 
                 size="xs" 
                 color="teal" 
                 leftSection={<IconDownload size={14} />}
                 onClick={handleInsertBelow}
               >
                 Insert Below
               </Button>
               <Button 
                 variant="filled" 
                 size="xs" 
                 color="violet"
                 leftSection={<IconReplace size={14} />}
                 onClick={handleApplyReplace}
               >
                 {t("settings.ai.copilot.actions.apply")}
               </Button>
            </Group>
          )}
        </Stack>
      </div>
    </Paper>
  );
}