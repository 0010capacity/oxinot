import MarkdownIt from "markdown-it";

export interface RenderOptions {
  inline?: boolean;
  indentSpaces?: number;
  allowBlocks?: boolean;
}

// ============ Custom Syntax Plugins ============

function wikiLinkPlugin(md: MarkdownIt): void {
  md.inline.ruler.push("wiki_link", (state) => {
    if (state.src.charCodeAt(state.pos) !== 0x5b) return false;

    const max = state.posMax;
    if (state.pos + 4 >= max) return false;
    if (state.src.charCodeAt(state.pos + 1) !== 0x5b) return false;

    const labelStart = state.pos + 2;
    const labelEnd = state.src.indexOf("]]", labelStart);

    if (labelEnd === -1 || labelEnd >= max) return false;

    const label = state.src.slice(labelStart, labelEnd);
    if (label.length === 0) return false;

    const token = state.push("wiki_link_open", "span", 1);
    token.attrSet("class", "wiki-link");
    token.attrSet("data-page", label);
    token.content = label;

    state.push("text", "", 0).content = label;
    state.push("wiki_link_close", "span", -1);

    state.pos = labelEnd + 2;
    return true;
  });

  md.renderer.rules.wiki_link_open = (tokens, idx) => {
    const token = tokens[idx];
    const pageId = token.attrGet("data-page") || "";
    return `<a class="wiki-link" href="#page/${pageId}" data-page="${escapeHtml(
      pageId
    )}">`;
  };

  md.renderer.rules.wiki_link_close = () => {
    return "</a>";
  };
}

function blockRefPlugin(md: MarkdownIt): void {
  md.inline.ruler.push("block_ref", (state) => {
    if (state.src.charCodeAt(state.pos) !== 0x28) return false;

    const max = state.posMax;
    if (state.pos + 4 >= max) return false;
    if (state.src.charCodeAt(state.pos + 1) !== 0x28) return false;

    const refStart = state.pos + 2;
    const refEnd = state.src.indexOf("))", refStart);

    if (refEnd === -1 || refEnd >= max) return false;

    const ref = state.src.slice(refStart, refEnd);
    if (ref.length === 0) return false;

    const token = state.push("block_ref_open", "span", 1);
    token.attrSet("class", "block-ref");
    token.attrSet("data-block-id", ref);
    token.content = ref;

    state.push("text", "", 0).content = `((${ref}))`;
    state.push("block_ref_close", "span", -1);

    state.pos = refEnd + 2;
    return true;
  });

  md.renderer.rules.block_ref_open = (tokens, idx) => {
    const token = tokens[idx];
    const blockId = token.attrGet("data-block-id") || "";
    return `<a class="block-ref" href="#block/${blockId}" data-block-id="${escapeHtml(
      blockId
    )}">((`;
  };

  md.renderer.rules.block_ref_close = () => {
    return "))</a>";
  };
}

function calloutPlugin(md: MarkdownIt): void {
  md.block.ruler.push(
    "callout",
    (state, startLine, endLine) => {
      const pos = state.bMarks[startLine] + state.tShift[startLine];
      const maximum = state.eMarks[startLine];

      if (pos + 6 > maximum) return false;
      if (state.src.slice(pos, pos + 6) !== "> [!") return false;

      const firstLine = state.src.slice(pos, maximum);
      const match = firstLine.match(/^> \[!(\w+)\]/);
      if (!match) return false;

      const calloutType = match[1].toLowerCase();
      let nextLine = startLine + 1;

      while (nextLine < endLine) {
        if (
          state.bMarks[nextLine] + state.tShift[nextLine] >=
          state.eMarks[nextLine]
        ) {
          break;
        }
        nextLine++;
      }

      const oldLineMax = state.lineMax;
      state.lineMax = nextLine;

      const token = state.push("callout_open", "div", 1);
      token.attrSet("class", `callout callout-${calloutType}`);
      token.hidden = false;

      state.md.block.tokenize(state, startLine + 1, nextLine);

      state.push("callout_close", "div", -1);
      state.lineMax = oldLineMax;
      state.line = nextLine;

      return true;
    },
    {
      alt: ["paragraph", "reference", "blockquote", "list"],
    }
  );

  md.renderer.rules.callout_open = (tokens, idx) => {
    const token = tokens[idx];
    return `<div class="${token.attrGet("class") || ""}">`;
  };

  md.renderer.rules.callout_close = () => {
    return "</div>";
  };
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: true,
});

wikiLinkPlugin(md);
blockRefPlugin(md);
calloutPlugin(md);

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeInput(source: string, indentSpaces?: number): string {
  const normalized = source.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!indentSpaces || indentSpaces <= 0) return normalized;

  const indent = " ".repeat(indentSpaces);
  return normalized
    .split("\n")
    .map((line) => `${indent}${line}`)
    .join("\n");
}

export function renderMarkdownToHtml(
  source: string,
  options: RenderOptions = {}
): string {
  let input = normalizeInput(source ?? "", options.indentSpaces);

  if (input.trim().length === 0) return "";

  if (options.allowBlocks) {
    if (!input.endsWith("\n")) input = `${input}\n`;
    return md.render(input);
  }

  if (options.inline) {
    return md.renderInline(input);
  }

  if (!input.endsWith("\n")) input = `${input}\n`;
  return md.render(input);
}

export function renderOutlinerBulletPreviewHtml(source: string): string {
  // For single-line content without block elements, use inline rendering
  // to avoid wrapping in <p> tags which causes extra spacing
  const trimmed = source?.trim() ?? "";
  const hasMultipleLines = trimmed.includes("\n");
  const hasBlockSyntax = /^(#{1,6}\s|>\s|\d+\.\s|[-*+]\s|```|> \[!)/.test(
    trimmed
  );

  if (!hasMultipleLines && !hasBlockSyntax) {
    // Single line without block syntax: render inline (no <p> wrapper)
    return renderMarkdownToHtml(source, { inline: true });
  }

  return renderMarkdownToHtml(source, { allowBlocks: true });
}

export function renderOutlinerBracePreviewHtml(source: string): string {
  return renderMarkdownToHtml(source, { allowBlocks: true });
}
