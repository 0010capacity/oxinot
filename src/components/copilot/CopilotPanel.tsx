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
} from "@mantine/core";
import {
  IconArrowUp,
  IconTemplate,
  IconX,
  IconMaximize,
  IconMinimize,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import { useCopilotUiStore, type CopilotMode, type CopilotScope } from "../../stores/copilotUiStore";
import { useAISettingsStore } from "../../stores/aiSettingsStore";

export function CopilotPanel() {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
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
  const promptTemplates = useAISettingsStore((state) => state.promptTemplates);

  // Local state
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    
    // TODO: Implement actual AI call logic here
    // For now, simulate streaming response
    setIsLoading(true);
    setPreviewContent("");
    
    const simulatedResponse = `This is a simulated response for "${inputValue}".\n\n- Point 1\n- Point 2\n- Point 3`;
    let currentIndex = 0;
    
    const interval = setInterval(() => {
      if (currentIndex < simulatedResponse.length) {
        setPreviewContent(simulatedResponse.substring(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(interval);
        setIsLoading(false);
      }
    }, 20);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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
        height: isExpanded ? "80vh" : "400px",
        zIndex: 140, // Below CopilotButton (150)
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
      <Box style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <LoadingOverlay visible={isLoading && !previewContent} zIndex={10} overlayProps={{ blur: 1 }} />
        <ScrollArea h="100%" p="md">
          {previewContent ? (
            <div style={{ whiteSpace: "pre-wrap", fontFamily: "var(--font-family)" }}>
              <Text size="sm" fw={700} c="dimmed" mb="xs">
                {t("settings.ai.copilot.preview_title")}
              </Text>
              <Text size="md">{previewContent}</Text>
            </div>
          ) : (
             <Stack align="center" justify="center" h="100%" style={{ opacity: 0.5 }}>
               <Text size="sm">Ready to assist.</Text>
             </Stack>
          )}
        </ScrollArea>
      </Box>

      {/* Footer / Input Area */}
      <div style={{ padding: "12px", borderTop: "1px solid var(--color-border-primary)" }}>
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
            <Group justify="flex-end">
               <Button variant="default" size="xs" onClick={() => setPreviewContent("")}>
                 {t("settings.ai.copilot.actions.discard")}
               </Button>
               <Button variant="light" size="xs" color="violet">
                 {t("settings.ai.copilot.actions.apply")}
               </Button>
            </Group>
          )}
        </Stack>
      </div>
    </Paper>
  );
}
