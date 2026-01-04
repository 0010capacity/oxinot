import { useEffect, useRef } from "react";
import { EditorView, KeyBinding } from "@codemirror/view";
import {
  createEditor,
  updateEditorContent,
  destroyEditor,
} from "../editor/createEditor";

interface EditorProps {
  value?: string;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  readOnly?: boolean;
  lineWrapping?: boolean;
  theme?: "light" | "dark";
  className?: string;
  style?: React.CSSProperties;

  /**
   * Whether to show line numbers in the gutter.
   * Useful to disable for embedded editors (e.g., outliner blocks).
   */
  lineNumbers?: boolean;

  /**
   * Optional custom keybindings for this editor instance.
   * These are forwarded to `createEditor()` and take precedence over defaults.
   */
  keybindings?: KeyBinding[];
}

/**
 * React wrapper component for CodeMirror 6 editor with hybrid rendering
 */
export const Editor: React.FC<EditorProps> = ({
  value = "",
  onChange,
  onFocus,
  onBlur,
  readOnly = false,
  lineWrapping = true,
  theme = "light",
  className,
  style,
  lineNumbers = true,
  keybindings,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const isUpdatingRef = useRef(false);

  // Keep latest callbacks/flags without forcing editor re-creation.
  const latestRef = useRef<{
    onChange?: (value: string) => void;
    onFocus?: () => void;
    onBlur?: () => void;
    readOnly: boolean;
    lineWrapping: boolean;
    theme: "light" | "dark";
    lineNumbers: boolean;
    keybindings?: KeyBinding[];
  }>({
    onChange,
    onFocus,
    onBlur,
    readOnly,
    lineWrapping,
    theme,
    lineNumbers,
    keybindings,
  });

  useEffect(() => {
    latestRef.current = {
      onChange,
      onFocus,
      onBlur,
      readOnly,
      lineWrapping,
      theme,
      lineNumbers,
      keybindings,
    };
  }, [
    onChange,
    onFocus,
    onBlur,
    readOnly,
    lineWrapping,
    theme,
    lineNumbers,
    keybindings,
  ]);

  // Initialize editor (create/destroy only when core configuration changes)
  useEffect(() => {
    if (!containerRef.current) return;

    // Create editor instance
    const view = createEditor(containerRef.current, {
      doc: value,
      onChange: (newDoc) => {
        const latest = latestRef.current;
        if (latest.onChange && !isUpdatingRef.current) {
          latest.onChange(newDoc);
        }
      },
      onFocus: () => {
        latestRef.current.onFocus?.();
      },
      onBlur: () => {
        latestRef.current.onBlur?.();
      },
      readOnly,
      lineWrapping,
      theme,
      lineNumbers,
      keybindings,
    });

    editorViewRef.current = view;

    // Cleanup
    return () => {
      if (editorViewRef.current) {
        destroyEditor(editorViewRef.current);
        editorViewRef.current = null;
      }
    };
    // NOTE: Intentionally exclude `onChange/onFocus/onBlur` and `value` to avoid re-creating
    // the editor on every keystroke / render. Those are handled via `latestRef`.
  }, [readOnly, lineWrapping, theme, lineNumbers, keybindings]);

  // Update content when value prop changes
  useEffect(() => {
    if (editorViewRef.current) {
      const currentDoc = editorViewRef.current.state.doc.toString();
      if (currentDoc !== value) {
        isUpdatingRef.current = true;
        updateEditorContent(editorViewRef.current, value);
        isUpdatingRef.current = false;
      }
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        ...style,
      }}
    />
  );
};

export default Editor;
