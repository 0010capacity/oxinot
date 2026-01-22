import type { EditorView, KeyBinding } from "@codemirror/view";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";
import {
  createEditor,
  destroyEditor,
  updateEditorContent,
} from "../editor/createEditor";
import {
  isFocusedCompartment,
  isFocusedFacet,
} from "../editor/extensions/hybridRendering";
import { IME_FLUSH_TIMEOUT_MS } from "../outliner/constants";

type MaybeTimer = ReturnType<typeof setTimeout> | null;

interface EditorProps {
  value?: string;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
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

  /**
   * Whether this editor should be treated as focused for rendering purposes.
   * Used to control markdown marker visibility in outliner blocks.
   */
  isFocused?: boolean;
}

export interface EditorRef {
  focus: () => void;
  getView: () => EditorView | null;
}

/**
 * React wrapper component for CodeMirror 6 editor with hybrid rendering
 */
export const Editor = forwardRef<EditorRef, EditorProps>(
  (
    {
      value = "",
      onChange,
      onFocus,
      onBlur,
      onMouseDown,
      readOnly = false,
      lineWrapping = true,
      theme = "light",
      className,
      style,
      lineNumbers = true,
      keybindings,
      isFocused,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorViewRef = useRef<EditorView | null>(null);
    const isUpdatingRef = useRef(false);

    // IME safety: while composing (Korean/Japanese/Chinese), avoid pushing updates
    // into React state on every intermediate composition change, because it can
    // cause re-renders that interfere with the IME pipeline and duplicate input.
    const isComposingRef = useRef(false);
    const pendingOnChangeValueRef = useRef<string | null>(null);
    const flushTimerRef = useRef<MaybeTimer>(null);

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
      isFocused?: boolean;
    }>({
      onChange,
      onFocus,
      onBlur,
      readOnly,
      lineWrapping,
      theme,
      lineNumbers,
      keybindings,
      isFocused,
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
        isFocused,
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
      isFocused,
    ]);

    // Expose focus method to parent
    useImperativeHandle(ref, () => ({
      focus: () => {
        if (editorViewRef.current) {
          editorViewRef.current.focus();
        }
      },
      getView: () => editorViewRef.current,
    }));

    // Initialize editor (create/destroy only when core configuration changes)
    const initialValueRef = useRef(value);
    const initialIsFocusedRef = useRef(isFocused);

    useEffect(() => {
      if (!containerRef.current) return;

      // Create editor instance
      const view = createEditor(containerRef.current, {
        doc: initialValueRef.current,
        onChange: (newDoc) => {
          const latest = latestRef.current;

          if (!latest.onChange || isUpdatingRef.current) return;

          // If the user is composing, buffer the latest value and flush once the
          // composition has ended (or after a small debounce).
          if (isComposingRef.current) {
            pendingOnChangeValueRef.current = newDoc;

            // Debounced flush as a safety net in case compositionend isn't observed
            // (some environments can miss it when focus changes quickly).
            if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
            flushTimerRef.current = setTimeout(() => {
              flushTimerRef.current = null;
              if (!isComposingRef.current) {
                const pending = pendingOnChangeValueRef.current;
                pendingOnChangeValueRef.current = null;
                if (pending != null) latest.onChange?.(pending);
              }
            }, IME_FLUSH_TIMEOUT_MS);

            return;
          }

          latest.onChange(newDoc);
        },
        onFocus: () => {
          latestRef.current.onFocus?.();
        },
        onBlur: () => {
          // If we lose focus mid-composition, end composing and flush whatever we have.
          isComposingRef.current = false;

          if (flushTimerRef.current) {
            clearTimeout(flushTimerRef.current);
            flushTimerRef.current = null;
          }

          const pending = pendingOnChangeValueRef.current;
          pendingOnChangeValueRef.current = null;
          if (pending != null) {
            latestRef.current.onChange?.(pending);
          }

          latestRef.current.onBlur?.();
        },
        readOnly,
        lineWrapping,
        theme,
        lineNumbers,
        keybindings,
        isFocused: initialIsFocusedRef.current,
      });

      editorViewRef.current = view;

      // Track IME composition state from the editor DOM. We attach directly to the
      // editor root to avoid needing changes inside CM extensions.
      const dom = view.dom;

      const onCompositionStart = () => {
        isComposingRef.current = true;
      };

      const onCompositionEnd = () => {
        isComposingRef.current = false;

        // Flush buffered value once the IME commits.
        if (flushTimerRef.current) {
          clearTimeout(flushTimerRef.current);
          flushTimerRef.current = null;
        }

        const pending = pendingOnChangeValueRef.current;
        pendingOnChangeValueRef.current = null;
        if (pending != null) {
          latestRef.current.onChange?.(pending);
        }
      };

      dom.addEventListener("compositionstart", onCompositionStart, {
        passive: true,
      });
      dom.addEventListener("compositionend", onCompositionEnd, {
        passive: true,
      });

      // Cleanup
      return () => {
        dom.removeEventListener("compositionstart", onCompositionStart);
        dom.removeEventListener("compositionend", onCompositionEnd);

        if (flushTimerRef.current) {
          clearTimeout(flushTimerRef.current);
          flushTimerRef.current = null;
        }

        pendingOnChangeValueRef.current = null;
        isComposingRef.current = false;

        if (editorViewRef.current) {
          destroyEditor(editorViewRef.current);
          editorViewRef.current = null;
        }
      };
      // NOTE: Intentionally exclude `onChange/onFocus/onBlur`, `value`, and `isFocused` to avoid re-creating
      // the editor on every keystroke / render. Those are handled via `latestRef`.
    }, [readOnly, lineWrapping, theme, lineNumbers, keybindings]);

    // Update content when value prop changes.
    //
    // IMPORTANT (IME): While the user is composing (Korean/Japanese/Chinese IME),
    // do not push external `value` into the editor. Doing so can overwrite the
    // in-progress composition and make text "disappear".
    //
    // In our architecture, the editor owns the live draft while typing, and
    // external state should follow via `onChange`/flush points.
    useEffect(() => {
      if (editorViewRef.current) {
        if (isComposingRef.current) return;

        const currentDoc = editorViewRef.current.state.doc.toString();
        if (currentDoc !== value) {
          isUpdatingRef.current = true;
          updateEditorContent(editorViewRef.current, value);
          isUpdatingRef.current = false;
        }
      }
    }, [value]);

    // FOCUS STATE UPDATES:
    // ---------------------
    // Update isFocused facet when isFocused prop changes
    // This is called whenever the user clicks on a different block or navigates with keyboard
    //
    // Flow:
    // 1. BlockComponent passes isFocused={focusedBlockId === blockId}
    // 2. This effect runs when isFocused prop changes
    // 3. Updates the editor's isFocusedFacet via compartment reconfiguration
    // 4. Triggers hybridRenderingPlugin's update() method (via facetChanged detection)
    // 5. Plugin rebuilds decorations based on new focus state
    //
    // Use useLayoutEffect to ensure synchronous execution before paint
    // This prevents the "unfocused block stays in marker mode" issue when navigating up
    useLayoutEffect(() => {
      if (editorViewRef.current && isFocused !== undefined) {
        editorViewRef.current.dispatch({
          effects: isFocusedCompartment.reconfigure(
            isFocusedFacet.of(isFocused),
          ),
        });
      }
    }, [isFocused]);

    // Handle Tab key explicitly to prevent default browser focus navigation
    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Tab" && event.shiftKey === false) {
        // Let CodeMirror handle Tab through its keybinding system
        // Prevent default browser Tab navigation
        event.preventDefault();
        event.stopPropagation();
      } else if (event.key === "Tab" && event.shiftKey === true) {
        // Handle Shift+Tab
        event.preventDefault();
        event.stopPropagation();
      }
    };

    return (
      <div
        ref={containerRef}
        className={className}
        onMouseDown={onMouseDown}
        onKeyDown={handleKeyDown}
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
          ...style,
        }}
      />
    );
  },
);

Editor.displayName = "Editor";

export default Editor;
