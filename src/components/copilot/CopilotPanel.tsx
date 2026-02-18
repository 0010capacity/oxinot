import { type PanelRect, useChatStore } from "@/stores/chatStore";
import { Z_INDEX } from "@/theme/tokens";
import { memo, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";
import { PanelHeader } from "./PanelHeader";

const MIN_WIDTH = 320;
const MIN_HEIGHT = 400;
const MAX_WIDTH = 800;
const MAX_HEIGHT = 900;

export const CopilotPanel = memo(function CopilotPanel() {
  const isOpen = useChatStore((s) => s.isOpen);
  const closePanel = useChatStore((s) => s.closePanel);
  const panelRect = useChatStore((s) => s.panelRect);
  const setPanelRect = useChatStore((s) => s.setPanelRect);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const sessionOrder = useChatStore((s) => s.sessionOrder);
  const createSession = useChatStore((s) => s.createSession);

  const panelRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startRect = useRef<PanelRect>({ width: 0, height: 0, x: 0, y: 0 });

  useEffect(() => {
    if (!isOpen) return;

    if (sessionOrder.length === 0 && !activeSessionId) {
      createSession();
    }
  }, [isOpen, sessionOrder.length, activeSessionId, createSession]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closePanel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closePanel]);

  const handleResizeStart = useCallback(
    (
      e: React.PointerEvent,
      direction: "se" | "sw" | "ne" | "nw" | "n" | "s" | "e" | "w",
    ) => {
      e.preventDefault();
      isResizing.current = true;
      startPos.current = { x: e.clientX, y: e.clientY };
      startRect.current = { ...panelRect };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (!isResizing.current) return;

        const deltaX = moveEvent.clientX - startPos.current.x;
        const deltaY = moveEvent.clientY - startPos.current.y;

        let newWidth = startRect.current.width;
        let newHeight = startRect.current.height;
        let newX = startRect.current.x;
        let newY = startRect.current.y;

        if (direction.includes("e")) {
          newWidth = Math.min(
            MAX_WIDTH,
            Math.max(MIN_WIDTH, startRect.current.width + deltaX),
          );
        }
        if (direction.includes("w")) {
          const potentialWidth = startRect.current.width - deltaX;
          if (potentialWidth >= MIN_WIDTH) {
            newWidth = potentialWidth;
            newX = startRect.current.x + deltaX;
          }
        }
        if (direction.includes("s")) {
          newHeight = Math.min(
            MAX_HEIGHT,
            Math.max(MIN_HEIGHT, startRect.current.height + deltaY),
          );
        }
        if (direction.includes("n")) {
          const potentialHeight = startRect.current.height - deltaY;
          if (potentialHeight >= MIN_HEIGHT) {
            newHeight = potentialHeight;
            newY = startRect.current.y + deltaY;
          }
        }

        setPanelRect({ width: newWidth, height: newHeight, x: newX, y: newY });
      };

      const handlePointerUp = () => {
        isResizing.current = false;
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
      };

      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
    },
    [panelRect, setPanelRect],
  );

  if (!isOpen) return null;

  const style: React.CSSProperties = {
    position: "fixed",
    bottom: "var(--spacing-lg)",
    right: "var(--spacing-lg)",
    display: "flex",
    flexDirection: "column",
    width: panelRect.width,
    height: panelRect.height,
    backgroundColor: "var(--color-bg-elevated)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-lg)",
    border: "1px solid var(--color-border-primary)",
    zIndex: Z_INDEX.popover,
    overflow: "hidden",
    transform:
      panelRect.x || panelRect.y
        ? `translate(${-panelRect.x}px, ${-panelRect.y}px)`
        : undefined,
  };

  const resizeHandleStyle: React.CSSProperties = {
    position: "absolute",
    backgroundColor: "transparent",
    zIndex: 10,
  };

  return createPortal(
    <div ref={panelRef} style={style}>
      <PanelHeader />

      <div
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {activeSessionId ? (
          <>
            <MessageList sessionId={activeSessionId} />
            <Composer sessionId={activeSessionId} />
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text-tertiary)",
              padding: "var(--spacing-lg)",
            }}
          >
            No active session
          </div>
        )}
      </div>

      <div
        style={{
          ...resizeHandleStyle,
          right: 0,
          bottom: 0,
          width: 16,
          height: 16,
          cursor: "se-resize",
        }}
        onPointerDown={(e) => handleResizeStart(e, "se")}
      />
      <div
        style={{
          ...resizeHandleStyle,
          left: 0,
          bottom: 0,
          width: 16,
          height: 16,
          cursor: "sw-resize",
        }}
        onPointerDown={(e) => handleResizeStart(e, "sw")}
      />
      <div
        style={{
          ...resizeHandleStyle,
          right: 0,
          top: 0,
          width: 16,
          height: 16,
          cursor: "ne-resize",
        }}
        onPointerDown={(e) => handleResizeStart(e, "ne")}
      />
      <div
        style={{
          ...resizeHandleStyle,
          left: 0,
          top: 0,
          width: 16,
          height: 16,
          cursor: "nw-resize",
        }}
        onPointerDown={(e) => handleResizeStart(e, "nw")}
      />
    </div>,
    document.body,
  );
});
