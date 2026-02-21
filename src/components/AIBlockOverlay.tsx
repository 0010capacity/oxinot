import { threadBlockService } from "@/services/ai/threadBlockService";
import { useAIJobsStore, useBlockJobStatus } from "@/stores/aiJobsStore";
import { memo, useEffect, useState } from "react";

interface AIBlockOverlayProps {
  blockId: string;
}

function AIBlockOverlayInternal({ blockId }: AIBlockOverlayProps) {
  const status = useBlockJobStatus(blockId);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (
      status &&
      status !== "done" &&
      status !== "error" &&
      status !== "cancelled"
    ) {
      setVisible(true);
    } else {
      const timer = setTimeout(() => setVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [status]);

  if (!visible) {
    return null;
  }

  const isActive = status && !["done", "error", "cancelled"].includes(status);

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    const job = useAIJobsStore.getState().getActiveJobForBlock(blockId);
    if (job) {
      if (job.threadId) {
        threadBlockService.cancelThread(job.threadId);
      } else {
        useAIJobsStore.getState().cancelJob(job.id);
      }
    }
  };

  return (
    <div
      className="ai-block-overlay"
      style={{
        position: "absolute",
        inset: "-2px",
        pointerEvents: "none",
        borderRadius: "var(--radius-sm)",
        border: isActive
          ? "1.5px solid var(--color-accent)"
          : "1.5px solid transparent",
        opacity: isActive ? 1 : 0,
        transition:
          "opacity var(--transition-normal), border-color var(--transition-normal)",
      }}
    >
      {isActive && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            right: "-4px",
            transform: "translateY(-50%) translateX(100%)",
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-xs)",
            padding: "3px var(--spacing-sm) 3px var(--spacing-xs)",
            backgroundColor: "var(--color-bg-secondary)",
            border: "1px solid var(--color-border-primary)",
            borderRadius: "var(--radius-sm)",
            boxShadow: "var(--shadow-sm)",
            pointerEvents: "auto",
            whiteSpace: "nowrap",
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            aria-hidden="true"
            style={{
              animation: "ai-spin 1.5s linear infinite",
              color: "var(--color-accent)",
            }}
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
              strokeDasharray="31.4"
              strokeDashoffset="10"
            />
          </svg>
          <span
            style={{
              fontSize: "var(--font-size-xs)",
              color: "var(--color-text-tertiary)",
              letterSpacing: "0.01em",
            }}
          >
            AI
          </span>
          <span
            style={{
              animation: "ai-blink 1s step-end infinite",
              color: "var(--color-accent)",
              fontSize: "10px",
              fontWeight: 700,
            }}
          >
            |
          </span>
          <button
            type="button"
            onClick={handleCancel}
            title="Cancel"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "14px",
              height: "14px",
              background: "transparent",
              border: "none",
              color: "var(--color-text-tertiary)",
              cursor: "pointer",
              padding: 0,
              marginLeft: "var(--spacing-xs)",
              transition: "color var(--transition-fast)",
            }}
          >
            <svg
              width="8"
              height="8"
              viewBox="0 0 8 8"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M1 1L7 7M7 1L1 7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

export const AIBlockOverlay = memo(AIBlockOverlayInternal);
