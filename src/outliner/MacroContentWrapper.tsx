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
}

/**
 * Wrapper component that detects {{}} query macros in block content
 * and renders QueryBlock components above the editor.
 *
 * When the block is focused (being edited), only shows the editor.
 * When unfocused, shows QueryBlock results if macros are detected.
 */
export const MacroContentWrapper: React.FC<MacroContentWrapperProps> = ({
  content,
  blockId,
  isFocused,
  children,
}) => {
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);

  // Extract query macros from content
  const queryMacros = useMemo(() => {
    if (isFocused || !content) {
      return [];
    }
    return extractQueryMacros(content);
  }, [content, isFocused]);

  // Don't show macros while editing
  if (isFocused) {
    return <>{children}</>;
  }

  // Show macros above editor
  if (queryMacros.length > 0 && workspacePath) {
    return (
      <Stack gap={0}>
        {queryMacros.map((macroString, index) => (
          <QueryBlock
            key={`${blockId}-macro-${index}`}
            macroString={macroString}
            workspacePath={workspacePath}
          />
        ))}
        <Box>{children}</Box>
      </Stack>
    );
  }

  return <>{children}</>;
};
