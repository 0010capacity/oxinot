import {
  ActionIcon,
  Button,
  Card,
  Group,
  PasswordInput,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import {
  IconPlus,
  IconTrash,
  IconPencil,
  IconCheck,
  IconX,
  IconRefresh,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import {
  useAISettingsStore,
  type AIProvider,
  type PromptTemplate,
  type ToolApprovalPolicy,
} from "../../stores/aiSettingsStore";

interface AISettingsProps {
  matchesSearch: (text: string) => boolean;
}

export function AISettings({ matchesSearch }: AISettingsProps) {
  const { t } = useTranslation();

  const provider = useAISettingsStore((state) => state.provider);
  const apiKey = useAISettingsStore((state) => state.apiKey);
  const baseUrl = useAISettingsStore((state) => state.baseUrl);
  const models = useAISettingsStore((state) => state.models);
  const temperature = useAISettingsStore((state) => state.temperature);
  const promptTemplates = useAISettingsStore((state) => state.promptTemplates);
  const toolApprovalPolicy = useAISettingsStore(
    (state) => state.toolApprovalPolicy
  );

  const setProvider = useAISettingsStore((state) => state.setProvider);
  const setApiKey = useAISettingsStore((state) => state.setApiKey);
  const setBaseUrl = useAISettingsStore((state) => state.setBaseUrl);
  const setModels = useAISettingsStore((state) => state.setModels);
  const setTemperature = useAISettingsStore((state) => state.setTemperature);
  const setToolApprovalPolicy = useAISettingsStore(
    (state) => state.setToolApprovalPolicy
  );
  const addPromptTemplate = useAISettingsStore(
    (state) => state.addPromptTemplate
  );
  const updatePromptTemplate = useAISettingsStore(
    (state) => state.updatePromptTemplate
  );
  const deletePromptTemplate = useAISettingsStore(
    (state) => state.deletePromptTemplate
  );

  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateContent, setNewTemplateContent] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null
  );
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");

  const [newModelInput, setNewModelInput] = useState("");

  const RECOMMENDED_MODELS: Record<string, string[]> = {
    openai: ["gpt-5.2", "gpt-5-mini", "gpt-5-nano"],
    claude: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5"],
    google: [
      "gemini-3-pro",
      "gemini-3-deepthink",
      "gemini-3-flash",
      "gemini-2.5-pro",
      "gemini-2.5-flash",
    ],
    zai: ["glm-4.7", "glm-4.7-flash", "glm-4.6"],
    "zai-coding-plan": ["glm-4.7", "glm-4.7-flash", "glm-4.6"],
    ollama: [],
    lmstudio: [],
    custom: [],
  };

  const providerOptions = [
    { value: "google", label: t("settings.ai.providers.google") },
    { value: "claude", label: t("settings.ai.providers.claude") },
    { value: "openai", label: t("settings.ai.providers.openai") },
    { value: "zai", label: t("settings.ai.providers.zai") },
    {
      value: "zai-coding-plan",
      label: t("settings.ai.providers.zai-coding-plan"),
    },
    { value: "ollama", label: t("settings.ai.providers.ollama") },
    { value: "lmstudio", label: t("settings.ai.providers.lmstudio") },
    { value: "custom", label: t("settings.ai.providers.custom") },
  ];

  const toolApprovalOptions = [
    { value: "always", label: t("settings.ai.tool_approval.always") },
    {
      value: "dangerous_only",
      label: t("settings.ai.tool_approval.dangerous_only"),
    },
    { value: "never", label: t("settings.ai.tool_approval.never") },
  ];

  // Load default models when provider changes
  useEffect(() => {
    const recommended = RECOMMENDED_MODELS[provider] || [];
    setModels(recommended);
  }, [provider]);

  const handleAddModel = () => {
    if (!newModelInput.trim()) return;
    const modelToAdd = newModelInput.trim();
    if (models.includes(modelToAdd)) return; // Prevent duplicates
    const newModels = [...models, modelToAdd];
    setModels(newModels);
    setNewModelInput("");
  };

  const handleRemoveModel = (index: number) => {
    const newModels = models.filter((_, i) => i !== index);
    setModels(newModels);
  };

  const handleResetModels = () => {
    // Restore default models for current provider
    const defaultModels = RECOMMENDED_MODELS[provider] || [];
    setModels(defaultModels);
  };

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
      updatePromptTemplate(editingTemplateId, {
        name: editName,
        content: editContent,
      });
      setEditingTemplateId(null);
    }
  };

  const showApiKey = provider !== "ollama" && provider !== "lmstudio";
  const showBaseUrl =
    provider === "ollama" || provider === "lmstudio" || provider === "custom";

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

              <div>
                <Group justify="space-between" align="center" mb="xs">
                  <Text size="sm" fw={500}>
                    {t("settings.ai.model")}
                  </Text>
                  <Button
                    variant="subtle"
                    size="xs"
                    leftSection={<IconRefresh size={14} />}
                    onClick={handleResetModels}
                  >
                    Reset to Defaults
                  </Button>
                </Group>
                <Text size="xs" c="dimmed" mb="md">
                  {t("settings.ai.model_desc")}
                </Text>

                {/* Model list */}
                <Stack gap="xs" mb="md">
                  {models.map((model, index) => (
                    <Group key={model} justify="space-between" gap="xs">
                      <Button
                        variant="light"
                        size="xs"
                        style={{ flex: 1, textAlign: "left" }}
                      >
                        {model}
                      </Button>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        onClick={() => handleRemoveModel(index)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  ))}
                </Stack>

                {/* Add new model */}
                <Group gap="xs">
                  <TextInput
                    placeholder={t("settings.ai.add_model_placeholder")}
                    value={newModelInput}
                    onChange={(e) => setNewModelInput(e.currentTarget.value)}
                    style={{ flex: 1 }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddModel();
                      }
                    }}
                  />
                  <ActionIcon
                    variant="filled"
                    size="lg"
                    onClick={handleAddModel}
                    disabled={!newModelInput.trim()}
                  >
                    <IconPlus size={18} />
                  </ActionIcon>
                </Group>
              </div>

              {/* Temperature slider */}
              <div>
                <Text size="sm" fw={500} mb="xs">
                  {t("settings.ai.temperature")}
                </Text>
                <Text size="xs" c="dimmed" mb="md">
                  {t("settings.ai.temperature_desc")}
                </Text>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">
                      {t("settings.ai.temperature_precise")}
                    </Text>
                    <Text size="xs" fw={600}>
                      {temperature.toFixed(1)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t("settings.ai.temperature_creative")}
                    </Text>
                  </Group>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={temperature}
                    onChange={(e) =>
                      setTemperature(Number.parseFloat(e.currentTarget.value))
                    }
                    style={{
                      width: "100%",
                      cursor: "pointer",
                    }}
                  />
                </Stack>
              </div>

              <Select
                label={t("settings.ai.tool_approval.label")}
                description={t("settings.ai.tool_approval.description")}
                data={toolApprovalOptions}
                value={toolApprovalPolicy}
                onChange={(val) =>
                  setToolApprovalPolicy(
                    (val as ToolApprovalPolicy) || "dangerous_only"
                  )
                }
                allowDeselect={false}
              />
            </>
          )}

          {matchesSearch("prompt templates tool approval") && (
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
                          placeholder={t(
                            "settings.ai.template_name_placeholder"
                          )}
                        />
                        <Textarea
                          value={editContent}
                          onChange={(e) =>
                            setEditContent(e.currentTarget.value)
                          }
                          placeholder={t(
                            "settings.ai.template_content_placeholder"
                          )}
                          autosize
                          minRows={2}
                        />
                        <Group justify="flex-end" gap="xs">
                          <ActionIcon
                            variant="light"
                            color="red"
                            onClick={cancelEditing}
                          >
                            <IconX size={16} />
                          </ActionIcon>
                          <ActionIcon
                            variant="light"
                            color="green"
                            onClick={saveEditing}
                          >
                            <IconCheck size={16} />
                          </ActionIcon>
                        </Group>
                      </Stack>
                    ) : (
                      <Group justify="space-between" align="flex-start">
                        <div style={{ flex: 1 }}>
                          <Text fw={500} size="sm">
                            {template.name}
                          </Text>
                          <Text size="xs" c="dimmed" lineClamp={2}>
                            {template.content}
                          </Text>
                        </div>
                        <Group gap="xs">
                          <ActionIcon
                            variant="subtle"
                            size="sm"
                            onClick={() => startEditing(template)}
                          >
                            <IconPencil size={16} />
                          </ActionIcon>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            onClick={() => deletePromptTemplate(template.id)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                      </Group>
                    )}
                  </Card>
                ))}

                <Card
                  withBorder
                  padding="sm"
                  radius="md"
                  mt="sm"
                  style={{ borderStyle: "dashed" }}
                >
                  <Text size="sm" fw={500} mb="xs">
                    {t("settings.ai.add_template")}
                  </Text>
                  <Stack gap="xs">
                    <TextInput
                      placeholder={t("settings.ai.template_name_placeholder")}
                      value={newTemplateName}
                      onChange={(e) =>
                        setNewTemplateName(e.currentTarget.value)
                      }
                    />
                    <Textarea
                      placeholder={t(
                        "settings.ai.template_content_placeholder"
                      )}
                      value={newTemplateContent}
                      onChange={(e) =>
                        setNewTemplateContent(e.currentTarget.value)
                      }
                      autosize
                      minRows={2}
                    />
                    <Button
                      variant="light"
                      leftSection={<IconPlus size={16} />}
                      onClick={handleAddTemplate}
                      disabled={
                        !newTemplateName.trim() || !newTemplateContent.trim()
                      }
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
