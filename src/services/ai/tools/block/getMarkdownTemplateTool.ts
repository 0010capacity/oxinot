import { z } from "zod";
import {
  getAllCategories,
  getTemplate,
  getTemplateNames,
  getTemplatesByCategory,
} from "../templates/markdownTemplates";
import type { Tool, ToolResult } from "../types";

export const getMarkdownTemplateTool: Tool = {
  name: "get_markdown_template",
  description:
    "Retrieve a pre-built markdown template by name or category. Templates include meeting notes, project planning, research, learning journals, and more. Use this when starting a new document or to get a structure to work from.",
  category: "block",
  requiresApproval: false,

  parameters: z.object({
    templateName: z
      .string()
      .optional()
      .describe(
        "Exact name of the template to retrieve (e.g., 'Meeting Notes', 'Project Planning'). If not provided, will list available templates.",
      ),
    category: z
      .string()
      .optional()
      .describe(
        "Filter templates by category (e.g., 'meetings', 'projects', 'research', 'learning'). Returns all templates in that category.",
      ),
  }),

  async execute(params): Promise<ToolResult> {
    try {
      if (params.templateName) {
        const template = getTemplate(params.templateName);
        if (!template) {
          return {
            success: false,
            error: `Template "${params.templateName}" not found. Available templates: ${getTemplateNames().join(", ")}`,
          };
        }

        return {
          success: true,
          data: {
            template: template,
            markdown: template.markdown,
          },
          metadata: {
            message: `Retrieved template: ${template.name}`,
            templateCount: 1,
          },
        };
      }

      if (params.category) {
        const categoryTemplates = getTemplatesByCategory(params.category);
        if (categoryTemplates.length === 0) {
          return {
            success: false,
            error: `No templates found in category "${params.category}". Available categories: ${getAllCategories().join(", ")}`,
          };
        }

        return {
          success: true,
          data: {
            templates: categoryTemplates,
            category: params.category,
          },
          metadata: {
            message: `Found ${categoryTemplates.length} template(s) in category "${params.category}"`,
            templateCount: categoryTemplates.length,
            templates: categoryTemplates.map((t) => t.name).join(", "),
          },
        };
      }

      const categories = getAllCategories();
      const templatesByCategory: Record<
        string,
        ReturnType<typeof getTemplatesByCategory>
      > = {};

      for (const cat of categories) {
        templatesByCategory[cat] = getTemplatesByCategory(cat);
      }

      return {
        success: true,
        data: {
          allTemplates: templatesByCategory,
          categories: categories,
        },
        metadata: {
          message: "Retrieved all available templates organized by category",
          templateCount: getTemplateNames().length,
          categoryCount: categories.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to retrieve template",
      };
    }
  },
};
