import { Modal, Stack, Text, Group, Button, Paper, Badge } from "@mantine/core";
import {
  IconAlertTriangle,
  IconTool,
  IconAlertCircle,
} from "@tabler/icons-react";
import type { PendingToolCall } from "../../stores/toolApprovalStore";

interface Props {
  toolCall: PendingToolCall;
  onApprove: () => void;
  onDeny: () => void;
}

function getHumanReadableAction(toolCall: PendingToolCall): string {
  // Build a natural language description of what the tool will do
  const params = toolCall.params;

  switch (toolCall.toolName) {
    case "search_pages":
      return `"${params.query as string}"로 페이지를 검색합니다.`;
    case "open_page":
      return `페이지 ID "${params.pageId as string}"를 엽니다.`;
    case "create_block":
      return `새 블록을 생성합니다: "${params.content as string}"`;
    case "update_block":
      return `블록 "${params.blockId as string}"를 수정합니다.`;
    case "delete_block":
      return `블록 "${params.blockId as string}"을 삭제합니다.`;
    case "create_page":
      return `새 페이지를 생성합니다: "${params.title as string}"`;
    case "delete_page":
      return `페이지 "${params.pageId as string}"를 삭제합니다.`;
    default:
      return toolCall.humanReadableAction || toolCall.description;
  }
}

function getDangerLevel(toolCall: PendingToolCall): "high" | "medium" | "low" {
  if (toolCall.isDangerous) return "high";
  if (
    toolCall.toolName.includes("delete") ||
    toolCall.toolName.includes("remove")
  )
    return "high";
  if (
    toolCall.toolName.includes("update") ||
    toolCall.toolName.includes("create")
  )
    return "medium";
  return "low";
}

function getDangerColor(level: "high" | "medium" | "low"): string {
  switch (level) {
    case "high":
      return "var(--color-error)";
    case "medium":
      return "var(--color-warning)";
    case "low":
      return "var(--color-success)";
  }
}

function getDangerLabel(level: "high" | "medium" | "low"): string {
  switch (level) {
    case "high":
      return "위험";
    case "medium":
      return "주의";
    case "low":
      return "안전";
  }
}

export function ToolApprovalModal({ toolCall, onApprove, onDeny }: Props) {
  const dangerLevel = getDangerLevel(toolCall);
  const dangerColor = getDangerColor(dangerLevel);
  const dangerLabel = getDangerLabel(dangerLevel);

  return (
    <Modal
      opened={true}
      onClose={onDeny}
      title="도구 실행 승인"
      centered
      zIndex={1000}
    >
      <Stack gap="md">
        <Group>
          {dangerLevel === "high" ? (
            <IconAlertTriangle size={24} color={dangerColor} />
          ) : dangerLevel === "medium" ? (
            <IconAlertCircle size={24} color={dangerColor} />
          ) : (
            <IconTool size={24} color={dangerColor} />
          )}
          <div style={{ flex: 1 }}>
            <Group justify="space-between">
              <Text size="sm" fw={600}>
                {toolCall.toolName}
              </Text>
              <Badge
                size="xs"
                color={
                  dangerLevel === "high"
                    ? "red"
                    : dangerLevel === "medium"
                    ? "orange"
                    : "green"
                }
              >
                {dangerLabel}
              </Badge>
            </Group>
            <Text size="xs" c="dimmed">
              {toolCall.description}
            </Text>
          </div>
        </Group>

        {/* Human-readable action description */}
        <Paper p="sm" bg="var(--color-bg-secondary)">
          <Text size="xs" fw={500} c="dimmed" mb={4}>
            수행 내용:
          </Text>
          <Text size="sm">{getHumanReadableAction(toolCall)}</Text>
        </Paper>

        {/* Affected items */}
        {toolCall.affectedItems && (
          <Paper p="sm" bg="var(--color-bg-secondary)">
            <Text size="xs" fw={500} c="dimmed" mb={4}>
              영향 범위:
            </Text>
            <Text size="sm">{toolCall.affectedItems}</Text>
          </Paper>
        )}

        {/* Parameters (expandable) */}
        <Paper p="sm" bg="var(--color-bg-tertiary)">
          <Text size="xs" fw={500} c="dimmed" mb={4}>
            매개변수:
          </Text>
          <Text
            size="xs"
            style={{ fontFamily: "monospace", whiteSpace: "pre-wrap" }}
          >
            {JSON.stringify(toolCall.params, null, 2)}
          </Text>
        </Paper>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onDeny}>
            거부
          </Button>
          <Button
            color={
              dangerLevel === "high"
                ? "red"
                : dangerLevel === "medium"
                ? "orange"
                : "blue"
            }
            onClick={onApprove}
          >
            승인
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
