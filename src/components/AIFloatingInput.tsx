import { threadBlockService } from "@/services/ai/threadBlockService";
import { useBlockStore } from "@/stores/blockStore";
import { useBlockUIStore } from "@/stores/blockUIStore";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

interface AIFloatingInputProps {
  blockIds: string[];
  position: { x: number; y: number };
  onClose: () => void;
  mode?: "edit" | "rewrite";
}

const PRESET_PROMPTS = [
  { label: "Rewrite", prompt: "Rewrite this..." },
  { label: "Summarize", prompt: "Summarize this..." },
  { label: "Fix grammar", prompt: "Fix grammar..." },
  { label: "Expand", prompt: "Expand this..." },
  { label: "Concise", prompt: "Make concise..." },
];

function AIFloatingInputInternal({
  blockIds,
  position,
  onClose,
  mode = "edit",
}: AIFloatingInputProps) {
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const firstBlockId = blockIds[0];

  const adjustedPosition = useMemo(() => {
    const width = 340;
    const height = 200;
    const padding = 16;

    let x = position.x;
    let y = position.y;

    if (x + width + padding > window.innerWidth) {
      x = window.innerWidth - width - padding;
    }
    if (x < padding) {
      x = padding;
    }
    if (y + height + padding > window.innerHeight) {
      y = position.y - height - 20;
    }
    if (y < padding) {
      y = padding;
    }

    return { x, y };
  }, [position]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    const handleDismiss = () => onClose();
    window.addEventListener("resize", handleDismiss);
    window.addEventListener("scroll", handleDismiss, true);
    return () => {
      window.removeEventListener("resize", handleDismiss);
      window.removeEventListener("scroll", handleDismiss, true);
    };
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || blockIds.length === 0 || isSubmitting) return;

    const blockStore = useBlockStore.getState();
    const pageId = blockStore.currentPageId;

    if (!pageId) return;

    setIsSubmitting(true);
    onClose();

    try {
      const firstBlock = blockStore.blocksById[firstBlockId];
      if (firstBlock) {
        const enrichedPrompt = `${trimmedPrompt}\n\nTarget content: ${firstBlock.content}`;
        await threadBlockService.executePrompt(
          firstBlockId,
          enrichedPrompt,
          pageId,
        );
      }
    } catch (error) {
      console.error("[AIFloatingInput] Execution failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [prompt, blockIds, mode, onClose, firstBlockId, isSubmitting]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !isSubmitting) {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [handleSubmit, onClose, isSubmitting],
  );

  const selectPreset = useCallback((presetPrompt: string) => {
    setPrompt(presetPrompt);
    inputRef.current?.focus();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        zIndex: 1000,
        backgroundColor: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border-primary)",
        borderRadius: "var(--radius-md)",
        padding: "var(--spacing-md)",
        boxShadow: "var(--shadow-lg)",
        width: "340px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--spacing-xs)",
          marginBottom: "var(--spacing-sm)",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          style={{ color: "var(--color-accent)" }}
        >
          <path
            d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
            fill="currentColor"
          />
        </svg>
        <span
          style={{
            fontSize: "var(--font-size-xs)",
            fontWeight: 500,
            color: "var(--color-text-secondary)",
          }}
        >
          AI Edit{blockIds.length > 1 ? ` (${blockIds.length} blocks)` : ""}
        </span>
      </div>

      <input
        ref={inputRef}
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Describe what to do..."
        style={{
          width: "100%",
          padding: "var(--spacing-sm)",
          backgroundColor: "var(--color-bg-primary)",
          border: "1px solid var(--color-border-secondary)",
          borderRadius: "var(--radius-sm)",
          color: "var(--color-text-primary)",
          fontSize: "var(--font-size-sm)",
          outline: "none",
          transition: "border-color var(--transition-fast)",
        }}
      />

      <div
        style={{
          marginTop: "var(--spacing-sm)",
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--spacing-xs)",
        }}
      >
        {PRESET_PROMPTS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => selectPreset(preset.prompt)}
            style={{
              padding: "var(--spacing-xs) var(--spacing-sm)",
              backgroundColor: "transparent",
              color: "var(--color-text-tertiary)",
              border: "1px solid var(--color-border-secondary)",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--font-size-xs)",
              cursor: "pointer",
              transition: "all var(--transition-fast)",
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div
        style={{
          marginTop: "var(--spacing-md)",
          display: "flex",
          justifyContent: "flex-end",
          gap: "var(--spacing-xs)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: "var(--spacing-xs) var(--spacing-sm)",
            backgroundColor: "transparent",
            color: "var(--color-text-tertiary)",
            border: "1px solid var(--color-border-secondary)",
            borderRadius: "var(--radius-sm)",
            fontSize: "var(--font-size-xs)",
            cursor: "pointer",
            transition: "all var(--transition-fast)",
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!prompt.trim() || isSubmitting}
          style={{
            padding: "var(--spacing-xs) var(--spacing-sm)",
            backgroundColor:
              prompt.trim() && !isSubmitting
                ? "var(--color-accent)"
                : "var(--color-bg-tertiary)",
            color:
              prompt.trim() && !isSubmitting
                ? "white"
                : "var(--color-text-tertiary)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            fontSize: "var(--font-size-xs)",
            fontWeight: 500,
            cursor: prompt.trim() && !isSubmitting ? "pointer" : "not-allowed",
            transition: "background-color var(--transition-fast)",
          }}
        >
          {isSubmitting ? "Applying..." : "Apply"}
        </button>
      </div>
    </div>
  );
}

export const AIFloatingInput = memo(AIFloatingInputInternal);

export function useAIFloatingInput() {
  const [state, setState] = useState<{
    isOpen: boolean;
    blockIds: string[];
    position: { x: number; y: number };
    mode: "edit" | "rewrite";
  } | null>(null);

  const open = useCallback(
    (blockIds: string[], mode: "edit" | "rewrite" = "edit") => {
      const focusedBlockId = useBlockUIStore.getState().focusedBlockId;
      const targetBlockId = blockIds[0] || focusedBlockId;

      if (!targetBlockId) return;

      const element = document.querySelector(
        `[data-block-id="${targetBlockId}"]`,
      );
      const rect = element?.getBoundingClientRect();

      const x = rect ? rect.left : window.innerWidth / 2 - 170;
      const y = rect ? rect.bottom + 8 : window.innerHeight / 2;

      setState({
        isOpen: true,
        blockIds,
        position: { x, y },
        mode,
      });
    },
    [],
  );

  const close = useCallback(() => {
    setState(null);
  }, []);

  return { state, open, close };
}
