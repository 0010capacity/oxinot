import { useEffect, useState } from "react";
import { isMacOS } from "../utils/platform";
import { ActionIcons } from "./titleBar/ActionIcons";
import { WindowControls } from "./titleBar/WindowControls";
import { WorkspacePicker } from "./WorkspacePicker";

interface TitleBarProps {
  onSettingsClick: () => void;
  onSearchClick?: () => void;
  onHelpClick?: () => void;
  onCalendarClick?: () => void;
  currentWorkspacePath: string | null;
}

export function TitleBar({
  onSettingsClick,
  onSearchClick,
  onHelpClick,
  onCalendarClick,
  currentWorkspacePath,
}: TitleBarProps) {
  const [isMac, setIsMac] = useState(false);

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
        paddingLeft: isMac ? "78px" : "16px",
        paddingRight: "12px",
        position: "relative",
        zIndex: 100,
      }}
    >
      {/* Left spacer */}
      <div style={{ flex: 1 }} data-tauri-drag-region />

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

      {/* Right section - Control buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <ActionIcons
          onSettingsClick={onSettingsClick}
          onSearchClick={onSearchClick}
          onHelpClick={onHelpClick}
          onCalendarClick={onCalendarClick}
        />

        {/* Window controls - only show on Windows/Linux */}
        <WindowControls show={!isMac} />
      </div>
    </div>
  );
}
