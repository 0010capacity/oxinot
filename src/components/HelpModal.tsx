import { Box, Modal, ScrollArea } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import type { ReactNode } from "react";

interface HelpModalProps {
  opened: boolean;
  onClose: () => void;
}

export function HelpModal({ opened, onClose }: HelpModalProps) {
  const { t } = useTranslation();

  const sections = useMemo(
    () => [
      {
        title: t("help.welcome"),
        content: t("help.overview_title"),
        subsections: [
          {
            title: t("help.overview_title"),
            content: t("help.overview"),
          },
        ],
      },
      {
        title: t("help.getting_started"),
        subsections: [
          {
            title: t("help.selecting_workspace"),
            content: t("help.selecting_workspace_steps"),
          },
          {
            title: t("help.creating_first_note"),
            content: t("help.creating_first_note_steps"),
          },
        ],
      },
      {
        title: t("help.interface_overview"),
        subsections: [
          {
            title: t("help.title_bar"),
            content: t("help.title_bar_content"),
          },
          {
            title: t("help.file_tree"),
            content: t("help.file_tree_content"),
          },
          {
            title: t("help.block_editor"),
            content: t("help.block_editor_content"),
          },
        ],
      },
      {
        title: t("help.working_with_blocks"),
        subsections: [
          {
            title: t("help.creating_and_editing"),
            content: t("help.creating_and_editing_content"),
          },
          {
            title: t("help.formatting"),
            content: t("help.formatting_content"),
          },
          {
            title: t("help.navigation_within_blocks"),
            content: t("help.navigation_content"),
          },
          {
            title: t("help.block_organization"),
            content: t("help.block_organization_content"),
          },
          {
            title: t("help.block_actions"),
            content: t("help.block_actions_content"),
          },
        ],
      },
      {
        title: t("help.pages_and_organization"),
        subsections: [
          {
            title: t("help.creating_pages"),
            content: t("help.creating_pages_content"),
          },
          {
            title: t("help.page_hierarchy"),
            content: t("help.page_hierarchy_content"),
          },
          {
            title: t("help.page_features"),
            content: t("help.page_features_content"),
          },
        ],
      },
      {
        title: t("help.advanced_features"),
        subsections: [
          {
            title: t("help.wiki_links"),
            content: t("help.wiki_links_content"),
          },
          {
            title: t("help.query_blocks"),
            content: t("help.query_blocks_content"),
          },
          {
            title: t("help.embedded_content"),
            content: t("help.embedded_content_content"),
          },
          {
            title: t("help.block_metadata"),
            content: t("help.block_metadata_content"),
          },
          {
            title: t("help.graph_visualization"),
            content: t("help.graph_visualization_content"),
          },
          {
            title: t("help.daily_notes"),
            content: t("help.daily_notes_content"),
          },
        ],
      },
      {
        title: t("help.command_palette_title"),
        subsections: [
          {
            title: t("help.command_palette_title"),
            content: t("help.command_palette_content"),
          },
          {
            title: t("help.common_commands"),
            content: t("help.common_commands_content"),
          },
        ],
      },
      {
        title: t("help.search_title"),
        subsections: [
          {
            title: t("help.search_title"),
            content: t("help.search_content"),
          },
        ],
      },
      {
        title: t("help.settings_title"),
        subsections: [
          {
            title: t("help.settings_title"),
            content: t("help.settings_content"),
          },
        ],
      },
      {
        title: t("help.tips_and_tricks"),
        subsections: [
          {
            title: t("help.productivity_shortcuts"),
            content: t("help.productivity_shortcuts_content"),
          },
          {
            title: t("help.best_practices"),
            content: t("help.best_practices_content"),
          },
          {
            title: t("help.organization_patterns"),
            content: t("help.organization_patterns_content"),
          },
        ],
      },
      {
        title: t("help.data_and_privacy"),
        subsections: [
          {
            title: t("help.your_data_is_yours"),
            content: t("help.your_data_content"),
          },
          {
            title: t("help.backup_strategy"),
            content: t("help.backup_strategy_content"),
          },
        ],
      },
      {
        title: t("help.troubleshooting"),
        subsections: [
          {
            title: t("help.pages_not_loading"),
            content: t("help.pages_not_loading_content"),
          },
          {
            title: t("help.blocks_not_saving"),
            content: t("help.blocks_not_saving_content"),
          },
          {
            title: t("help.slow_performance"),
            content: t("help.slow_performance_content"),
          },
        ],
      },
      {
        title: t("help.keyboard_shortcuts_summary"),
        subsections: [
          {
            title: t("help.keyboard_shortcuts_summary"),
            content: t("help.shortcuts_table"),
          },
        ],
      },
    ],
    [t]
  );

  const parseMarkdown = (text: string): ReactNode => {
    // Parse inline markdown elements: **bold**, *italic*, `code`
    const parts: ReactNode[] = [];
    let lastIndex = 0;

    // Combined regex to match bold, italic, and code
    const regex = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // Add the matched element
      if (match[1]) {
        // Bold
        parts.push(
          <strong key={`bold-${match.index}`} style={{ fontWeight: 600 }}>
            {match[1]}
          </strong>
        );
      } else if (match[2]) {
        // Italic
        parts.push(
          <em key={`italic-${match.index}`} style={{ fontStyle: "italic" }}>
            {match[2]}
          </em>
        );
      } else if (match[3]) {
        // Code
        parts.push(
          <code
            key={`code-${match.index}`}
            style={{
              backgroundColor: "var(--color-bg-secondary)",
              padding: "2px 4px",
              borderRadius: "3px",
              fontFamily: "monospace",
              fontSize: "0.9em",
            }}
          >
            {match[3]}
          </code>
        );
      }

      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  const renderContent = (text: string) => {
    return text.split("\n").map((line, idx) => {
      if (line.startsWith("• ")) {
        return (
          <div
            key={idx}
            style={{ marginBottom: "0.5rem", paddingLeft: "1rem" }}
          >
            {parseMarkdown(line.substring(2))}
          </div>
        );
      }
      if (line.startsWith("1. ") || /^\d+\. /.test(line)) {
        const content = line.replace(/^\d+\.\s+/, "");
        return (
          <div
            key={idx}
            style={{ marginBottom: "0.5rem", paddingLeft: "1rem" }}
          >
            {parseMarkdown(content)}
          </div>
        );
      }
      if (line.startsWith("  - ")) {
        return (
          <div
            key={idx}
            style={{ marginBottom: "0.25rem", paddingLeft: "2.5rem" }}
          >
            {parseMarkdown(line.trim().substring(2))}
          </div>
        );
      }
      if (line.trim() === "") {
        return <div key={idx} style={{ height: "0.5rem" }} />;
      }
      return (
        <div key={idx} style={{ marginBottom: "0.5rem" }}>
          {parseMarkdown(line)}
        </div>
      );
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("help.title")}
      size="xl"
      styles={{
        title: {
          fontSize: "1.1rem",
          fontWeight: 600,
        },
        body: {
          padding: 0,
        },
      }}
    >
      <ScrollArea h={600} type="auto">
        <Box
          style={{
            padding: "20px 24px",
          }}
        >
          <div
            style={{
              color: "var(--color-text-secondary)",
              lineHeight: 1.6,
              fontSize: "0.95rem",
            }}
            className="help-content"
          >
            {/* Welcome Section */}
            <div style={{ marginBottom: "2rem" }}>
              <h1
                style={{
                  fontSize: "1.8rem",
                  fontWeight: 700,
                  marginBottom: "1rem",
                  color: "var(--color-text-primary)",
                }}
              >
                {t("help.welcome")}
              </h1>
              <p style={{ marginBottom: "1rem" }}>{t("help.overview")}</p>
            </div>

            {/* Main Sections */}
            {sections.map((section, idx) => (
              <div key={idx} style={{ marginBottom: "2rem" }}>
                <h2
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: 600,
                    marginBottom: "1rem",
                    color: "var(--color-text-primary)",
                    borderBottom: "1px solid var(--color-border-secondary)",
                    paddingBottom: "0.5rem",
                  }}
                >
                  {section.title}
                </h2>

                {section.subsections.map((subsection, subIdx) => (
                  <div key={subIdx} style={{ marginBottom: "1.5rem" }}>
                    <h3
                      style={{
                        fontSize: "1.1rem",
                        fontWeight: 600,
                        marginBottom: "0.75rem",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      {subsection.title}
                    </h3>
                    <div style={{ paddingLeft: "0.5rem" }}>
                      {renderContent(subsection.content)}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Box>
      </ScrollArea>

      <style>
        {`
          .help-content h1 {
            font-size: 1.8rem;
            font-weight: 700;
            margin-top: 0;
            margin-bottom: 1rem;
            color: var(--color-text-primary);
          }

          .help-content h2 {
            font-size: 1.4rem;
            font-weight: 600;
            margin-top: 2rem;
            margin-bottom: 1rem;
            color: var(--color-text-primary);
            border-bottom: 1px solid var(--color-border-secondary);
            padding-bottom: 0.5rem;
          }

          .help-content h3 {
            font-size: 1.1rem;
            font-weight: 600;
            margin-top: 1.5rem;
            margin-bottom: 0.75rem;
            color: var(--color-text-secondary);
          }

          .help-content p {
            margin-bottom: 1rem;
          }

          .help-content a {
            color: var(--color-text-link);
            text-decoration: none;
          }

          .help-content a:hover {
            text-decoration: underline;
          }
        `}
      </style>
    </Modal>
  );
}
