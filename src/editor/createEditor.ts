import {
  type Completion,
  type CompletionContext,
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  closeCompletion,
  completionKeymap,
  startCompletion,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import {
  HighlightStyle,
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { searchKeymap } from "@codemirror/search";
import { EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  type KeyBinding,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  tooltips,
} from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";

import { useBlockStore } from "../stores/blockStore";
import { usePageStore } from "../stores/pageStore";
import { useViewStore } from "../stores/viewStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import {
  hybridRenderingPlugin,
  hybridRenderingTheme,
  isFocusedCompartment,
  isFocusedFacet,
} from "./extensions/hybridRendering";

type EmbedNavigateDetail = { blockId?: string };

/**
 * Custom syntax highlighting style using CSS variables
 * This replaces CodeMirror's defaultHighlightStyle to ensure all syntax colors
 * respect our theme system instead of using hardcoded colors like #219
 */
const customHighlightStyle = HighlightStyle.define([
  // Use tertiary text color for markdown meta/punctuation (fence markers, etc.)
  { tag: t.meta, color: "var(--color-text-tertiary)" },
  { tag: t.punctuation, color: "var(--color-text-tertiary)" },

  // Use secondary text color for other syntax elements
  { tag: t.keyword, color: "var(--color-text-secondary)" },
  { tag: t.string, color: "var(--color-text-secondary)" },
  { tag: t.number, color: "var(--color-text-secondary)" },
  { tag: t.atom, color: "var(--color-text-secondary)" },
  { tag: t.variableName, color: "var(--color-text-secondary)" },
  { tag: t.propertyName, color: "var(--color-text-secondary)" },
  { tag: t.operator, color: "var(--color-text-secondary)" },
  { tag: t.bracket, color: "var(--color-text-secondary)" },

  // Use primary text color for regular content
  { tag: t.content, color: "var(--color-text-primary)" },

  // Comments use tertiary color
  { tag: t.comment, color: "var(--color-text-tertiary)" },

  // Headings use primary with bold
  { tag: t.heading, color: "var(--color-text-primary)", fontWeight: "bold" },

  // Links use accent color
  { tag: t.link, color: "var(--color-accent)" },
  { tag: t.url, color: "var(--color-accent)" },

  // Emphasis
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "bold" },
]);

/**
 * Editor configuration options
 */
export interface EditorConfig {
  doc?: string;
  onChange?: (doc: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  readOnly?: boolean;
  lineWrapping?: boolean;
  theme?: "light" | "dark";

  /**
   * Optional handler for Obsidian-style wiki links ([[...]]). If not provided,
   * the editor will attempt to navigate using the app stores by ensuring any
   * folder path (e.g., [[A/B/C]]) exists as folder-notes and then opening/creating
   * the final note. Breadcrumbs will be updated accordingly.
   */
  onOpenWikiLink?: (raw: string, noteTitle: string) => void;

  /**
   * Enable wiki-link autocompletion: when typing `[[`, show live suggestions.
   * Pressing Enter will insert the selected suggestion (typically the full path).
   *
   * Default: true
   */
  enableWikiLinkAutocomplete?: boolean;

  /**
   * Enable block-link + embed autocompletion:
   * - Typing `((` shows block suggestions, Enter inserts the selected block UUID.
   * - Typing `!((` shows block suggestions, Enter inserts embed syntax with UUID.
   *
   * Default: true
   */
  enableBlockLinkAutocomplete?: boolean;

  /**
   * Whether to show line numbers in the gutter.
   * Defaults to true for the full editor, but can be disabled for embedded editors (e.g., outliner blocks).
   */
  lineNumbers?: boolean;

  /**
   * Optional additional key bindings to add on top of the defaults.
   * Useful for per-block outliner behaviors (e.g., Enter to split block).
   *
   * These bindings are prepended so they take precedence over defaults.
   */
  keybindings?: KeyBinding[];

  /**
   * Whether this editor should be treated as focused for rendering purposes.
   * Used to control markdown marker visibility in outliner blocks.
   */
  isFocused?: boolean;
}

/**
 * Create basic editor extensions
 */
function createBasicExtensions(config: EditorConfig): Extension[] {
  const extensions: Extension[] = [];

  // Line numbers (optional)
  if (config.lineNumbers !== false) {
    extensions.push(lineNumbers(), highlightActiveLineGutter());
  }

  extensions.push(
    // History (undo/redo)
    history(),

    // Markdown language support with GFM extensions
    markdown({
      base: markdownLanguage,
      codeLanguages: [],
    }),

    // Syntax highlighting with custom style using CSS variables
    syntaxHighlighting(customHighlightStyle),

    // Auto-indent
    indentOnInput(),

    // Bracket matching
    bracketMatching(),

    // Auto-close brackets
    closeBrackets(),

    // Keymaps (prepend user bindings so they override defaults)
    keymap.of([
      // Autocomplete keymap (Enter, Arrows, Esc) must take precedence over
      // outliner keybindings so the dropdown can be navigated when open.
      ...completionKeymap,

      ...(config.keybindings ?? []),

      // Force insert Space to bypass any blockers (completion keymap, IME artifacts, etc)
      {
        key: "Space",
        run: (view) => {
          view.dispatch(view.state.replaceSelection(" "));
          return true;
        },
      },

      // Custom backspace handler for [[ ]], (( )), ![[  ]], !(( )) pairs
      {
        key: "Backspace",
        run: (view) => {
          const state = view.state;
          const selection = state.selection.main;

          // Only handle when selection is empty (cursor)
          if (!selection.empty) return false;

          const pos = selection.head;
          const doc = state.doc.toString();

          // Check for ![[  ]] pair (embed) - check longest patterns first
          if (pos >= 3 && pos + 2 <= doc.length) {
            const before = doc.slice(pos - 3, pos);
            const after = doc.slice(pos, pos + 2);

            if (before === "![[" && after === "]]") {
              view.dispatch({
                changes: { from: pos - 3, to: pos + 2, insert: "" },
              });
              return true;
            }

            if (before === "!((" && after === "))") {
              view.dispatch({
                changes: { from: pos - 3, to: pos + 2, insert: "" },
              });
              return true;
            }
          }

          // Check for ![[  or !(( without closing brackets
          if (pos >= 3) {
            const before3 = doc.slice(pos - 3, pos);

            if (before3 === "![[" || before3 === "!((") {
              view.dispatch({
                changes: { from: pos - 3, to: pos, insert: "" },
              });
              return true;
            }
          }

          // Check for [[ ]] pair (cursor between brackets)
          if (pos >= 2 && pos + 2 <= doc.length) {
            const before = doc.slice(pos - 2, pos);
            const after = doc.slice(pos, pos + 2);

            if (before === "[[" && after === "]]") {
              view.dispatch({
                changes: { from: pos - 2, to: pos + 2, insert: "" },
              });
              return true;
            }

            if (before === "((" && after === "))") {
              view.dispatch({
                changes: { from: pos - 2, to: pos + 2, insert: "" },
              });
              return true;
            }
          }

          // Check for [[ or (( without closing brackets
          if (pos >= 2) {
            const before2 = doc.slice(pos - 2, pos);

            if (before2 === "[[" || before2 === "((") {
              view.dispatch({
                changes: { from: pos - 2, to: pos, insert: "" },
              });
              return true;
            }
          }

          return false;
        },
      },

      // Debug: allow inspecting the completion tooltip without it auto-closing while you click around.
      // - Cmd/Ctrl+Alt+K: toggle "pin completion open" mode (stores flag on the DOM for quick access)
      // - Cmd/Ctrl+Alt+J: force-open completion
      // - Cmd/Ctrl+Alt+H: close completion
      {
        key: "Mod-Alt-k",
        run: (view) => {
          const dom = view.dom as HTMLElement & {
            __pinCompletionOpen?: boolean;
          };
          dom.__pinCompletionOpen = !dom.__pinCompletionOpen;
          if (dom.__pinCompletionOpen) {
            startCompletion(view);
          } else {
            closeCompletion(view);
          }
          return true;
        },
      },
      {
        key: "Mod-Alt-j",
        run: (view) => {
          startCompletion(view);
          return true;
        },
      },
      {
        key: "Mod-Alt-h",
        run: (view) => {
          closeCompletion(view);
          return true;
        },
      },

      // Filter out Tab from defaultKeymap to allow block indentation
      ...defaultKeymap.filter(
        (binding) => binding.key !== "Tab" && binding.key !== "Shift-Tab",
      ),
      ...historyKeymap,
      ...closeBracketsKeymap,
      ...searchKeymap,
    ]),
  );

  // Line wrapping
  if (config.lineWrapping !== false) {
    extensions.push(EditorView.lineWrapping);
  }

  // Read-only mode
  if (config.readOnly) {
    extensions.push(EditorState.readOnly.of(true));
  }

  return extensions;
}

/**
 * Create update listener extension
 */
function createUpdateListener(onChange?: (doc: string) => void): Extension {
  return EditorView.updateListener.of((update) => {
    if (update.docChanged && onChange) {
      const newDoc = update.state.doc.toString();
      onChange(newDoc);
    }
  });
}

function normalizeWikiTitle(input: string): string {
  return (input ?? "").trim().replace(/\s+/g, " ");
}

function extractBlockRefAtLinePos(
  lineText: string,
  offsetInLine: number,
): { id: string; isEmbed: boolean } | null {
  // Match:
  // - ((uuid))
  // - !((uuid))
  const re = /(!)?\(\(([^\)\s]+)\)\)/g;
  let m: RegExpExecArray | null = re.exec(lineText);

  while (m !== null) {
    const full = m[0];
    const start = m.index;
    const end = start + full.length;
    if (offsetInLine < start || offsetInLine > end) {
      m = re.exec(lineText);
      continue;
    }

    const id = (m[2] ?? "").trim();
    if (!id) return null;

    return { id, isEmbed: !!m[1] };
  }

  return null;
}

async function navigateToBlockById(blockId: string): Promise<void> {
  const id = (blockId ?? "").trim();
  if (!id) return;

  const workspacePath = useWorkspaceStore.getState().workspacePath;
  if (!workspacePath) return;

  // Ask backend for the block + its ancestor chain (for zoomPath),
  // so we can navigate without guessing based on currently loaded page.
  let blockWithPath: {
    block: { pageId: string };
    ancestorIds: string[];
  } | null = null;
  try {
    blockWithPath = await invoke("get_block", {
      workspacePath,
      request: { block_id: id },
    });
  } catch {
    blockWithPath = null;
  }
  if (!blockWithPath?.block) return;

  const pageStore = usePageStore.getState();
  const viewStore = useViewStore.getState();
  const blockStore = useBlockStore.getState();

  // Ensure pages exist for breadcrumb calculation
  if (pageStore.pageIds.length === 0) {
    try {
      await pageStore.loadPages();
    } catch {
      // ignore
    }
  }

  const pageId = blockWithPath.block.pageId as string;
  const pagesById = usePageStore.getState().pagesById;
  const page = pagesById[pageId];
  if (!page) return;

  // Build parent path for page breadcrumb
  const parentNames: string[] = [];
  const pagePathIds: string[] = [];
  let currentParentId: string | undefined = page.parentId;

  while (currentParentId) {
    const parent = pagesById[currentParentId];
    if (!parent) break;
    parentNames.unshift(parent.title);
    pagePathIds.unshift(parent.id);
    currentParentId = parent.parentId;
  }
  pagePathIds.push(page.id);

  // Open the page
  pageStore.setCurrentPageId(page.id);
  pageStore.selectPage(page.id);
  await blockStore.loadPage(page.id);
  viewStore.openNote(page.id, page.title, parentNames, pagePathIds);

  // Zoom to the referenced block
  const ancestorIds: string[] = Array.isArray(blockWithPath.ancestorIds)
    ? blockWithPath.ancestorIds
    : [];
  useViewStore.setState({
    focusedBlockId: id,
    zoomPath: ancestorIds.length ? ancestorIds : [id],
  });
}

function createEmbedNavigateEventHandler(): Extension {
  return EditorView.domEventHandlers({
    "cm-embed-navigate": (event) => {
      const custom = event as CustomEvent<EmbedNavigateDetail>;
      const blockId = custom.detail?.blockId;
      if (!blockId) return false;

      // Read-only embed widget dispatches this event; we navigate the main app view.
      void navigateToBlockById(blockId);

      event.preventDefault();
      event.stopPropagation();
      return true;
    },
  });
}

function createBlockRefClickHandler(): Extension {
  const handleClick = (event: MouseEvent, view: EditorView) => {
    // Only handle left clicks
    if (event.button !== 0) return false;

    const target = event.target as HTMLElement | null;
    if (!target) return false;

    const el = target.closest?.(
      ".cm-block-ref, .cm-block-embed",
    ) as HTMLElement | null;
    if (!el) return false;

    event.preventDefault();
    event.stopPropagation();

    // Prefer a direct id when the preview widget attaches it to its outer span.
    // NOTE: Sometimes the click target is a nested node (text node wrapper, etc.),
    // so we also try to find the attribute on the nearest ancestor within the token.
    const directId =
      el.getAttribute("data-block-id") ||
      el.closest?.("[data-block-id]")?.getAttribute("data-block-id") ||
      (el as HTMLElement).dataset?.blockId ||
      (el as HTMLElement).dataset?.blockid ||
      "";
    if (directId) {
      void navigateToBlockById(directId);
      return true;
    }

    // Fallback: resolve block id by parsing the underlying doc around the click position.
    const pos = view.posAtDOM(el);
    if (pos == null) return true;

    const line = view.state.doc.lineAt(pos);
    const lineText = line.text;
    const offsetInLine = Math.max(
      0,
      Math.min(pos - line.from, lineText.length),
    );

    const ref = extractBlockRefAtLinePos(lineText, offsetInLine);
    if (!ref) return true;

    void navigateToBlockById(ref.id);
    return true;
  };

  return EditorView.domEventHandlers({
    mousedown: handleClick,
    click: handleClick,
  });
}

function getWikiLinkQueryAtPos(
  doc: string,
  cursorPos: number,
): { from: number; to: number; query: string; isEmbed: boolean } | null {
  // Detect an in-progress wiki link like:
  // - `[[que`  (no closing ]])
  // - `![[que` (embed)
  //
  // Return the replacement range for the query portion (after `[[`) and the query string.
  const before = doc.slice(0, cursorPos);
  const open = before.lastIndexOf("[[");
  if (open < 0) return null;

  // If we already closed the link before cursor, don't suggest.
  const closed = before.lastIndexOf("]]");
  if (closed > open) return null;

  const from = open + 2;
  const to = cursorPos;

  // Extract current query (after [[ up to cursor), stop at newline
  const raw = doc.slice(from, to);
  if (raw.includes("\n")) return null;

  // If user typed alias separator or heading anchor, only complete the note path portion.
  const query = raw.split("|")[0].split("#")[0];

  // Determine embed by checking immediately preceding character of "[["
  const isEmbed = open > 0 && before[open - 1] === "!";

  return { from, to, query: normalizeWikiTitle(query), isEmbed };
}

function getParensLinkQueryAtPos(
  doc: string,
  cursorPos: number,
): { from: number; to: number; query: string; isEmbed: boolean } | null {
  // Detect in-progress block reference:
  // - `((query` -> normal link
  // - `!((query` -> embed
  // Return replacement range for the query portion (after `((`) and the query string.
  const before = doc.slice(0, cursorPos);

  const open = before.lastIndexOf("((");
  if (open < 0) return null;

  // If we already closed the link before cursor, don't suggest.
  const closed = before.lastIndexOf("))");
  if (closed > open) return null;

  // Avoid matching something like "((\n"
  const from = open + 2;
  const to = cursorPos;

  const raw = doc.slice(from, to);
  if (raw.includes("\n")) return null;

  // Determine embed by checking immediately preceding character of "(("
  const isEmbed = open > 0 && before[open - 1] === "!";

  return { from, to, query: normalizeWikiTitle(raw), isEmbed };
}

type PageRecord = { id: string; title: string; parentId?: string };

function computePageFullPathTitles(
  pageId: string,
  pagesById: Record<string, PageRecord>,
): string[] {
  const out: string[] = [];
  let cur: string | undefined = pageId;
  const visited = new Set<string>();

  while (cur) {
    if (visited.has(cur)) break;
    visited.add(cur);

    const p: PageRecord | undefined = pagesById[cur];
    if (!p) break;

    out.unshift(p.title);
    cur = p.parentId;
  }

  return out;
}

function buildWikiPathForPage(
  pageId: string,
  pagesById: Record<string, PageRecord>,
): string {
  return computePageFullPathTitles(pageId, pagesById).join("/");
}

function createUnifiedLinkAutocomplete(): Extension {
  const wikiSource = async (context: CompletionContext) => {
    const state = context.state;
    const cursor = state.selection.main.head;
    const doc = state.doc.toString();

    const info = getWikiLinkQueryAtPos(doc, cursor);
    if (!info) return null;

    const { from, to, query, isEmbed } = info;

    // Load pages if needed (best-effort; we keep UI responsive)
    const pageStore = usePageStore.getState();
    if (pageStore.pageIds.length === 0) {
      try {
        await pageStore.loadPages();
      } catch {
        // ignore - fall through with empty suggestions
      }
    }

    const { pagesById, pageIds } = usePageStore.getState();

    const q = query.trim();

    const options: Completion[] = [];

    for (const id of pageIds) {
      const p = pagesById[id];
      if (!p) continue;

      const fullPath = buildWikiPathForPage(id, pagesById);
      const label = p.title;
      const lowerLabel = (label ?? "").toLowerCase();
      const lowerFull = (fullPath ?? "").toLowerCase();

      if (!q || lowerLabel.includes(q) || lowerFull.includes(q)) {
        options.push({
          label, // what the user sees in the list
          detail: fullPath !== label ? fullPath : undefined, // show full path as detail
          type: "text",
          apply: (
            view: EditorView,
            _completion: Completion,
            fromPos: number,
            toPos: number,
          ) => {
            const state = view.state;
            const currentDoc = state.doc.toString();

            if (isEmbed) {
              const insert = `![[${fullPath}]]`;
              // Replace the whole "![[query" region including the existing "[[",
              // by expanding replacement to include the optional leading "!".
              const openPos = Math.max(0, fromPos - 2); // points to "[[" start
              const bangPos = openPos > 0 ? openPos - 1 : openPos;
              const hasBang = bangPos >= 0 && currentDoc[bangPos] === "!";
              const replaceFrom = hasBang ? bangPos : openPos;

              // Check if closing ]] already exists after cursor
              let replaceTo = toPos;
              if (currentDoc.slice(toPos, toPos + 2) === "]]") {
                replaceTo = toPos + 2;
              }

              const cursorPos = replaceFrom + insert.length;
              view.dispatch({
                changes: { from: replaceFrom, to: replaceTo, insert },
                selection: { anchor: cursorPos, head: cursorPos },
              });
              return;
            }

            // Normal [[...]] link: replace entire [[query]] including brackets
            const insert = `[[${fullPath}]]`;
            const openPos = Math.max(0, fromPos - 2); // points to "[[" start

            // Check if closing ]] already exists after cursor
            let replaceTo = toPos;
            if (currentDoc.slice(toPos, toPos + 2) === "]]") {
              replaceTo = toPos + 2;
            }

            const cursorPos = openPos + insert.length;
            view.dispatch({
              changes: { from: openPos, to: replaceTo, insert },
              selection: { anchor: cursorPos, head: cursorPos },
            });
          },
        });
      }
    }

    // Sort: prefer prefix match on basename/title, then shorter paths
    options.sort((a, b) => {
      const aL = a.label.toLowerCase();
      const bL = b.label.toLowerCase();
      const aStarts = q ? aL.startsWith(q) : false;
      const bStarts = q ? bL.startsWith(q) : false;
      if (aStarts !== bStarts) return aStarts ? -1 : 1;

      const aD = (a.detail ?? a.label).length;
      const bD = (b.detail ?? b.label).length;
      if (aD !== bD) return aD - bD;

      return aL.localeCompare(bL);
    });

    return {
      from,
      to,
      options,
      validFor: /^[^\\]\n]*$/,
    };
  };

  const blockSource = async (context: CompletionContext) => {
    const state = context.state;
    const cursor = state.selection.main.head;
    const doc = state.doc.toString();

    const info = getParensLinkQueryAtPos(doc, cursor);
    if (!info) return null;

    const { from, to, query, isEmbed } = info;
    const q = query.trim();

    // Show suggestions immediately after typing `((` / `!((` (empty query).
    // Without at least one option, CodeMirror may choose not to open the panel,
    // which makes block-link autocomplete look "broken" until the user types more.
    if (!q) {
      return {
        from,
        to,
        options: [
          {
            label: "Start typing to search blocks…",
            detail: isEmbed ? "Embed syntax: !((…))" : "Link syntax: ((…))",
            type: "text",
            apply: (
              _view: EditorView,
              _completion: Completion,
              _fromPos: number,
              _toPos: number,
            ) => {
              // No-op placeholder; user should keep typing.
            },
          },
        ],
        validFor: /^[^\\)\n]*$/,
      };
    }

    // Query backend for block suggestions. We show content + breadcrumb-like path,
    // but we insert the UUID into (()) or !(()).
    const workspacePath = useWorkspaceStore.getState().workspacePath;

    let results: { id: string; content: string; full_path: string }[] = [];
    try {
      if (workspacePath) {
        results = await invoke("search_blocks", {
          workspacePath,
          request: { query: q, limit: 50 },
        });
      } else {
        results = [];
      }
    } catch {
      results = [];
    }

    const options: Completion[] = results.map((r) => {
      const label = (r.content ?? "").toString();
      const detail = (r.full_path ?? "").toString();

      return {
        label,
        detail: detail && detail !== label ? detail : undefined,
        type: "text",
        apply: (
          view: EditorView,
          _completion: Completion,
          fromPos: number,
          toPos: number,
        ) => {
          const state = view.state;
          const currentDoc = state.doc.toString();
          const id = (r.id ?? "").toString();

          // If embed, replace the whole "!((query" (or "((query") region including the existing "((",
          // by expanding replacement to include the optional leading "!".
          if (isEmbed) {
            const insert = `!((${id}))`;
            const openPos = Math.max(0, fromPos - 2); // points to "((" start
            const bangPos = openPos > 0 ? openPos - 1 : openPos;
            const hasBang = bangPos >= 0 && currentDoc[bangPos] === "!";
            const replaceFrom = hasBang ? bangPos : openPos;

            // Check if closing )) already exists after cursor
            let replaceTo = toPos;
            if (currentDoc.slice(toPos, toPos + 2) === "))") {
              replaceTo = toPos + 2;
            }

            const cursorPos = replaceFrom + insert.length;
            view.dispatch({
              changes: { from: replaceFrom, to: replaceTo, insert },
              selection: { anchor: cursorPos, head: cursorPos },
            });
            return;
          }

          // Normal (()) link: replace the "((query" region including the opening "((" with the wrapped UUID.
          const insert = `((${id}))`;
          const openPos = Math.max(0, fromPos - 2); // points to "((" start

          // Check if closing )) already exists after cursor
          let replaceTo = toPos;
          if (currentDoc.slice(toPos, toPos + 2) === "))") {
            replaceTo = toPos + 2;
          }

          const cursorPos = openPos + insert.length;
          view.dispatch({
            changes: { from: openPos, to: replaceTo, insert },
            selection: { anchor: cursorPos, head: cursorPos },
          });
        },
      };
    });

    return {
      from,
      to,
      options,
      validFor: /^[^\\)\n]*$/,
    };
  };

  return autocompletion({
    // NOTE: `override` cannot be merged across multiple autocompletion() instances.
    // Keep exactly one autocompletion extension and combine sources here to avoid:
    // "Config merge conflict for field override"
    override: [wikiSource, blockSource],
    defaultKeymap: false, // Disable default keymap to prevent Space from closing completion
    activateOnTyping: true,

    // Render the tooltip into a fixed-position portal so it can't be clipped by
    // the app's rounded root container (overflow: hidden).
    //
    // This is critical for block editors because #root has overflow: hidden.
    tooltipClass: () => "md-autocomplete-tooltip",
    optionClass: () => "md-autocomplete-option",
  });
}

function splitWikiPathSegments(input: string): string[] {
  // Folder-style wiki links: [[A/B/C]] where each segment is a folder-note/page.
  // Normalize whitespace per segment and remove empties.
  return (input ?? "")
    .split("/")
    .map((s) => normalizeWikiTitle(s))
    .filter((s) => s.length > 0);
}

function parseWikiLinkTarget(raw: string): { noteTitle: string } | null {
  // Support:
  // - [[note]]
  // - [[note|alias]]
  // - [[note#heading]]
  // - [[note#^block-id]]
  // - [[A/B/C]] (folder-style path where parents must exist as folder-notes)
  //
  // Navigation target is the note title/path segment (before | or #)
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  const beforeAlias = trimmed.split("|")[0] ?? "";
  const beforeAnchor = beforeAlias.split("#")[0] ?? "";
  const noteTitle = normalizeWikiTitle(beforeAnchor);

  if (!noteTitle) return null;
  return { noteTitle };
}

async function openOrCreateNoteByTitle(noteTitle: string): Promise<void> {
  const rawTitleOrPath = normalizeWikiTitle(noteTitle);
  if (!rawTitleOrPath) return;

  const pageStore = usePageStore.getState();
  const viewStore = useViewStore.getState();
  const blockStore = useBlockStore.getState();

  // Ensure pages are loaded (needed for reliable folder chain + breadcrumb building)
  if (pageStore.pageIds.length === 0) {
    try {
      await pageStore.loadPages();
    } catch {
      // If load fails, fall through; create/convert/open may still throw.
    }
  }

  const targetSegments = splitWikiPathSegments(rawTitleOrPath);
  const isPath = targetSegments.length >= 2;

  // Find existing page by (title + optional parent) match
  const findExisting = (
    title: string,
    parentId: string | null,
    pagesById: typeof pageStore.pagesById,
    pageIds: string[],
  ): string | null => {
    const t = title.toLowerCase();
    for (const id of pageIds) {
      const p = pagesById[id];
      if (!p) continue;
      if ((p.title ?? "").toLowerCase() !== t) continue;
      const pid = p.parentId ?? null;
      if (pid === parentId) return p.id;
    }
    return null;
  };

  // Ensure a folder-note exists (and isDirectory=true). Return its pageId.
  const ensureFolderNote = async (
    folderTitle: string,
    parentId: string | null,
  ): Promise<string> => {
    // Re-read state each time to avoid stale copies after loadPages()
    let { pagesById, pageIds } = usePageStore.getState();
    let existingId = findExisting(folderTitle, parentId, pagesById, pageIds);

    if (!existingId) {
      existingId = await pageStore.createPage(
        folderTitle,
        parentId ?? undefined,
      );
      await pageStore.loadPages();
      ({ pagesById, pageIds } = usePageStore.getState());
    }

    const existing = pagesById[existingId];
    if (!existing) return existingId;

    if (!existing.isDirectory) {
      // Folder notes are directories in this app: convert so children live under it.
      await pageStore.convertToDirectory(existingId);
      await pageStore.loadPages();
    }

    return existingId;
  };

  // If it's a folder path, ensure chain A -> B -> ... exists as folder-notes.
  let parentId: string | null = null;

  if (isPath) {
    for (let i = 0; i < targetSegments.length - 1; i++) {
      const seg = targetSegments[i];
      parentId = await ensureFolderNote(seg, parentId);
    }
  }

  // Now ensure/open the final note under the resolved parentId (or root).
  const finalTitle = isPath
    ? targetSegments[targetSegments.length - 1]
    : rawTitleOrPath;

  let { pagesById, pageIds } = usePageStore.getState();
  let pageId = findExisting(finalTitle, parentId, pagesById, pageIds);

  if (!pageId) {
    pageId = await pageStore.createPage(finalTitle, parentId ?? undefined);
    await pageStore.loadPages();
    ({ pagesById, pageIds } = usePageStore.getState());
  } else {
    // Keep state fresh for breadcrumb calculation below
    ({ pagesById } = usePageStore.getState());
  }

  const page = pagesById[pageId];
  if (!page) return;

  // Build parent path for breadcrumb:
  // workspace > parent chain > current page
  const parentNames: string[] = [];
  const pagePathIds: string[] = [];

  let currentParentId: string | undefined = page.parentId;
  while (currentParentId) {
    const parent = pagesById[currentParentId];
    if (!parent) break;
    parentNames.unshift(parent.title);
    pagePathIds.unshift(parent.id);
    currentParentId = parent.parentId;
  }
  pagePathIds.push(page.id);

  // Select + load + open (breadcrumb updated via openNote)
  pageStore.setCurrentPageId(page.id);
  pageStore.selectPage(page.id);
  await blockStore.loadPage(page.id);
  viewStore.openNote(page.id, page.title, parentNames, pagePathIds);
}

function createWikiLinkClickHandler(
  onOpenWikiLink?: (raw: string, noteTitle: string) => void,
): Extension {
  const handleClick = (event: MouseEvent, view: EditorView) => {
    // Only handle left clicks
    if (event.button !== 0) return false;

    const target = event.target as HTMLElement | null;
    if (!target) return false;

    const el = target.closest?.(".cm-wiki-link") as HTMLElement | null;
    if (!el) return false;

    // Prevent CM selection changes + browser default behaviors
    event.preventDefault();
    event.stopPropagation();

    const pos = view.posAtDOM(el);
    if (pos == null) return true;

    // Find the containing line and locate the wiki link around this position.
    const line = view.state.doc.lineAt(pos);
    const lineText = line.text;

    // We need to compute the position within the line.
    const offsetInLine = Math.max(
      0,
      Math.min(pos - line.from, lineText.length),
    );

    // Scan for wiki links in this line and pick the match that contains the click position.
    const wikiLinkRegex = /\[\[([^\]|]+)(\|([^\]]+))?\]\]/g;
    let match: RegExpExecArray | null = wikiLinkRegex.exec(lineText);
    let clickedRaw: string | null = null;

    while (match !== null) {
      const full = match[0];
      const start = match.index;
      const end = start + full.length;
      if (offsetInLine >= start && offsetInLine <= end) {
        clickedRaw = match[1] ?? "";
        break;
      }
      match = wikiLinkRegex.exec(lineText);
    }

    if (!clickedRaw) return true;

    const parsed = parseWikiLinkTarget(clickedRaw);
    if (!parsed) return true;

    if (onOpenWikiLink) {
      onOpenWikiLink(clickedRaw, parsed.noteTitle);
      return true;
    }

    // Default behavior:
    // - If target is folder-style (A/B/C), ensure A and B exist as folder-notes (directories)
    // - Create/open C under that chain
    // - Update breadcrumbs correctly
    void openOrCreateNoteByTitle(parsed.noteTitle);
    return true;
  };

  return EditorView.domEventHandlers({
    mousedown: handleClick,
    click: handleClick,
  });
}

function normalizeExternalUrl(rawUrl: string): string | null {
  const url = rawUrl.trim();
  if (!url) return null;
  if (url.startsWith("#")) return null;

  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("mailto:") ||
    url.startsWith("tel:")
  ) {
    return url;
  }

  if (/^[^\s/]+\.[^\s/]+/.test(url)) {
    return `https://${url}`;
  }

  return null;
}

function createExternalLinkClickHandler(): Extension {
  const handleClick = (event: MouseEvent, view: EditorView) => {
    // Only handle left clicks
    if (event.button !== 0) return false;

    const target = event.target as HTMLElement | null;
    if (!target) return false;

    const el = target.closest?.(".cm-link-text") as HTMLElement | null;
    if (!el) return false;

    // Prevent CM selection changes + browser default behaviors
    event.preventDefault();
    event.stopPropagation();

    const pos = view.posAtDOM(el);
    if (pos == null) return true;

    const line = view.state.doc.lineAt(pos);
    const lineText = line.text;

    const offsetInLine = Math.max(
      0,
      Math.min(pos - line.from, lineText.length),
    );

    const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null = linkRegex.exec(lineText);
    let clickedUrl: string | null = null;

    while (match !== null) {
      const full = match[0];
      const start = match.index;
      const end = start + full.length;
      if (offsetInLine >= start && offsetInLine <= end) {
        clickedUrl = match[2] ?? "";
        break;
      }
      match = linkRegex.exec(lineText);
    }

    const normalizedUrl = clickedUrl ? normalizeExternalUrl(clickedUrl) : null;
    if (!normalizedUrl) return true;

    open(normalizedUrl).catch((error) => {
      console.error("Failed to open external link:", error);
    });
    return true;
  };

  return EditorView.domEventHandlers({
    mousedown: handleClick,
    click: handleClick,
  });
}

/**
 * Create focus/blur listener extensions
 */
function createFocusListeners(
  onFocus?: () => void,
  onBlur?: () => void,
): Extension[] {
  const extensions: Extension[] = [];

  if (onFocus) {
    extensions.push(
      EditorView.domEventHandlers({
        focus: () => {
          onFocus();
          return false;
        },
      }),
    );
  }

  if (onBlur) {
    extensions.push(
      EditorView.domEventHandlers({
        blur: () => {
          onBlur();
          return false;
        },
      }),
    );
  }

  return extensions;
}

/**
 * Creates a mousedown handler that immediately sets cursor position
 * when clicking on an unfocused editor, avoiding the delay from
 * React state updates and useEffect cycles.
 */
function createMouseDownHandler(): Extension {
  return EditorView.domEventHandlers({
    mousedown: (event, view) => {
      // Prevent CodeMirror from selecting text on right-click
      if (event.button === 2) {
        event.preventDefault();
        return true; // Stop CodeMirror from handling this
      }

      // Only handle clicks on unfocused editors
      if (view.hasFocus) {
        return false; // Let CodeMirror handle normally
      }

      // Get cursor position from click coordinates
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });

      if (pos != null) {
        // Immediately set cursor position
        view.dispatch({
          selection: { anchor: pos, head: pos },
        });

        // Focus the editor
        view.focus();

        // Let the event propagate naturally
        return false;
      }

      return false;
    },
    contextmenu: (event) => {
      // Prevent CodeMirror from creating selection on contextmenu
      event.preventDefault();
      return true; // Stop CodeMirror from handling this
    },
  });
}

/**
 * Create base editor theme
 */
function createEditorTheme(theme: "light" | "dark" = "light"): Extension {
  const isDark = theme === "dark";

  return EditorView.theme(
    {
      "&": {
        height: "100%",
        fontSize: "var(--block-font-size)",
        backgroundColor: "var(--color-bg-primary)",
        color: "var(--color-text-primary)",
      },
      ".cm-content": {
        fontFamily: "var(--font-family)",
        caretColor: "var(--color-text-primary)",
      },
      ".cm-line": {
        lineHeight: "var(--block-line-height)",
      },
      ".cm-gutters": {
        backgroundColor: "var(--color-bg-elevated)",
        color: "var(--color-text-tertiary)",
        border: "none",
        paddingLeft: "8px",
      },
      ".cm-activeLineGutter": {
        backgroundColor: "var(--color-interactive-hover)",
      },
      ".cm-activeLine": {
        backgroundColor: "var(--color-interactive-hover)",
      },
      ".cm-selectionBackground, ::selection": {
        backgroundColor: "var(--color-interactive-selected)",
      },
      ".cm-focused .cm-selectionBackground, .cm-focused ::selection": {
        backgroundColor: "var(--color-interactive-selected)",
      },
      ".cm-cursor": {
        borderLeftColor: "var(--color-text-primary)",
      },
      "&.cm-focused": {
        outline: "none",
      },
      ".cm-scroller": {
        overflow: "auto",
        fontFamily: "var(--font-family)",
      },
    },
    { dark: isDark },
  );
}

/**
 * Create a CodeMirror 6 editor instance with hybrid rendering
 */
export function createEditor(
  parent: HTMLElement,
  config: EditorConfig = {},
): EditorView {
  const extensions: Extension[] = [
    // Basic extensions
    ...createBasicExtensions(config),

    // Editor theme
    createEditorTheme(config.theme),

    // Unified link autocompletion (wiki links + block refs) to avoid CodeMirror
    // config merge conflicts caused by multiple autocompletion({ override: ... }) instances.
    ...(config.enableWikiLinkAutocomplete === false &&
    config.enableBlockLinkAutocomplete === false
      ? []
      : [createUnifiedLinkAutocomplete()]),

    // Click navigation for block-ref tokens rendered in live preview
    createBlockRefClickHandler(),

    // Embed widget navigation events (bubble from widget DOM)
    createEmbedNavigateEventHandler(),

    // Configure tooltip behavior so autocomplete panels are not clipped by
    // scroll/overflow containers in the app layout.
    //
    // - position: "fixed" makes tooltip placement independent of ancestor overflow/scroll.
    // - parent: document.body ensures tooltips aren't constrained by editor wrappers.
    //
    // NOTE: In non-browser environments, `document` might not exist. This code is only
    // executed when creating an editor view in the browser/webview runtime.
    tooltips({
      position: "fixed",
      parent: document.body,
    }),

    // Hybrid rendering (live preview)
    // Default focus: false (unfocused) → markers hidden, content rendered
    // Updated dynamically when user clicks/focuses blocks
    isFocusedCompartment.of(isFocusedFacet.of(config.isFocused ?? false)),
    hybridRenderingPlugin,
    hybridRenderingTheme,

    // Wiki link click navigation
    createWikiLinkClickHandler(config.onOpenWikiLink),

    // External markdown link click navigation
    createExternalLinkClickHandler(),

    // Mousedown handler for immediate cursor positioning on unfocused editors
    createMouseDownHandler(),

    // Update listener
    createUpdateListener(config.onChange),

    // Focus/blur listeners
    ...createFocusListeners(config.onFocus, config.onBlur),
  ];

  const state = EditorState.create({
    doc: config.doc || "",
    extensions,
  });

  const view = new EditorView({
    state,
    parent,
  });

  return view;
}

/**
 * Update editor content without recreating the view
 */
export function updateEditorContent(view: EditorView, newDoc: string): void {
  const currentDoc = view.state.doc.toString();

  // Only update if content actually changed
  if (currentDoc !== newDoc) {
    view.dispatch({
      changes: {
        from: 0,
        to: currentDoc.length,
        insert: newDoc,
      },
    });
  }
}

/**
 * Destroy editor instance
 */
export function destroyEditor(view: EditorView): void {
  view.destroy();
}
