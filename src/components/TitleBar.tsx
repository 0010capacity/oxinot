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

      {/* Right section - Clock only */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <Clock />

        {/* Window controls - only show on Windows/Linux */}
        <WindowControls show={!isMac} />
      </div>
    </div>
  );
}
