import { useEffect, useRef } from "react";
import { EditorView } from "@codemirror/view";
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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const isUpdatingRef = useRef(false);

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) return;

    // Create editor instance
    const view = createEditor(containerRef.current, {
      doc: value,
      onChange: (newDoc) => {
        if (onChange && !isUpdatingRef.current) {
          onChange(newDoc);
        }
      },
      onFocus,
      onBlur,
      readOnly,
      lineWrapping,
      theme,
    });

    editorViewRef.current = view;

    // Cleanup
    return () => {
      if (editorViewRef.current) {
        destroyEditor(editorViewRef.current);
        editorViewRef.current = null;
      }
    };
  }, [readOnly, lineWrapping, theme]); // Re-create only if these props change

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
