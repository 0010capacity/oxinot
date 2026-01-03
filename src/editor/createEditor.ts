import { EditorState, Extension } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  indentOnInput,
  bracketMatching,
} from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import {
  hybridRenderingPlugin,
  hybridRenderingTheme,
} from "./extensions/hybridRendering";

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
}

/**
 * Create basic editor extensions
 */
function createBasicExtensions(config: EditorConfig): Extension[] {
  const extensions: Extension[] = [
    // Line numbers
    lineNumbers(),
    highlightActiveLineGutter(),

    // History (undo/redo)
    history(),

    // Markdown language support with GFM extensions
    markdown({
      base: markdownLanguage,
      codeLanguages: [],
    }),

    // Syntax highlighting
    syntaxHighlighting(defaultHighlightStyle),

    // Auto-indent
    indentOnInput(),

    // Bracket matching
    bracketMatching(),

    // Auto-close brackets
    closeBrackets(),

    // Highlight selection matches
    highlightSelectionMatches(),

    // Keymaps
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...closeBracketsKeymap,
      ...searchKeymap,
    ]),
  ];

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
 * Create base editor theme
 */
function createEditorTheme(theme: "light" | "dark" = "light"): Extension {
  const isDark = theme === "dark";

  return EditorView.theme(
    {
      "&": {
        height: "100%",
        fontSize: "14px",
        backgroundColor: isDark ? "#1e1e1e" : "#ffffff",
        color: isDark ? "#d4d4d4" : "#000000",
      },
      ".cm-content": {
        padding: "20px 0",
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        caretColor: isDark ? "#ffffff" : "#000000",
      },
      ".cm-line": {
        padding: "0 20px",
        lineHeight: "1.6",
      },
      ".cm-gutters": {
        backgroundColor: isDark ? "#252526" : "#f5f5f5",
        color: isDark ? "#858585" : "#858585",
        border: "none",
        paddingLeft: "8px",
      },
      ".cm-activeLineGutter": {
        backgroundColor: isDark ? "#2c2c2d" : "#e8e8e8",
      },
      ".cm-activeLine": {
        backgroundColor: isDark
          ? "rgba(255, 255, 255, 0.05)"
          : "rgba(0, 0, 0, 0.03)",
      },
      ".cm-selectionBackground, ::selection": {
        backgroundColor: isDark ? "#264f78" : "#b3d4fc",
      },
      ".cm-focused .cm-selectionBackground, .cm-focused ::selection": {
        backgroundColor: isDark ? "#264f78" : "#b3d4fc",
      },
      ".cm-cursor": {
        borderLeftColor: isDark ? "#ffffff" : "#000000",
      },
      "&.cm-focused": {
        outline: "none",
      },
      ".cm-scroller": {
        overflow: "auto",
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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

    // Hybrid rendering (live preview)
    hybridRenderingPlugin,
    hybridRenderingTheme,

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
