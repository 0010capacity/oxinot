import { useState, useEffect, useRef } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onCancel();
      }
    };

    // Add slight delay to avoid immediate close on trigger click
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onCancel]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && title.trim()) {
      e.preventDefault();
      onSubmit(title);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const handleSubmit = async () => {
    if (title.trim()) {
      await onSubmit(title);
      setTitle("");
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        paddingLeft: `${depth * 24}px`,
        paddingRight: "8px",
        paddingTop: "4px",
        paddingBottom: "4px",
        backgroundColor: "var(--color-interactive-hover)",
        borderRadius: "6px",
        border: "1px solid var(--color-interactive-focus)",
        margin: "4px 8px",
        transition: "all var(--transition-normal)",
      }}
    >
      {/* Spacer for collapse toggle */}
      <div
        style={{
          width: "var(--layout-collapse-toggle-size)",
          height: "var(--layout-collapse-toggle-size)",
          flexShrink: 0,
        }}
      />

      {/* Bullet point */}
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

      {/* Input and action buttons */}
      <Group
        gap={6}
        wrap="nowrap"
        style={{
          flex: 1,
        }}
      >
        <TextInput
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter page title..."
          disabled={isSubmitting}
          size="xs"
          styles={{
            input: {
              border: "none",
              backgroundColor: "transparent",
              fontWeight: 500,
              fontSize: "var(--font-size-sm)",
              lineHeight: "24px",
              padding: "0 4px",
              color: "var(--color-text-primary)",

              "&::placeholder": {
                color: "var(--color-text-tertiary)",
                opacity: 0.7,
              },

              "&:focus": {
                outline: "none",
              },
            },
          }}
          style={{
            flex: 1,
          }}
        />

        {/* Confirm button */}
        <ActionIcon
          variant="subtle"
          onClick={(e) => {
            e.stopPropagation();
            handleSubmit();
          }}
          disabled={isSubmitting || !title.trim()}
          size="xs"
          color="green"
          style={{
            opacity: title.trim() ? 1 : 0.4,
            transition: "opacity var(--transition-normal)",
          }}
          title="Save page (Enter)"
        >
          <IconCheck size={14} stroke={2} />
        </ActionIcon>

        {/* Cancel button */}
        <ActionIcon
          variant="subtle"
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          disabled={isSubmitting}
          size="xs"
          color="gray"
          style={{
            opacity: 0.6,
            transition: "opacity var(--transition-normal)",
          }}
          title="Cancel (Esc)"
        >
          <IconX size={14} stroke={2} />
        </ActionIcon>
      </Group>
    </div>
  );
}
