import { useFloatingPanelStore } from "@/stores/floatingPanelStore";
import { useEffect, useState } from "react";
import { isMacOS } from "../utils/platform";
import { NavigationButtons } from "./NavigationButtons";
import { WorkspacePicker } from "./WorkspacePicker";
import { Clock } from "./titleBar/Clock";
import { WindowControls } from "./titleBar/WindowControls";

interface TitleBarProps {
  currentWorkspacePath: string | null;
}

export function TitleBar({ currentWorkspacePath }: TitleBarProps) {
  const [isMac, setIsMac] = useState(false);
  const { isOpen, togglePanel } = useFloatingPanelStore();

  useEffect(() => {
    setIsMac(isMacOS());
  }, []);

  return (
    <div
      data-tauri-drag-region
      style={{
        height: "var(--layout-title-bar-height)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "var(--color-bg-primary)",
        userSelect: "none",
        WebkitUserSelect: "none",
        paddingLeft: isMac ? "80px" : "16px",
        paddingRight: "16px",
        position: "relative",
        zIndex: 100,
      }}
    >
      {/* Left - Navigation buttons */}
      <div
        data-tauri-drag-region
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          paddingLeft: "0px",
          height: "100%",
        }}
      >
        <NavigationButtons compact />
      </div>

      {/* Center - Workspace picker */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
        }}
      >
        <WorkspacePicker currentWorkspacePath={currentWorkspacePath} />
      </div>

      {/* Right section - Clock and AI button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <button
          type="button"
          onClick={togglePanel}
          aria-label={isOpen ? "Close AI panel" : "Open AI panel"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--spacing-xs)",
            backgroundColor: isOpen ? "var(--color-accent)" : "transparent",
            border: "none",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            color: isOpen ? "white" : "var(--color-text-secondary)",
            transition: "all var(--transition-fast)",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
              fill="currentColor"
            />
          </svg>
        </button>
        <Clock />

        {/* Window controls - only show on Windows/Linux */}
        <WindowControls show={!isMac} />
      </div>
    </div>
  );
}
