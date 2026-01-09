import { useState } from "react";
import { TextInput, Group, ActionIcon } from "@mantine/core";
import { IconCheck, IconX } from "@tabler/icons-react";

interface NewPageInputProps {
  depth: number;
  onSubmit: (title: string) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function NewPageInput({
  depth,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: NewPageInputProps) {
  const [title, setTitle] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && title.trim()) {
      e.preventDefault();
      onSubmit(title);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const handleSubmit = () => {
    if (title.trim()) {
      onSubmit(title);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--spacing-sm)",
        paddingLeft: `${depth * 24}px`,
        paddingTop: "2px",
        paddingBottom: "2px",
        backgroundColor: "var(--color-interactive-hover)",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--color-interactive-focus)",
        margin: "2px 0",
      }}
    >
      <div
        style={{
          width: "var(--layout-collapse-toggle-size)",
          height: "var(--layout-collapse-toggle-size)",
          margin: 0,
        }}
      />
      <div
        style={{
          flexShrink: 0,
          width: "var(--layout-bullet-container-size)",
          height: "var(--layout-bullet-container-size)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "4px",
            height: "4px",
            borderRadius: "50%",
            backgroundColor: "var(--color-bullet-hover)",
          }}
        />
      </div>

      <Group gap={4} wrap="nowrap" style={{ flex: 1, paddingRight: "8px" }}>
        <TextInput
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder="New page title..."
          autoFocus
          size="xs"
          disabled={isSubmitting}
          styles={{
            input: {
              border: "none",
              backgroundColor: "transparent",
              fontWeight: 500,
              fontSize: "var(--font-size-sm)",
              lineHeight: "24px",
            },
          }}
          style={{ flex: 1 }}
        />

        <ActionIcon
          variant="subtle"
          onClick={handleSubmit}
          disabled={isSubmitting || !title.trim()}
          size="xs"
          color="green"
          style={{
            opacity: title.trim() ? 1 : "var(--opacity-disabled)",
          }}
        >
          <IconCheck size={12} />
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          onClick={onCancel}
          disabled={isSubmitting}
          size="xs"
          style={{ opacity: "var(--opacity-dimmed)" }}
        >
          <IconX size={12} />
        </ActionIcon>
      </Group>
    </div>
  );
}
