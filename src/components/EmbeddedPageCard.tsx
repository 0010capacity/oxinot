import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { usePageStore, PageData } from "../stores/pageStore";
import { Editor } from "./Editor";
import { Box, Text, useMantineColorScheme } from "@mantine/core";

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
}

export const EmbeddedPageCard: React.FC<EmbeddedPageCardProps> = ({
  pageName,
  onNavigate,
}) => {
  const [blocks, setBlocks] = useState<EmbeddedBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const { colorScheme } = useMantineColorScheme();

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
        let pageId: string | null = null;

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
            pageId = id;
            break;
          }
        }

        if (!pageId) {
          setError(`Page not found: ${pageName}`);
          setLoading(false);
          return;
        }

        const res: any = await invoke("get_page_blocks", {
          workspacePath,
          pageId,
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
    <Box style={{ margin: "6px 0" }}>
      {rootBlocks.map((blockId) => renderBlock(blockId, 0))}
    </Box>
  );
};
