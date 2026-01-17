import { Box, Stack } from "@mantine/core";
import type React from "react";
import { useMemo } from "react";
import QueryBlock from "../components/QueryBlock";
import { extractQueryMacros } from "../utils/queryParser";
import { useWorkspaceStore } from "../stores/workspaceStore";

interface MacroContentWrapperProps {
  content: string;
  blockId: string;
  isFocused: boolean;
  children: React.ReactNode;
  onEdit?: () => void;
}

/**
 * Wrapper component that detects {{}} query macros in block content
 * and renders QueryBlock components above the editor.
 *
 * When the block is focused (being edited), shows both QueryBlock and editor.
 * When unfocused, shows only QueryBlock results (hides the query text).
 */
export const MacroContentWrapper: React.FC<MacroContentWrapperProps> = ({
  content,
  blockId,
  isFocused,
  children,
  onEdit,
}) => {
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);

  // Extract query macros from content
  const queryMacros = useMemo(() => {
    if (!content) {
      return [];
    }
    return extractQueryMacros(content);
  }, [content]);

  // If no macros, just show children
  if (queryMacros.length === 0) {
    return <>{children}</>;
  }

  // If focused (editing), show both macros and editor
  if (isFocused) {
    return (
      <Stack gap={0}>
        {queryMacros.map((macroString, index) => (
          <QueryBlock
            key={`${blockId}-macro-${index}`}
            macroString={macroString}
            workspacePath={workspacePath || ""}
            onEdit={onEdit}
          />
        ))}
        <Box>{children}</Box>
      </Stack>
    );
  }

  // Not focused: show only macros, hide the query text (editor)
  if (workspacePath && queryMacros.length > 0) {
    return (
      <Stack gap={0}>
        {queryMacros.map((macroString, index) => (
          <QueryBlock
            key={`${blockId}-macro-${index}`}
            macroString={macroString}
            workspacePath={workspacePath}
            onEdit={onEdit}
          />
        ))}
      </Stack>
    );
  }

  return <>{children}</>;
};
