import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspaceStore } from "../stores/workspaceStore";
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

interface EmbeddedBlockCardProps {
  blockId: string;
  onNavigate?: (blockId: string) => void;
  onEdit?: () => void;
}

export const EmbeddedBlockCard: React.FC<EmbeddedBlockCardProps> = ({
  blockId,
  onNavigate,
  onEdit,
}) => {
  const [blocks, setBlocks] = useState<EmbeddedBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";

  useEffect(() => {
    if (!workspacePath) {
      setError("No workspace selected");
      setLoading(false);
      return;
    }

    const fetchSubtree = async () => {
      try {
        setLoading(true);
        const res: any = await invoke("get_block_subtree", {
          workspacePath,
          request: { block_id: blockId, max_depth: 1000 },
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
        console.error("Failed to load embedded block subtree", err);
        setError("Failed to load embed");
      } finally {
        setLoading(false);
      }
    };

    void fetchSubtree();
  }, [blockId, workspacePath]);

  const handleCopyBlockId = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(`((${blockId}))`);
      showToast("Block reference copied", "success");
    } catch (err) {
      console.error("Failed to copy block ID:", err);
      showToast("Failed to copy block reference", "error");
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
          Loading…
        </Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box style={{ margin: "6px 0" }}>
        <Text size="sm" c="red">
          {error}
        </Text>
      </Box>
    );
  }

  return (
    <Box
      style={{
        margin: "0",
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
          pointerEvents: "auto",
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={handleCopyBlockId}
          title="Copy block reference"
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
          title="Edit block"
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

      {renderBlock(blockId, 0)}
    </Box>
  );
};
