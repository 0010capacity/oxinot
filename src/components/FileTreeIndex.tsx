import { useEffect, useState } from "react";
import {
  Stack,
  Text,
  Group,
  Loader,
  useMantineColorScheme,
} from "@mantine/core";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useViewStore } from "../stores/viewStore";
import { usePageStore } from "../stores/pageStore";

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  isMarkdown: boolean;
  children?: FileNode[];
}

export function FileTreeIndex() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";
  const { workspacePath, fileTree, loadDirectory } = useWorkspaceStore();
  const { openNote } = useViewStore();
  const { loadPages } = usePageStore();
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (workspacePath) {
      loadDirectory(workspacePath).finally(() => setLoading(false));
      loadPages();
    }
  }, [workspacePath, loadDirectory, loadPages]);

  useEffect(() => {
    if (fileTree.length > 0) {
      const buildTree = (items: typeof fileTree): FileNode[] => {
        return items.map((item) => ({
          name: item.name,
          path: item.path,
          isDirectory: item.is_directory,
          isMarkdown: item.is_file && item.name.endsWith(".md"),
        }));
      };
      setTree(buildTree(fileTree));
    }
  }, [fileTree]);

  const handleFileClick = (node: FileNode) => {
    if (node.isMarkdown) {
      const noteName = node.name.replace(".md", "");
      openNote(node.path, noteName);
    } else if (node.isDirectory) {
      loadDirectory(node.path);
    }
  };

  if (loading) {
    return (
      <Stack align="center" justify="center" h="100%">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          Loading workspace...
        </Text>
      </Stack>
    );
  }

  if (tree.length === 0) {
    return (
      <Stack align="center" justify="center" h="100%" p="xl">
        <Text size="sm" c="dimmed">
          No files found in workspace
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap={0} p="md">
      {tree.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          depth={0}
          onClick={handleFileClick}
          isDark={isDark}
        />
      ))}
    </Stack>
  );
}

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  onClick: (node: FileNode) => void;
  isDark: boolean;
}

function FileTreeNode({ node, depth, onClick, isDark }: FileTreeNodeProps) {
  const paddingLeft = depth * 24;

  return (
    <Group
      gap="xs"
      wrap="nowrap"
      style={{
        paddingLeft: `${paddingLeft}px`,
        paddingTop: "6px",
        paddingBottom: "6px",
        cursor: "pointer",
        borderRadius: "4px",
        transition: "background-color 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = isDark
          ? "rgba(255, 255, 255, 0.05)"
          : "rgba(0, 0, 0, 0.03)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
      onClick={() => onClick(node)}
    >
      <Text
        size="sm"
        style={{
          fontFamily: "monospace",
          fontSize: "18px",
          opacity: 0.4,
          userSelect: "none",
          width: "20px",
          textAlign: "center",
        }}
      >
        •
      </Text>
      <Text
        size="sm"
        style={{
          flex: 1,
          color: node.isMarkdown
            ? isDark
              ? "#4dabf7"
              : "#1c7ed6"
            : isDark
              ? "#e9ecef"
              : "#212529",
        }}
      >
        {node.isMarkdown ? node.name.replace(".md", "") : node.name}
      </Text>
    </Group>
  );
}
