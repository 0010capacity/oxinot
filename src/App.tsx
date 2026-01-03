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

import { EditorState } from "@codemirror/state";
import {
  EditorView,
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
import { bracketMatching } from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { oneDark } from "@codemirror/theme-one-dark";

import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";
import footnote from "markdown-it-footnote";

type ViewMode = "split" | "write" | "preview";

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

function buildEditorExtensions(onDocChanged: (next: string) => void) {
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
    EditorView.updateListener.of((v) => {
      if (!v.docChanged) return;
      onDocChanged(v.state.doc.toString());
    }),
    EditorView.theme(
      {
        "&": {
          height: "100%",
          fontSize: "14px",
        },
        ".cm-scroller": {
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
        },
        ".cm-content": {
          padding: "12px 12px 80px",
          minHeight: "100%",
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
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Create once
  useEffect(() => {
    if (!hostRef.current) return;
    if (viewRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: buildEditorExtensions(onChange),
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
  const [mode, setMode] = useState<ViewMode>("split");
  const [doc, setDoc] = useState<string>(DEFAULT_NOTE);

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
        setMode("split");
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

  const editorVisible = mode === "split" || mode === "write";
  const previewVisible = mode === "split" || mode === "preview";

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
            <SegmentedControl
              value={mode}
              onChange={(v) => setMode(v as ViewMode)}
              data={[
                { label: "Split", value: "split" },
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
                  message: "⌘/Ctrl+S: demo save • ⌘/Ctrl+1/2/3: view modes",
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
              <CodeMirrorEditor value={doc} onChange={setDoc} />
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
