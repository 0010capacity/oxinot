import { useEffect, useState } from "react";
import { isMacOS } from "../utils/platform";
import { ActionIcons } from "./titleBar/ActionIcons";
import { WindowControls } from "./titleBar/WindowControls";

interface TitleBarProps {
  onSettingsClick: () => void;
  onWorkspaceChange: () => void;
  onSearchClick?: () => void;
  onHelpClick?: () => void;
  onCalendarClick?: () => void;
}

export function TitleBar({
  onSettingsClick,
  onWorkspaceChange,
  onSearchClick,
  onHelpClick,
  onCalendarClick,
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
      {/* Left spacer for macOS traffic lights - this area is reserved */}
      <div
        data-tauri-drag-region
        style={{
          flex: 1,
          height: "100%",
          display: "flex",
          alignItems: "center",
        }}
      />

      {/* Control buttons */}
      <ActionIcons
        onSettingsClick={onSettingsClick}
        onWorkspaceChange={onWorkspaceChange}
        onSearchClick={onSearchClick}
        onHelpClick={onHelpClick}
        onCalendarClick={onCalendarClick}
      />

      {/* Window controls - only show on Windows/Linux */}
      <WindowControls show={!isMac} />
    </div>
  );
}
