import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActionIcon,
  AppShell,
  Box,
  Group,
  ScrollArea,
  SegmentedControl,
  Text,
  Title,
} from "@mantine/core";
import { useElementSize, useHotkeys } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";

import { EditorState, RangeSetBuilder } from "@codemirror/state";
import type { DecorationSet } from "@codemirror/view";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { bracketMatching, syntaxTree } from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { oneDark } from "@codemirror/theme-one-dark";

import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";
import footnote from "markdown-it-footnote";

type ViewMode = "live" | "write" | "preview";

const DEFAULT_NOTE = `# md-editor

Obsidian 스타일의 **Live Preview**를 목표로 하는 CM6 기반 마크다운 에디터.

- [ ] 체크박스 (task list)
- [x] 완료된 항목

## Footnote
문장 끝에 각주를 달 수 있어.[^1]

[^1]: 각주 내용입니다.

\`\`\`ts
export function hello(name: string) {
  return \`hello, \${name}\`;
}
\`\`\`
`;

function useMarkdownRenderer() {
  return useMemo(() => {
    const md = new MarkdownIt({
      html: false,
      linkify: true,
      typographer: true,
      breaks: false,
    });

    md.use(taskLists, { enabled: true, label: true });
    md.use(footnote);

    return md;
  }, []);
}

/**
 * Live preview (Obsidian-like) MVP:
 * - Keep Markdown as the editable source, but apply "render-like" styling inline.
 * - Start with safe decorations (mark styling). Avoid replacements early.
 *
 * Current coverage (migrating to Lezer-based):
 * - Headings: via CM6 Lezer syntax tree ("ATXHeading")
 * - (Next) Bold/Italic/Inline code: migrate from regex to Lezer nodes
 * - Task checkboxes: keep line-based for now, then migrate as needed
 */
class LiveBadgeWidget extends WidgetType {
  toDOM() {
    const dom = document.createElement("span");
    dom.className = "lp-live-badge";
    dom.textContent = "LIVE";
    dom.setAttribute("aria-label", "Live preview enabled");
    return dom;
  }

  // Prevent the badge from stealing focus/selection.
  ignoreEvent() {
    return true;
  }
}

function livePreviewDecorationsExtension() {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.build(update.view);
        }
      }

      build(view: EditorView) {
        type PendingDeco = {
          from: number;
          to: number;
          deco: Decoration;
          startSide?: number;
        };

        const pending: PendingDeco[] = [];

        // IMPORTANT:
        // CM6 prohibits BLOCK decorations coming from ViewPlugins. Only inline widgets are allowed here.
        // So the badge must be inline (block: false/undefined). We'll still place it at document start.
        pending.push({
          from: 0,
          to: 0,
          startSide: -1,
          deco: Decoration.widget({
            widget: new LiveBadgeWidget(),
            side: -1,
          }),
        });

        // --- Headings (Lezer AST based) ---
        // Walk the syntax tree, but only apply decorations to visible ranges.
        // Node names can vary by parser configuration; we'll start with ATXHeading.
        const tree = syntaxTree(view.state);
        for (const { from, to } of view.visibleRanges) {
          tree.iterate({
            from,
            to,
            enter: (node) => {
              if (node.name !== "ATXHeading") return;

              // Determine heading level by counting leading '#'
              const line = view.state.doc.lineAt(node.from);
              const prefix = view.state.doc.sliceString(
                line.from,
                Math.min(line.to, line.from + 8),
              );
              const m = /^(#{1,6})\s+/.exec(prefix);
              const level = m ? m[1].length : 1;

              // Apply to the whole visual line, not just the AST node range.
              // This makes font-size/line-height changes reliably visible because `.cm-line` is the layout unit.
              const headingLine = view.state.doc.lineAt(node.from);
              pending.push({
                from: headingLine.from,
                to: headingLine.to,
                startSide: 0,
                deco: Decoration.mark({
                  class: `lp-heading lp-heading-${level}`,
                }),
              });
            },
          });
        }

        // Only scan visible ranges for perf.
        for (const { from, to } of view.visibleRanges) {
          const text = view.state.doc.sliceString(from, to);
          const lineStartPos = from;

          // --- Task list (line-based for now) ---
          let offset = 0;
          while (offset < text.length) {
            const nextNl = text.indexOf("\n", offset);
            const end = nextNl === -1 ? text.length : nextNl + 1;
            const line = text.slice(offset, end);
            const absLineFrom = lineStartPos + offset;
            const absLineTo = lineStartPos + offset + line.length;

            const taskMatch = /^(\s*[-*]\s+\[)( |x|X)(\])\s+/.exec(line);
            if (taskMatch) {
              const checked = taskMatch[2].toLowerCase() === "x";

              pending.push({
                from: absLineFrom,
                to: absLineTo,
                startSide: 0,
                deco: Decoration.mark({ class: "lp-task-line" }),
              });

              const boxFrom = absLineFrom + taskMatch[1].length - 1;
              const boxTo = boxFrom + 3;
              pending.push({
                from: boxFrom,
                to: boxTo,
                startSide: 0,
                deco: Decoration.mark({
                  class: checked
                    ? "lp-task-box lp-task-checked"
                    : "lp-task-box",
                }),
              });
            }

            offset += end;
          }

          // --- Inline-ish: emphasis / code (still regex for now; migrate next) ---
          const patterns: Array<{ re: RegExp; cls: string }> = [
            { re: /`([^`\n]+)`/g, cls: "lp-inline-code" },
            { re: /\*\*([^\n*][\s\S]*?[^\n*]?)\*\*/g, cls: "lp-strong" },
            { re: /(^|[^\*])\*([^\n*][\s\S]*?[^\n*]?)\*(?!\*)/g, cls: "lp-em" },
          ];

          for (const { re, cls } of patterns) {
            re.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = re.exec(text))) {
              const start = m.index + (cls === "lp-em" ? m[1].length : 0);
              const full = cls === "lp-em" ? `*${m[2]}*` : m[0];

              const absFrom = from + start;
              const absTo = absFrom + full.length;

              pending.push({
                from: absFrom,
                to: absTo,
                startSide: 0,
                deco: Decoration.mark({ class: cls }),
              });
            }
          }
        }

        // RangeSetBuilder requires sorted input by from position and startSide.
        pending.sort((a, b) => {
          if (a.from !== b.from) return a.from - b.from;
          const as = a.startSide ?? 0;
          const bs = b.startSide ?? 0;
          if (as !== bs) return as - bs;
          if (a.to !== b.to) return a.to - b.to;
          return 0;
        });

        const builder = new RangeSetBuilder<Decoration>();
        for (const r of pending) builder.add(r.from, r.to, r.deco);
        return builder.finish();
      }
    },
    {
      decorations: (v) => v.decorations,
    },
  );

  return plugin;
}

function buildEditorExtensions(
  onDocChanged: (next: string) => void,
  opts: { livePreview: boolean },
) {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    history(),
    bracketMatching(),
    highlightSelectionMatches(),
    EditorView.lineWrapping,
    keymap.of([
      indentWithTab,
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
    ]),
    markdown({ codeLanguages: languages }),
    oneDark,
    ...(opts.livePreview ? [livePreviewDecorationsExtension()] : []),
    EditorView.updateListener.of((v) => {
      if (!v.docChanged) return;
      onDocChanged(v.state.doc.toString());
    }),
    EditorView.theme(
      {
        "&": {
          height: "100%",
          fontSize: "14px",
          /* Make it obvious when Live Preview is ON */
          ...(opts.livePreview
            ? {
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                outline: "2px solid rgba(120, 255, 180, 0.25)",
                outlineOffset: "-2px",
              }
            : null),
        },
        ".cm-scroller": {
          /* In Live mode, use a reading font to visually differ from source mode */
          fontFamily: opts.livePreview
            ? "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
            : "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
        },
        ".cm-content": {
          padding: "12px 12px 80px",
          minHeight: "100%",
        },

        /* Visible confirmation badge for Live mode */
        ".lp-live-badge": {
          display: "inline-block",
          margin: "10px 12px 0",
          padding: "4px 8px",
          borderRadius: "999px",
          fontSize: "12px",
          fontWeight: "800",
          letterSpacing: "0.08em",
          color: "rgba(10, 18, 12, 0.95)",
          background: "rgba(120, 255, 180, 0.95)",
          border: "1px solid rgba(120, 255, 180, 0.55)",
          boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
          width: "fit-content",
        },

        /* Live preview styles (safe mark-only decorations) */
        ".lp-heading": {
          fontWeight: "800",
          letterSpacing: "-0.02em",
          color: "rgba(255,255,255,0.95)",
          display: "block",
        },

        /* Make heading sizing visible at the line/layout level. */
        ".cm-line.lp-heading-1": { fontSize: "1.9em", lineHeight: "1.25" },
        ".cm-line.lp-heading-2": { fontSize: "1.55em", lineHeight: "1.3" },
        ".cm-line.lp-heading-3": { fontSize: "1.25em", lineHeight: "1.35" },

        /* Fallback: ensure descendants inherit the intended sizing even with nested CM spans. */
        ".lp-heading-1, .lp-heading-1 *": { fontSize: "1.9em" },
        ".lp-heading-2, .lp-heading-2 *": { fontSize: "1.55em" },
        ".lp-heading-3, .lp-heading-3 *": { fontSize: "1.25em" },

        ".lp-strong": {
          fontWeight: "800",
          color: "rgba(255,255,255,0.98)",
        },
        ".lp-em": {
          fontStyle: "italic",
          color: "rgba(255,255,255,0.9)",
        },
        ".lp-inline-code": {
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: "6px",
          padding: "0 6px",
        },

        ".lp-task-line": {
          position: "relative",
        },
        ".lp-task-box": {
          color: "rgba(255,255,255,0.85)",
          fontWeight: "900",
          background: "rgba(120, 255, 180, 0.12)",
          border: "1px solid rgba(120, 255, 180, 0.25)",
          borderRadius: "6px",
          padding: "0 6px",
        },
        ".lp-task-checked": {
          color: "rgba(120, 255, 180, 0.95)",
          background: "rgba(120, 255, 180, 0.18)",
          borderColor: "rgba(120, 255, 180, 0.35)",
        },
      },
      { dark: true },
    ),
  ];
}

function MarkdownPreview({ value }: { value: string }) {
  const md = useMarkdownRenderer();
  const html = useMemo(() => md.render(value), [md, value]);

  return (
    <ScrollArea h="100%" type="auto">
      <Box
        p="md"
        style={{
          fontSize: 14,
          lineHeight: 1.6,
        }}
        // NOTE: markdown-it 출력은 HTML 문자열이라서 위험할 수 있음.
        // 일단 html=false로 둬서 raw HTML 입력은 렌더링되지 않게 했음.
        // 추후 플러그인/확장 사용 시 sanitize 정책을 명확히 잡자.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </ScrollArea>
  );
}

function CodeMirrorEditor({
  value,
  onChange,
  livePreview,
}: {
  value: string;
  onChange: (next: string) => void;
  livePreview: boolean;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Create once
  useEffect(() => {
    if (!hostRef.current) return;
    if (viewRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: buildEditorExtensions(onChange, { livePreview }),
    });

    const view = new EditorView({
      state,
      parent: hostRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild the editor when live preview toggles.
  // NOTE: Reconfigure can be subtle to get right; rebuilding is the simplest and most reliable.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // If the view doesn't exist yet, initial mount effect will handle it.
    const prev = viewRef.current;
    if (!prev) return;

    const scrollTop = prev.scrollDOM.scrollTop;
    prev.destroy();
    viewRef.current = null;

    const state = EditorState.create({
      doc: value,
      extensions: buildEditorExtensions(onChange, { livePreview }),
    });

    const nextView = new EditorView({
      state,
      parent: host,
    });

    nextView.scrollDOM.scrollTop = scrollTop;
    viewRef.current = nextView;
  }, [livePreview]);

  // External value -> editor doc (avoid feedback loop)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const current = view.state.doc.toString();
    if (current === value) return;

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
  }, [value]);

  return (
    <Box
      ref={hostRef}
      style={{
        height: "100%",
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid var(--mantine-color-dark-4)",
        background: "var(--mantine-color-dark-8)",
      }}
    />
  );
}

export default function App() {
  const [mode, setMode] = useState<ViewMode>("live");
  const [doc, setDoc] = useState<string>(DEFAULT_NOTE);

  // Runtime verification: show which build-id the UI was built from.
  // Injected via Vite `define` in `vite.config.ts`.
  const buildId = __APP_BUILD_ID__;
  const buildTime = __APP_BUILD_TIME__;

  const { ref: shellRef, height } = useElementSize();

  useHotkeys([
    [
      "mod+s",
      (e) => {
        e.preventDefault();
        notifications.show({
          title: "Saved (demo)",
          message:
            "현재는 로컬 저장/동기화 아직 안 붙였어. 다음 단계에서 파일/스토리지 연결하자.",
        });
      },
    ],
    [
      "mod+1",
      (e) => {
        e.preventDefault();
        setMode("live");
      },
    ],
    [
      "mod+2",
      (e) => {
        e.preventDefault();
        setMode("write");
      },
    ],
    [
      "mod+3",
      (e) => {
        e.preventDefault();
        setMode("preview");
      },
    ],
  ]);

  const editorVisible = mode === "live" || mode === "write";
  const previewVisible = mode === "preview";

  return (
    <AppShell
      ref={shellRef as any}
      header={{ height: 56 }}
      padding="md"
      style={{
        height: "100vh",
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Title order={4}>md-editor</Title>
            <Text size="sm" c="dimmed">
              CM6 + Mantine • Live Preview 지향
            </Text>
          </Group>

          <Group gap="sm">
            <Text size="xs" c="dimmed">
              build: {buildId}
              {buildTime !== "unknown" ? ` (${buildTime})` : ""}
            </Text>
            <SegmentedControl
              value={mode}
              onChange={(v) => setMode(v as ViewMode)}
              data={[
                { label: "Live", value: "live" },
                { label: "Write", value: "write" },
                { label: "Preview", value: "preview" },
              ]}
            />
            <ActionIcon
              variant="default"
              aria-label="Help"
              onClick={() => {
                notifications.show({
                  title: "Hotkeys",
                  message:
                    "⌘/Ctrl+S: demo save • ⌘/Ctrl+1/2/3: Live/Write/Preview",
                });
              }}
            >
              ?
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main style={{ height: height ? height - 56 : undefined }}>
        <Group
          align="stretch"
          gap="md"
          style={{
            height: "calc(100vh - 56px - var(--mantine-spacing-md) * 2)",
          }}
          wrap="nowrap"
        >
          {editorVisible && (
            <Box style={{ flex: 1, minWidth: 0, height: "100%" }}>
              <CodeMirrorEditor
                value={doc}
                onChange={setDoc}
                livePreview={mode === "live"}
              />
            </Box>
          )}

          {previewVisible && (
            <Box
              style={{
                flex: 1,
                minWidth: 0,
                height: "100%",
                borderRadius: 10,
                overflow: "hidden",
                border: "1px solid var(--mantine-color-dark-4)",
                background: "var(--mantine-color-dark-9)",
              }}
            >
              <MarkdownPreview value={doc} />
            </Box>
          )}
        </Group>
      </AppShell.Main>
    </AppShell>
  );
}
