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
      pageId,
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
      blockId,
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
    },
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
  options: RenderOptions = {},
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
  const trimmed = source?.trim() ?? "";
  if (!trimmed) return "";

  // Check for block-level syntax that needs full rendering (headings, code fences, callouts)
  const hasBlockSyntax = /^(#{1,6}\s|```|> \[!)/.test(trimmed);

  const rawLines = source.split("\n");
  const hasMultipleLines = rawLines.length > 1;

  if (hasBlockSyntax && !hasMultipleLines) {
    // Single-line block syntax (heading, callout): full block rendering
    let html = renderMarkdownToHtml(source, { allowBlocks: true });
    html = html.replace(/^<p>([\s\S]*)<\/p>\n?$/i, "$1");
    html = html.replace(/\n+$/, "");
    return html;
  }

  if (!hasMultipleLines) {
    // Single line: inline rendering
    const html = renderMarkdownToHtml(source, { inline: true });
    return html.replace(/\n/g, "<br>");
  }

  // Multi-line content: group consecutive lines by type for correct HTML structure
  // Strategy: accumulate runs of list items / blockquotes / code-fence / text,
  // then flush each group as a proper block.
  type LineGroup =
    | { kind: "ul"; items: string[] }
    | { kind: "ol"; items: string[] }
    | { kind: "bq"; items: string[] }
    | { kind: "fence"; raw: string[] }
    | { kind: "heading"; level: number; content: string }
    | { kind: "blank" }
    | { kind: "text"; content: string };

  const groups: LineGroup[] = [];

  let inFence = false;
  let fenceLines: string[] = [];

  for (const line of rawLines) {
    // --- Code fence handling (must stay together) ---
    if (line.trim().startsWith("```")) {
      if (!inFence) {
        // Flush any open group first
        inFence = true;
        fenceLines = [line];
      } else {
        fenceLines.push(line);
        groups.push({ kind: "fence", raw: fenceLines });
        fenceLines = [];
        inFence = false;
      }
      continue;
    }
    if (inFence) {
      fenceLines.push(line);
      continue;
    }

    // --- Blank line ---
    if (line.trim() === "") {
      groups.push({ kind: "blank" });
      continue;
    }

    const lt = line.trim();

    // --- Heading ---
    const headingMatch = lt.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      groups.push({ kind: "heading", level: headingMatch[1].length, content: headingMatch[2] });
      continue;
    }

    // --- Blockquote ---
    if (lt.startsWith("> ")) {
      const last = groups[groups.length - 1];
      if (last?.kind === "bq") {
        last.items.push(lt.slice(2));
      } else {
        groups.push({ kind: "bq", items: [lt.slice(2)] });
      }
      continue;
    }

    // --- Unordered list ---
    const ulMatch = lt.match(/^[-*+]\s+(.+)$/);
    if (ulMatch) {
      const last = groups[groups.length - 1];
      if (last?.kind === "ul") {
        last.items.push(ulMatch[1]);
      } else {
        groups.push({ kind: "ul", items: [ulMatch[1]] });
      }
      continue;
    }

    // --- Ordered list ---
    const olMatch = lt.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      const last = groups[groups.length - 1];
      if (last?.kind === "ol") {
        last.items.push(olMatch[1]);
      } else {
        groups.push({ kind: "ol", items: [olMatch[1]] });
      }
      continue;
    }

    // --- Regular text ---
    groups.push({ kind: "text", content: lt });
  }

  // Flush an unclosed code fence
  if (inFence && fenceLines.length > 0) {
    groups.push({ kind: "fence", raw: fenceLines });
  }

  // Render each group to HTML
  const parts: string[] = [];
  for (const group of groups) {
    switch (group.kind) {
      case "heading": {
        const inner = renderMarkdownToHtml(group.content, { inline: true });
        parts.push(`<h${group.level}>${inner}</h${group.level}>`);
        break;
      }
      case "bq": {
        const inner = group.items
          .map((item) => `<p>${renderMarkdownToHtml(item, { inline: true })}</p>`)
          .join("");
        parts.push(`<blockquote>${inner}</blockquote>`);
        break;
      }
      case "ul": {
        const items = group.items
          .map((item) => `<li>${renderMarkdownToHtml(item, { inline: true })}</li>`)
          .join("");
        parts.push(`<ul>${items}</ul>`);
        break;
      }
      case "ol": {
        const items = group.items
          .map((item) => `<li>${renderMarkdownToHtml(item, { inline: true })}</li>`)
          .join("");
        parts.push(`<ol>${items}</ol>`);
        break;
      }
      case "fence": {
        const raw = group.raw.join("\n");
        let html = renderMarkdownToHtml(raw, { allowBlocks: true });
        html = html.replace(/\n+$/, "");
        parts.push(html);
        break;
      }
      case "blank": {
        // Blank line = paragraph break (thin spacer)
        parts.push('<div class="multiline-blank"></div>');
        break;
      }
      case "text": {
        const inner = renderMarkdownToHtml(group.content, { inline: true });
        parts.push(`<div class="multiline-text">${inner}</div>`);
        break;
      }
    }
  }

  return parts.join("");
}

export function renderOutlinerBracePreviewHtml(source: string): string {
  return renderMarkdownToHtml(source, { allowBlocks: true });
}
