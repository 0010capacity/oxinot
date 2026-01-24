import { Box, useComputedColorScheme } from "@mantine/core";
import { IconCopy, IconEdit } from "@tabler/icons-react";
import type React from "react";
import { useState } from "react";
import { showToast } from "../utils/toast";

interface CodeBlockCardProps {
  code: string;
  language: string;
  onEdit?: () => void;
}

export const CodeBlockCard: React.FC<CodeBlockCardProps> = ({
  code,
  language,
  onEdit,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const computedColorScheme = useComputedColorScheme("light");
  const isDark = computedColorScheme === "dark";

  const handleCopyCode = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      showToast({ message: "Code copied", type: "success" });
    } catch (err) {
      console.error("[CodeBlockCard] Failed to copy code:", err);
      showToast({ message: "Failed to copy code", type: "error" });
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.();
  };

  return (
    <Box
      style={{
        display: "block",
        width: "100%",
        margin: "8px 0",
        position: "relative",
        border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.15)"}`,
        borderRadius: "8px",
        overflow: "hidden",
        backgroundColor: isDark
          ? "rgba(255, 255, 255, 0.05)"
          : "rgba(0, 0, 0, 0.03)",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {language && (
        <Box
          style={{
            padding: "8px 12px",
            background: isDark
              ? "rgba(255, 255, 255, 0.06)"
              : "rgba(0, 0, 0, 0.04)",
            borderBottom: `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
            fontSize: "12px",
            fontWeight: 500,
            opacity: 0.7,
            fontFamily: "var(--font-family)",
          }}
        >
          {language}
        </Box>
      )}

      <Box
        style={{
          position: "absolute",
          top: language ? "8px" : "8px",
          right: "8px",
          display: "flex",
          gap: "6px",
          opacity: isHovered ? 1 : 0,
          transition: "opacity 120ms ease",
          pointerEvents: "auto",
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={handleCopyCode}
          title="Copy code"
          style={{
            border: "none",
            background: isDark
              ? "rgba(255, 255, 255, 0.1)"
              : "rgba(0, 0, 0, 0.05)",
            color: isDark ? "rgba(255, 255, 255, 0.7)" : "rgba(0, 0, 0, 0.7)",
            borderRadius: "4px",
            padding: "4px",
            fontSize: "12px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "auto",
            position: "relative",
            zIndex: 11,
          }}
        >
          <IconCopy size={14} stroke={1.5} />
        </button>
        <button
          type="button"
          onClick={handleEdit}
          title="Edit code"
          style={{
            border: "none",
            background: isDark
              ? "rgba(255, 255, 255, 0.1)"
              : "rgba(0, 0, 0, 0.05)",
            color: isDark ? "rgba(255, 255, 255, 0.7)" : "rgba(0, 0, 0, 0.7)",
            borderRadius: "4px",
            padding: "4px",
            fontSize: "12px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "auto",
            position: "relative",
            zIndex: 11,
          }}
        >
          <IconEdit size={14} stroke={1.5} />
        </button>
      </Box>

      <Box
        style={{
          padding: "12px 16px",
          overflow: "auto",
          maxHeight: "500px",
        }}
      >
        <pre
          style={{
            margin: 0,
            fontFamily:
              "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace",
            fontSize: "13px",
            lineHeight: "1.6",
            whiteSpace: "pre",
            wordWrap: "normal",
          }}
        >
          <code>{code}</code>
        </pre>
      </Box>
    </Box>
  );
};
