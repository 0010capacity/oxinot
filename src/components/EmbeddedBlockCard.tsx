import { Box, Text, useComputedColorScheme } from "@mantine/core";
import { IconCopy, IconEdit } from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";
import type React from "react";
import { useEffect, useState } from "react";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { showToast } from "../utils/toast";
import { Editor } from "./Editor";
import "./EmbeddedBlockCard.css";

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
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const computedColorScheme = useComputedColorScheme("light");
  const isDark = computedColorScheme === "dark";

  useEffect(() => {
    if (!workspacePath) {
      setError("No workspace selected");
      setLoading(false);
      return;
    }

    const fetchSubtree = async () => {
      try {
        setLoading(true);
        const res = (await invoke("get_block_subtree", {
          workspacePath,
          request: { block_id: blockId, max_depth: 1000 },
        })) as Array<Record<string, unknown>>;

        const fetchedBlocks: EmbeddedBlock[] = (res ?? []).map((b) => ({
          id: String(b.id),
          parent_id:
            (b.parentId as string | null) ??
            (b.parent_id as string | null) ??
            null,
          content: (b.content ?? "").toString(),
          order_weight: Number(b.orderWeight ?? b.order_weight ?? 0),
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
      showToast({ message: "Block reference copied", type: "success" });
    } catch (err) {
      console.error("Failed to copy block ID:", err);
      showToast({ message: "Failed to copy block reference", type: "error" });
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
      <Box key={id} className="embedded-block-list">
        <Box
          className="embedded-block-item"
          style={{
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
            className="embedded-block-bullet"
            title="Zoom to this block"
          >
            •
          </button>

          <Box
            style={{ flex: 1, minWidth: 0, overflow: "hidden" }}
            className="embedded-editor-wrapper"
          >
            <Editor
              value={block.content}
              onChange={() => {
                // Read-only: no-op
              }}
              readOnly={true}
              lineNumbers={false}
              theme={isDark ? "dark" : "light"}
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
      <Box className="embedded-block-card-loading">
        <Text size="sm" c="dimmed">
          Loading…
        </Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box className="embedded-block-card-error">
        <Text size="sm" c="red">
          {error}
        </Text>
      </Box>
    );
  }

  return (
    <Box className="embedded-block-card">
      {/* Hover action buttons */}
      <Box className="embedded-block-card-actions">
        <button
          type="button"
          onClick={handleCopyBlockId}
          className="embedded-block-card-action-button"
          title="Copy block reference"
        >
          <IconCopy size={14} stroke={1.5} />
        </button>
        <button
          type="button"
          onClick={handleEdit}
          className="embedded-block-card-action-button"
          title="Edit block"
        >
          <IconEdit size={14} stroke={1.5} />
        </button>
      </Box>

      {renderBlock(blockId, 0)}
    </Box>
  );
};
