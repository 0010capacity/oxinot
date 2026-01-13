import { IconEdit, IconTrash } from "@tabler/icons-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { type FileSystemItem, tauriAPI } from "../tauri-api";
import { ContextMenu, type ContextMenuSection } from "./common/ContextMenu";

interface FileTreeNodeProps {
  item: FileSystemItem;
  level: number;
  onFileClick: (path: string) => void;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({
  item,
  level,
  onFileClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [children, setChildren] = useState<FileSystemItem[]>([]);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const { deleteItem, renameItem } = useWorkspaceStore();

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const handleToggle = async () => {
    if (item.is_directory) {
      if (!isExpanded) {
        // Load children when expanding
        try {
          const items = await tauriAPI.readDirectory(item.path);
          setChildren(items);
        } catch (error) {
          console.error("Error loading children:", error);
        }
      }
      setIsExpanded(!isExpanded);
    } else if (item.is_file && item.name.endsWith(".md")) {
      onFileClick(item.path);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete ${item.name}?`)) {
      try {
        await deleteItem(item.path);
      } catch (error) {
        console.error("Error deleting item:", error);
      }
    }
  };

  const handleRename = () => {
    const currentName = item.name.replace(".md", "");
    setNewName(currentName);
    setIsRenaming(true);
  };

  const handleRenameSubmit = async () => {
    if (!newName.trim() || newName === item.name.replace(".md", "")) {
      setIsRenaming(false);
      return;
    }

    const finalName =
      item.is_file && !newName.endsWith(".md") ? `${newName}.md` : newName;

    try {
      await renameItem(item.path, finalName);
      setIsRenaming(false);
    } catch (error) {
      console.error("Error renaming item:", error);
      setIsRenaming(false);
    }
  };

  const handleRenameCancel = () => {
    setIsRenaming(false);
    setNewName("");
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      handleRenameCancel();
    }
  };

  const contextMenuSections: ContextMenuSection[] = [
    {
      items: [
        {
          label: "Rename",
          icon: <IconEdit size={16} />,
          onClick: handleRename,
        },
        {
          label: "Delete",
          icon: <IconTrash size={16} />,
          color: "red",
          onClick: () => {
            if (confirm(`Are you sure you want to delete ${item.name}?`)) {
              deleteItem(item.path).catch((error) => {
                console.error("Error deleting item:", error);
              });
            }
          },
        },
      ],
    },
  ];

  const isMarkdownFile = item.is_file && item.name.endsWith(".md");
  const showItem = item.is_directory || isMarkdownFile;

  if (!showItem) {
    return null;
  }

  return (
    <>
      <ContextMenu sections={contextMenuSections}>
        <div className="group/node relative">
          {item.is_directory && (
            <button
              type="button"
              className="absolute -left-6 top-1.5 p-0.5 opacity-0 group-hover/node:opacity-100 transition-opacity cursor-pointer text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 select-none z-10 border-0 bg-transparent"
              title={isExpanded ? "Collapse" : "Expand"}
              onClick={handleToggle}
            >
              <span className="material-symbols-outlined text-[18px]">
                {isExpanded ? "arrow_drop_down" : "arrow_right"}
              </span>
            </button>
          )}

          <div
            className={`flex items-start gap-2 py-1 -ml-2 pl-2 rounded-md hover:bg-surface-light dark:hover:bg-white/5 transition-colors pr-2 cursor-pointer ${
              item.is_directory ? "" : ""
            }`}
            onClick={handleToggle}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleToggle();
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="relative flex items-center justify-center h-6 w-6 shrink-0 cursor-pointer mt-0.5 group/bullet">
              {item.is_directory ? (
                <span className="material-symbols-outlined text-[18px] text-gray-500 dark:text-gray-400">
                  folder
                </span>
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-600 group-hover/bullet:bg-gray-600 dark:group-hover/bullet:bg-gray-400 transition-colors" />
              )}
            </div>

            {isRenaming ? (
              <input
                ref={renameInputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                onBlur={handleRenameSubmit}
                className="flex-1 min-w-0 px-2 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded outline-none focus:border-blue-500 dark:focus:border-blue-400 text-gray-800 dark:text-gray-200"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <div className="flex-1 min-w-0 break-words outline-none text-gray-800 dark:text-gray-200">
                  {item.name.replace(".md", "")}
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover/node:opacity-100 transition-opacity">
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-white/10 text-gray-400 hover:text-red-500 transition-colors"
                    title="Delete"
                    onClick={handleDelete}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      delete
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>

          {item.is_directory && isExpanded && children.length > 0 && (
            <div className="pl-6 ml-[11px] border-l border-gray-100 dark:border-white/5 flex flex-col mt-0.5">
              {children.map((child) => (
                <FileTreeNode
                  key={child.path}
                  item={child}
                  level={level + 1}
                  onFileClick={onFileClick}
                />
              ))}
            </div>
          )}
        </div>
      </ContextMenu>
    </>
  );
};

export const FileTreeView: React.FC = () => {
  const { workspacePath, fileTree, openFile, currentPath } =
    useWorkspaceStore();

  if (!workspacePath) {
    return null;
  }

  const pathParts = currentPath?.split("/") || [];
  const currentFolder = pathParts[pathParts.length - 1] || "Workspace";

  return (
    <div className="flex-1 flex flex-col items-center overflow-y-auto no-scrollbar pt-16 pb-32 px-4 sm:px-8">
      <div className="w-full max-w-3xl flex flex-col">
        <header className="mb-10 group">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-400 mb-4 select-none">
            <span className="hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer transition-colors">
              Workspace
            </span>
            <span className="material-symbols-outlined text-[10px]">
              chevron_right
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              {currentFolder}
            </span>
          </div>

          <h1 className="text-5xl font-bold tracking-tight text-gray-900 dark:text-white mb-2 outline-none">
            {currentFolder}
          </h1>

          <div className="text-sm text-gray-400 dark:text-gray-600 pl-1">
            File tree view
          </div>
        </header>

        <div className="flex flex-col w-full text-[15px] leading-6">
          {fileTree.map((item) => (
            <FileTreeNode
              key={item.path}
              item={item}
              level={0}
              onFileClick={openFile}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
