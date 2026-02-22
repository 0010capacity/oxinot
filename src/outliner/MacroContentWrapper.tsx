import { Stack } from "@mantine/core";
import type React from "react";
import { useMemo } from "react";
import QueryBlock from "../components/QueryBlock";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { extractQueryMacros, removeQueryMacros } from "../utils/queryParser";
import { StaticMarkdownRenderer } from "../components/StaticMarkdownRenderer";
import { removeStatusPrefix } from "../types/todo";

interface MacroContentWrapperProps {
  content: string;
  blockId: string;
  isFocused: boolean;
  children: React.ReactNode;
  onEdit?: () => void;
  onMouseDownCapture?: (e: React.MouseEvent) => void;
}

/**
 * Wrapper component that detects {{}} query macros in block content
 * and renders QueryBlock components alongside the markdown content.
 *
 * When the block is focused (being edited), shows only the editor (hides QueryBlock).
 * When unfocused:
 *   - Renders markdown content (with macros removed)
 *   - Renders QueryBlock results below the content
 */
export const MacroContentWrapper: React.FC<MacroContentWrapperProps> = ({
  content,
  blockId,
  isFocused,
  children,
  onEdit,
  onMouseDownCapture,
}) => {
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);

  const queryMacros = useMemo(() => {
    if (!content) {
      return [];
    }
    return extractQueryMacros(content);
  }, [content]);

  const contentWithoutMacros = useMemo(() => {
    if (!content) {
      return "";
    }
    return removeQueryMacros(content);
  }, [content]);

  // If focused (editing), show only editor - hide everything else
  if (isFocused) {
    return <>{children}</>;
  }

  // Not focused: show markdown content + QueryBlock results
  return (
    <Stack gap={0}>
      {contentWithoutMacros && (
        <StaticMarkdownRenderer
          content={removeStatusPrefix(contentWithoutMacros)}
          onMouseDownCapture={onMouseDownCapture}
          style={{}}
        />
      )}
      {workspacePath &&
        queryMacros.map((macroString) => (
          <QueryBlock
            key={`${blockId}-macro-${macroString}`}
            macroString={macroString}
            workspacePath={workspacePath}
            onEdit={onEdit}
          />
        ))}
    </Stack>
  );
};

MacroContentWrapper.displayName = "MacroContentWrapper";
