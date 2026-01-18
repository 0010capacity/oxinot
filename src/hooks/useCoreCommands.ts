import {
  IconFile,
  IconFolderPlus,
  IconGitBranch,
  IconGitCommit,
  IconHelp,
  IconSearch,
  IconSettings,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useGitStore } from "../stores/gitStore";
import { usePageStore } from "../stores/pageStore";
import { useViewStore } from "../stores/viewStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useRegisterCommands, type Command } from "../stores/commandStore";
import React, { useMemo } from "react";

interface CoreCommandsOptions {
  onOpenSearch?: () => void;
  onOpenSettings?: () => void;
  onOpenHelp?: () => void;
  onClose?: () => void;
}

export function useCoreCommands(options: CoreCommandsOptions) {
  const { t } = useTranslation();
  const createPage = usePageStore((state) => state.createPage);
  const loadPages = usePageStore((state) => state.loadPages);
  const showPage = useViewStore((state) => state.showPage);
  const showIndex = useViewStore((state) => state.showIndex);
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);

  const gitCommit = useGitStore((state) => state.commit);
  const gitPush = useGitStore((state) => state.push);
  const gitPull = useGitStore((state) => state.pull);
  const checkGitStatus = useGitStore((state) => state.checkStatus);
  const hasChanges = useGitStore((state) => state.hasChanges);
  const isRepo = useGitStore((state) => state.isRepo);

  const coreCommands: Command[] = useMemo(() => {
    const cmds: Command[] = [
      // Navigation
      {
        id: "search",
        label: t("commands.search.label", "Search"),
        description: t(
          "commands.search.description",
          "Search pages and blocks",
        ),
        icon: React.createElement(IconSearch, { size: 16 }),
        action: () => {
          options.onClose?.();
          options.onOpenSearch?.();
        },
        keywords: ["find", "search", "query"],
        category: "Navigation",
        order: 10,
      },
      {
        id: "file-tree",
        label: t("commands.file_tree.label", "Go to File Tree"),
        description: t(
          "commands.file_tree.description",
          "Show workspace file tree",
        ),
        icon: React.createElement(IconFolderPlus, { size: 16 }),
        action: () => {
          options.onClose?.();
          showIndex();
        },
        keywords: ["tree", "files", "workspace", "home"],
        category: "Navigation",
        order: 20,
      },

      // Page actions
      {
        id: "new-page",
        label: t("commands.new_page.label", "New Page"),
        description: t("commands.new_page.description", "Create a new page"),
        icon: React.createElement(IconFile, { size: 16 }),
        action: async () => {
          options.onClose?.();
          try {
            const pageId = await createPage("Untitled");
            await loadPages();
            showPage(pageId);
          } catch (error) {
            console.error("Failed to create page:", error);
          }
        },
        keywords: ["create", "add", "note", "document"],
        category: "Actions",
        order: 10,
      },

      // Settings
      {
        id: "settings",
        label: t("commands.settings.label", "Settings"),
        description: t("commands.settings.description", "Open settings"),
        icon: React.createElement(IconSettings, { size: 16 }),
        action: () => {
          options.onClose?.();
          options.onOpenSettings?.();
        },
        keywords: ["preferences", "config", "options"],
        category: "App",
        order: 10,
      },
      {
        id: "help",
        label: t("commands.help.label", "Help"),
        description: t(
          "commands.help.description",
          "View help and documentation",
        ),
        icon: React.createElement(IconHelp, { size: 16 }),
        action: () => {
          options.onClose?.();
          options.onOpenHelp?.();
        },
        keywords: ["docs", "documentation", "guide"],
        category: "App",
        order: 20,
      },
    ];

    // Git actions (only if repo is initialized)
    if (isRepo) {
      cmds.push(
        {
          id: "git-commit",
          label: t("commands.git_commit.label", "Git: Commit Changes"),
          description: hasChanges
            ? t(
                "commands.git_commit.description_changes",
                "Commit current changes",
              )
            : t(
                "commands.git_commit.description_no_changes",
                "No changes to commit",
              ),
          icon: React.createElement(IconGitCommit, { size: 16 }),
          action: async () => {
            if (!workspacePath || !hasChanges) return;
            options.onClose?.();
            try {
              const message = prompt("Commit message:");
              if (message) {
                await gitCommit(workspacePath, message);
              }
            } catch (error) {
              console.error("Failed to commit:", error);
            }
          },
          keywords: ["git", "commit", "save", "version"],
          category: "Git",
          order: 10,
        },
        {
          id: "git-push",
          label: t("commands.git_push.label", "Git: Push"),
          description: t(
            "commands.git_push.description",
            "Push to remote repository",
          ),
          icon: React.createElement(IconGitBranch, { size: 16 }),
          action: async () => {
            if (!workspacePath) return;
            options.onClose?.();
            try {
              await gitPush(workspacePath);
            } catch (error) {
              console.error("Failed to push:", error);
              alert("Failed to push. Make sure you have a remote configured.");
            }
          },
          keywords: ["git", "push", "upload", "sync"],
          category: "Git",
          order: 20,
        },
        {
          id: "git-pull",
          label: t("commands.git_pull.label", "Git: Pull"),
          description: t(
            "commands.git_pull.description",
            "Pull from remote repository",
          ),
          icon: React.createElement(IconGitBranch, { size: 16 }),
          action: async () => {
            if (!workspacePath) return;
            options.onClose?.();
            try {
              await gitPull(workspacePath);
              await loadPages();
            } catch (error) {
              console.error("Failed to pull:", error);
              alert("Failed to pull. Make sure you have a remote configured.");
            }
          },
          keywords: ["git", "pull", "download", "sync", "fetch"],
          category: "Git",
          order: 30,
        },
        {
          id: "git-status",
          label: t("commands.git_status.label", "Git: Refresh Status"),
          description: t(
            "commands.git_status.description",
            "Check git repository status",
          ),
          icon: React.createElement(IconGitCommit, { size: 16 }),
          action: async () => {
            if (!workspacePath) return;
            options.onClose?.();
            await checkGitStatus(workspacePath);
          },
          keywords: ["git", "status", "refresh", "check"],
          category: "Git",
          order: 40,
        },
      );
    }

    return cmds;
  }, [
    isRepo,
    hasChanges,
    workspacePath,
    options,
    showIndex,
    createPage,
    loadPages,
    showPage,
    gitCommit,
    gitPush,
    gitPull,
    checkGitStatus,
    t,
  ]);

  useRegisterCommands(coreCommands);
}
