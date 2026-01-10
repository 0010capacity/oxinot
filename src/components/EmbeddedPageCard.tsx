import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { usePageStore, PageData } from "../stores/pageStore";
import { Editor } from "./Editor";
import { Box, Text, useMantineColorScheme } from "@mantine/core";
import { IconEdit, IconCopy } from "@tabler/icons-react";
import { showToast } from "../utils/toast";

interface EmbeddedBlock {
  id: string;
  parent_id: string | null;
  content: string;
  order_weight: number;
  is_collapsed: boolean;
}

interface EmbeddedPageCardProps {
  pageName: string;
  onNavigate?: (blockId: string) => void;
  onEdit?: () => void;
}

export const EmbeddedPageCard: React.FC<EmbeddedPageCardProps> = ({
  pageName,
  onNavigate,
  onEdit,
}) => {
  const [blocks, setBlocks] = useState<EmbeddedBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [pageId, setPageId] = useState<string | null>(null);
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";

  useEffect(() => {
    if (!workspacePath) {
      setError("No workspace selected");
      setLoading(false);
      return;
    }

    const fetchPageBlocks = async () => {
      try {
        setLoading(true);

        // Find page ID by name (supports folder paths like A/B/C)
        const { pagesById, pageIds } = usePageStore.getState();
        let foundPageId: string | null = null;

        // Helper to compute full path for a page
        const computePageFullPath = (id: string): string => {
          const path: string[] = [];
          let currentId: string | undefined = id;
          const visited = new Set<string>();

          while (currentId && !visited.has(currentId)) {
            visited.add(currentId);
            const currentPage: PageData | undefined = pagesById[currentId];
            if (!currentPage) break;
            path.unshift(currentPage.title);
            currentId = currentPage.parentId ?? undefined;
          }

          return path.join("/");
        };

        // Try to find page by exact title match or full path match
        for (const id of pageIds) {
          const page = pagesById[id];
          if (!page) continue;

          const fullPath = computePageFullPath(id);

          // Check if title matches or full path matches
          if (page.title === pageName || fullPath === pageName) {
            foundPageId = id;
            break;
          }
        }

        if (!foundPageId) {
          setError(`Page not found: ${pageName}`);
          setLoading(false);
          return;
        }

        setPageId(foundPageId);

        const res: any = await invoke("get_page_blocks", {
          workspacePath,
          pageId: foundPageId,
        });

        const fetchedBlocks: EmbeddedBlock[] = (res ?? []).map((b: any) => ({
          id: b.id,
          parent_id: b.parentId ?? b.parent_id ?? null,
          content: (b.content ?? "").toString(),
          order_weight: b.orderWeight ?? b.order_weight ?? 0,
          is_collapsed: !!(b.isCollapsed ?? b.is_collapsed),
        }));

        setBlocks(fetchedBlocks);
        setError(null);
      } catch (err) {
        console.error("Failed to load embedded page blocks", err);
        setError("Failed to load page");
      } finally {
        setLoading(false);
      }
    };

    void fetchPageBlocks();
  }, [pageName, workspacePath]);

  const handleCopyPageLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(`[[${pageName}]]`);
      showToast("Page reference copied", "success");
    } catch (err) {
      console.error("Failed to copy page link:", err);
      showToast("Failed to copy page reference", "error");
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.();
  };

  // Build lookup and children map
  const byId: Record<string, EmbeddedBlock> = {};
  for (const b of blocks) byId[b.id] = b;

  const childMap: Record<string, string[]> = { root: [] };
  for (const b of blocks) {
    const key = b.parent_id ?? "root";
    if (!childMap[key]) childMap[key] = [];
    childMap[key].push(b.id);
  }
  for (const key of Object.keys(childMap)) {
    childMap[key].sort((a, b) => {
      const ba = byId[a];
      const bb = byId[b];
      return (ba?.order_weight ?? 0) - (bb?.order_weight ?? 0);
    });
  }

  const renderBlock = (id: string, depth: number): React.ReactNode => {
    const block = byId[id];
    if (!block) return null;

    const children = childMap[id] ?? [];
    const hasChildren = children.length > 0;

    return (
      <Box key={id} style={{ display: "flex", flexDirection: "column" }}>
        <Box
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "flex-start",
            paddingLeft: `${depth * 20}px`,
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onNavigate?.(block.id);
            }}
            style={{
              opacity: 0.55,
              userSelect: "none",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 0,
              margin: 0,
              fontSize: "14px",
              lineHeight: "1.5",
              minWidth: "12px",
              textAlign: "center",
            }}
            title="Zoom to this block"
          >
            •
          </button>

          <Box style={{ flex: 1, minWidth: 0 }}>
            <Editor
              value={block.content}
              onChange={() => {
                // Read-only: no-op
              }}
              readOnly={true}
              lineNumbers={false}
              theme={colorScheme === "dark" ? "dark" : "light"}
              style={{
                fontSize: "14px",
                lineHeight: "1.5",
              }}
            />
          </Box>
        </Box>

        {/* Render children if not collapsed */}
        {!block.is_collapsed &&
          hasChildren &&
          children.map((childId) => renderBlock(childId, depth + 1))}
      </Box>
    );
  };

  if (loading) {
    return (
      <Box style={{ margin: "6px 0", opacity: 0.6 }}>
        <Text size="sm" c="dimmed">
          Loading page "{pageName}"…
        </Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box style={{ margin: "6px 0" }}>
        <Text size="sm" c="red">
          {error}: {pageName}
        </Text>
      </Box>
    );
  }

  if (blocks.length === 0) {
    return (
      <Box style={{ margin: "6px 0", opacity: 0.6 }}>
        <Text size="sm" c="dimmed">
          Empty page: {pageName}
        </Text>
      </Box>
    );
  }

  // Render root-level blocks
  const rootBlocks = childMap.root ?? [];
  return (
    <Box
      style={{
        margin: "6px 0",
        position: "relative",
        border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
        borderRadius: "8px",
        padding: "12px",
        backgroundColor: isDark
          ? "rgba(255, 255, 255, 0.02)"
          : "rgba(0, 0, 0, 0.01)",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Hover action buttons */}
      <Box
        style={{
          position: "absolute",
          top: "8px",
          right: "8px",
          display: "flex",
          gap: "6px",
          opacity: isHovered ? 1 : 0,
          transition: "opacity 120ms ease",
          pointerEvents: isHovered ? "auto" : "none",
        }}
      >
        <button
          type="button"
          onClick={handleCopyPageLink}
          title="Copy page reference"
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
          }}
        >
          <IconCopy size={14} stroke={1.5} />
        </button>
        <button
          type="button"
          onClick={handleEdit}
          title="Edit page"
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
          }}
        >
          <IconEdit size={14} stroke={1.5} />
        </button>
      </Box>

      {rootBlocks.map((blockId) => renderBlock(blockId, 0))}
    </Box>
  );
};
