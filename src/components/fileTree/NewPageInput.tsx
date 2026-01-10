import { useState, useEffect, useRef } from "react";
import { TextInput } from "@mantine/core";
import { BulletPoint } from "../common/BulletPoint";

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
      setTitle("");
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--spacing-sm)",
        paddingLeft: `${depth * 24}px`,
        paddingTop: "2px",
        paddingBottom: "2px",
        position: "relative",
        borderRadius: "var(--radius-sm)",
        transition: "background-color var(--transition-normal)",
        userSelect: "none",
      }}
    >
      {/* Collapse toggle spacer */}
      <div
        style={{
          flexShrink: 0,
          width: "var(--layout-collapse-toggle-size)",
          height: "var(--layout-collapse-toggle-size)",
        }}
      />

      {/* Bullet point - dimmed to indicate unsaved state */}
      <div style={{ opacity: 0.4 }}>
        <BulletPoint type="default" isActive={false} />
      </div>

      {/* Input field - matches PageTreeItem text styling exactly */}
      <TextInput
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        placeholder="New page"
        disabled={isSubmitting}
        size="xs"
        styles={{
          input: {
            border: "none",
            backgroundColor: "transparent",
            fontWeight: 400,
            fontSize: "var(--font-size-sm)",
            lineHeight: "24px",
            padding: "2px 4px 2px 4px",
            color: "var(--color-text-primary)",
            height: "auto",
            minHeight: "auto",

            "&::placeholder": {
              color: "var(--color-text-tertiary)",
              opacity: 0.5,
            },

            "&:focus": {
              outline: "none",
              backgroundColor: "transparent",
            },
          },
        }}
        style={{
          flex: 1,
        }}
      />
    </div>
  );
}
