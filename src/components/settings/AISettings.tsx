import {
  ActionIcon,
  Autocomplete,
  Button,
  Card,
  Group,
  Loader,
  PasswordInput,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { IconPlus, IconTrash, IconPencil, IconCheck, IconX, IconRefresh } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { useAISettingsStore, type AIProvider, type PromptTemplate } from "../../stores/aiSettingsStore";
import { createAIProvider } from "../../services/ai/factory";

interface AISettingsProps {
  matchesSearch: (text: string) => boolean;
}

export function AISettings({ matchesSearch }: AISettingsProps) {
  const { t } = useTranslation();
  
  const provider = useAISettingsStore((state) => state.provider);
  const apiKey = useAISettingsStore((state) => state.apiKey);
  const baseUrl = useAISettingsStore((state) => state.baseUrl);
  const model = useAISettingsStore((state) => state.model);
  const promptTemplates = useAISettingsStore((state) => state.promptTemplates);

  const setProvider = useAISettingsStore((state) => state.setProvider);
  const setApiKey = useAISettingsStore((state) => state.setApiKey);
  const setBaseUrl = useAISettingsStore((state) => state.setBaseUrl);
  const setModel = useAISettingsStore((state) => state.setModel);
  const addPromptTemplate = useAISettingsStore((state) => state.addPromptTemplate);
  const updatePromptTemplate = useAISettingsStore((state) => state.updatePromptTemplate);
  const deletePromptTemplate = useAISettingsStore((state) => state.deletePromptTemplate);

  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateContent, setNewTemplateContent] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const providerOptions = [
    { value: "google", label: t("settings.ai.providers.google") },
    { value: "openai", label: t("settings.ai.providers.openai") },
    { value: "claude", label: t("settings.ai.providers.claude") },
    { value: "ollama", label: t("settings.ai.providers.ollama") },
    { value: "custom", label: t("settings.ai.providers.custom") },
  ];

  const fetchModels = async () => {
    setIsLoadingModels(true);
    try {
      // Use factory to create temporary provider instance
      const aiProvider = createAIProvider(provider, baseUrl);
      const models = await aiProvider.getModels(baseUrl, apiKey);
      if (models.length > 0) {
        console.log(`Successfully fetched ${models.length} models for ${provider}:`, models);
        setAvailableModels(models);
      } else {
        console.log(`No models found for ${provider}. Check your API key or Base URL.`);
      }
    } catch (error) {
      console.error("Failed to fetch models:", error);
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Clear available models when provider changes
  useEffect(() => {
    setAvailableModels([]);
  }, [provider]);

  const handleAddTemplate = () => {
    if (!newTemplateName.trim() || !newTemplateContent.trim()) return;
    addPromptTemplate(newTemplateName, newTemplateContent);
    setNewTemplateName("");
    setNewTemplateContent("");
  };

  const startEditing = (template: PromptTemplate) => {
    setEditingTemplateId(template.id);
    setEditName(template.name);
    setEditContent(template.content);
  };

  const cancelEditing = () => {
    setEditingTemplateId(null);
    setEditName("");
    setEditContent("");
  };

  const saveEditing = () => {
    if (editingTemplateId && editName.trim() && editContent.trim()) {
      updatePromptTemplate(editingTemplateId, { name: editName, content: editContent });
      setEditingTemplateId(null);
    }
  };

  const showApiKey = provider !== "ollama";
  const showBaseUrl = provider === "ollama" || provider === "custom";

  return (
    <Stack gap="xl">
      <div>
        <Text size="xl" fw={600} mb="lg">
          {t("settings.ai.title")}
        </Text>
        <Text size="sm" c="dimmed" mb="xl">
          {t("settings.ai.description")}
        </Text>

        <Stack gap="lg">
          {matchesSearch("provider model api key") && (
            <>
              <Select
                label={t("settings.ai.provider")}
                description={t("settings.ai.provider_desc")}
                data={providerOptions}
                value={provider}
                onChange={(val) => setProvider((val as AIProvider) || "google")}
                allowDeselect={false}
              />

              {showBaseUrl && (
                <TextInput
                  label={t("settings.ai.base_url")}
                  description={t("settings.ai.base_url_desc")}
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.currentTarget.value)}
                  placeholder="http://localhost:11434"
                />
              )}

              {showApiKey && (
                <PasswordInput
                  label={t("settings.ai.api_key")}
                  description={t("settings.ai.api_key_desc")}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.currentTarget.value)}
                  placeholder="sk-..."
                />
              )}

              <Autocomplete
                label={t("settings.ai.model")}
                description={t("settings.ai.model_desc")}
                value={model}
                onChange={setModel}
                placeholder="gpt-4, gemini-pro, llama3..."
                data={availableModels}
                rightSection={
                  <ActionIcon 
                    variant="subtle" 
                    onClick={fetchModels} 
                    loading={isLoadingModels}
                    title="Load available models"
                  >
                    {isLoadingModels ? <Loader size={16} /> : <IconRefresh size={16} />}
                  </ActionIcon>
                }
              />
            </>
          )}

          {matchesSearch("prompt templates") && (
            <div>
              <Text size="sm" fw={500} mb="sm">
                {t("settings.ai.templates")}
              </Text>
              <Text size="xs" c="dimmed" mb="md">
                {t("settings.ai.templates_desc")}
              </Text>

              <Stack gap="sm">
                {promptTemplates.length === 0 && (
                  <Text size="sm" c="dimmed" fs="italic">
                    {t("settings.ai.no_templates")}
                  </Text>
                )}

                {promptTemplates.map((template) => (
                  <Card key={template.id} withBorder padding="sm" radius="md">
                    {editingTemplateId === template.id ? (
                      <Stack gap="xs">
                        <TextInput
                          value={editName}
                          onChange={(e) => setEditName(e.currentTarget.value)}
                          placeholder={t("settings.ai.template_name_placeholder")}
                        />
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.currentTarget.value)}
                          placeholder={t("settings.ai.template_content_placeholder")}
                          autosize
                          minRows={2}
                        />
                        <Group justify="flex-end" gap="xs">
                          <ActionIcon variant="light" color="red" onClick={cancelEditing}>
                            <IconX size={16} />
                          </ActionIcon>
                          <ActionIcon variant="light" color="green" onClick={saveEditing}>
                            <IconCheck size={16} />
                          </ActionIcon>
                        </Group>
                      </Stack>
                    ) : (
                      <Group justify="space-between" align="flex-start">
                        <div style={{ flex: 1 }}>
                          <Text fw={500} size="sm">{template.name}</Text>
                          <Text size="xs" c="dimmed" lineClamp={2}>
                            {template.content}
                          </Text>
                        </div>
                        <Group gap="xs">
                          <ActionIcon variant="subtle" size="sm" onClick={() => startEditing(template)}>
                            <IconPencil size={16} />
                          </ActionIcon>
                          <ActionIcon variant="subtle" color="red" size="sm" onClick={() => deletePromptTemplate(template.id)}>
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                      </Group>
                    )}
                  </Card>
                ))}

                <Card withBorder padding="sm" radius="md" mt="sm" style={{ borderStyle: "dashed" }}>
                  <Text size="sm" fw={500} mb="xs">{t("settings.ai.add_template")}</Text>
                  <Stack gap="xs">
                    <TextInput
                      placeholder={t("settings.ai.template_name_placeholder")}
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.currentTarget.value)}
                    />
                    <Textarea
                      placeholder={t("settings.ai.template_content_placeholder")}
                      value={newTemplateContent}
                      onChange={(e) => setNewTemplateContent(e.currentTarget.value)}
                      autosize
                      minRows={2}
                    />
                    <Button 
                      variant="light" 
                      leftSection={<IconPlus size={16} />} 
                      onClick={handleAddTemplate}
                      disabled={!newTemplateName.trim() || !newTemplateContent.trim()}
                    >
                      {t("settings.ai.add_template")}
                    </Button>
                  </Stack>
                </Card>
              </Stack>
            </div>
          )}
        </Stack>
      </div>
    </Stack>
  );
}
