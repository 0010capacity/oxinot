import { Modal, Stack, Text, Group, Button } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import type { PendingToolCall } from "../../stores/toolApprovalStore";

interface Props {
  toolCall: PendingToolCall;
  onApprove: () => void;
  onDeny: () => void;
}

export function ToolApprovalModal({ toolCall, onApprove, onDeny }: Props) {
  return (
    <Modal
      opened={true}
      onClose={onDeny}
      title="Approve Tool Execution"
      centered
      zIndex={1000}
    >
      <Stack gap="md">
        <Group>
          <IconAlertTriangle size={24} color="orange" />
          <div>
            <Text size="sm" fw={600}>
              AI wants to execute: {toolCall.toolName}
            </Text>
            <Text size="xs" c="dimmed">
              {toolCall.description}
            </Text>
          </div>
        </Group>

        {/* User requested minimal UI, so we hide the parameters JSON
        <div>
          <Text size="sm" fw={500} mb="xs">
            Parameters:
          </Text>
          <Code block>
            {JSON.stringify(toolCall.params, null, 2)}
          </Code>
        </div>
        */}

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onDeny}>
            Deny
          </Button>
          <Button color="blue" onClick={onApprove}>
            Approve
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
