import { useEffect, useState } from "react";
import { useMantineColorScheme } from "@mantine/core";
import { useBlockStore } from "../stores/blockStore";
import { Editor } from "../components/Editor";

interface BlockEditorProps {
  pageId: string;
}

export function BlockEditor({ pageId }: BlockEditorProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";

  const loadPage = useBlockStore((state) => state.loadPage);
  const createBlock = useBlockStore((state) => state.createBlock);
  const updateBlockContent = useBlockStore((state) => state.updateBlockContent);
  const isLoading = useBlockStore((state) => state.isLoading);
  const error = useBlockStore((state) => state.error);
  const blocksById = useBlockStore((state) => state.blocksById);
  const childrenMap = useBlockStore((state) => state.childrenMap);

  const [markdownContent, setMarkdownContent] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);

  // Load page blocks
  useEffect(() => {
    if (pageId) {
      loadPage(pageId).then(() => {
        setIsInitialized(true);
      });
    }
  }, [pageId, loadPage]);

  // Convert blocks to markdown when blocks change
  useEffect(() => {
    if (!isInitialized || isLoading) return;

    const markdown = blocksToMarkdown(blocksById, childrenMap);
    setMarkdownContent(markdown);
  }, [blocksById, childrenMap, isInitialized, isLoading]);

  // Auto-create first block if page is empty
  useEffect(() => {
    if (!isLoading && !error && isInitialized && pageId) {
      const rootBlocks = childrenMap["root"] || [];
      const hasBlocks = rootBlocks.length > 0;

      if (!hasBlocks) {
        createBlock(null, "").catch((err) => {
          console.error("Failed to create initial block:", err);
        });
      }
    }
  }, [isLoading, error, isInitialized, pageId, childrenMap, createBlock]);

  const handleMarkdownChange = (content: string) => {
    setMarkdownContent(content);

    // Simple update: just update first block with content for now
    const rootBlocks = childrenMap["root"] || [];
    if (rootBlocks.length > 0) {
      const firstBlockId = rootBlocks[0];
      updateBlockContent(firstBlockId, content).catch(console.error);
    }
  };

  if (isLoading && !isInitialized) {
    return (
      <div
        style={{
          padding: "16px",
          opacity: 0.5,
          color: isDark ? "#909296" : "#868e96",
        }}
      >
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "16px", color: "#fa5252" }}>Error: {error}</div>
    );
  }

  return (
    <div style={{ height: "100%", overflow: "hidden" }}>
      <Editor
        value={markdownContent}
        onChange={handleMarkdownChange}
        theme={isDark ? "dark" : "light"}
        lineNumbers={false}
        lineWrapping={true}
      />
    </div>
  );
}

// Convert blocks tree to markdown outline format
function blocksToMarkdown(
  blocksById: Record<string, any>,
  childrenMap: Record<string, string[]>,
): string {
  const lines: string[] = [];

  function traverse(parentId: string | null, depth: number) {
    const key = parentId ?? "root";
    const childIds = childrenMap[key] ?? [];

    for (const id of childIds) {
      const block = blocksById[id];
      if (block) {
        const indent = "  ".repeat(depth);
        const bullet = "- ";
        const content = block.content || "";
        lines.push(`${indent}${bullet}${content}`);

        if (!block.isCollapsed) {
          traverse(id, depth + 1);
        }
      }
    }
  }

  traverse(null, 0);
  return lines.join("\n");
}
