import MarkdownIt from "markdown-it";

/**
 * Markdown renderer for outliner block previews.
 *
 * Goals:
 * - Safe-ish by default: no raw HTML parsing
 * - Fast: single MarkdownIt instance reused
 * - Small surface area: render inline/ block content to HTML for preview layers
 *
 * Notes:
 * - This renderer is intended for "preview" DOM insertion using `dangerouslySetInnerHTML`.
 * - It disables HTML in MarkdownIt to avoid arbitrary HTML injection from user content.
 * - If you need richer rendering (task list checkboxes, etc.), add plugins here deliberately.
 */

export interface RenderOptions {
  /**
   * When true, renders in inline mode (no surrounding <p> wrapper in many cases).
   * Useful for one-line bullet blocks where you want compact previews.
   */
  inline?: boolean;

  /**
   * If provided, indents each line with N spaces before rendering.
   * Useful when rendering brace-block content that logically lives under an outliner level.
   */
  indentSpaces?: number;

  /**
   * When true, allow block-level markdown parsing even for "single line" blocks.
   *
   * This is important for outliner bullets because users will write things like:
   *   ## Heading
   * inside a bullet, and expect it to render as a heading.
   *
   * Default: false
   */
  allowBlocks?: boolean;
}

/**
 * Singleton MarkdownIt instance. Reuse avoids per-block allocations.
 */
const md = new MarkdownIt({
  html: false, // IMPORTANT: do not allow raw HTML (prevents easy XSS vectors)
  linkify: true,
  breaks: false,
  typographer: true,
});

/**
 * Escape HTML for plain text fallback. (markdown-it is already safe with html:false,
 * but this is useful if you ever choose to bypass rendering for empty/invalid cases.)
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Normalize newlines to `\n` and optionally indent each line.
 */
function normalizeInput(source: string, indentSpaces?: number): string {
  const normalized = source.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!indentSpaces || indentSpaces <= 0) return normalized;

  const indent = " ".repeat(indentSpaces);
  // Keep trailing newline behavior stable; don't add new lines out of nowhere.
  return normalized
    .split("\n")
    .map((line) => `${indent}${line}`)
    .join("\n");
}

/**
 * Render markdown to HTML.
 *
 * Intended usage in React:
 * - <div dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(text, { allowBlocks: true }) }} />
 */
export function renderMarkdownToHtml(
  source: string,
  options: RenderOptions = {},
): string {
  let input = normalizeInput(source ?? "", options.indentSpaces);

  // For empty blocks, return empty string (caller can show placeholder)
  if (input.trim().length === 0) return "";

  // If the caller wants block parsing, use md.render(). MarkdownIt will emit
  // proper block-level HTML (e.g., <h2> for "## ...") even if the source is
  // a single line.
  if (options.allowBlocks) {
    // Ensure headings/lists, etc. are parsed as blocks. A single line is fine,
    // but we normalize with a trailing newline so markdown-it consistently
    // treats it as a block document.
    if (!input.endsWith("\n")) input = `${input}\n`;
    return md.render(input);
  }

  if (options.inline) {
    // renderInline renders without wrapping block-level containers in many cases.
    // This means block markers like "##" won't become headings.
    return md.renderInline(input);
  }

  // Default block rendering
  if (!input.endsWith("\n")) input = `${input}\n`;
  return md.render(input);
}

/**
 * Convenience for outliner bullet blocks:
 * - render as block markdown so headings like "##" work even inside bullets
 */
export function renderOutlinerBulletPreviewHtml(source: string): string {
  return renderMarkdownToHtml(source, { allowBlocks: true });
}

/**
 * Convenience for brace blocks:
 * - multi-line markdown should render as full markdown (block mode)
 */
export function renderOutlinerBracePreviewHtml(source: string): string {
  return renderMarkdownToHtml(source, { allowBlocks: true });
}
