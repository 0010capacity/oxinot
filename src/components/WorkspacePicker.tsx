import { IconPlus, IconRefresh, IconTrash } from "@tabler/icons-react";
import type { CSSProperties, RefObject } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { useSyncStore } from "../stores/syncStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { tauriAPI } from "../tauri-api";
import { showNotification, showToast } from "../utils/toast";

interface WorkspacePickerProps {
  currentWorkspacePath: string | null;
}

const DROPDOWN_WIDTH = 300;

const DROPDOWN_CSS = `
.oxinot-ws-enter {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
.oxinot-ws-active {
  opacity: 1;
  transform: translateY(0) scale(1);
  transition: opacity 0.15s ease-out, transform 0.17s cubic-bezier(0.22, 1, 0.36, 1);
}
.oxinot-ws-exit {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
  transition: opacity 0.1s ease-in, transform 0.1s ease-in;
}
.oxinot-ws-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background-color var(--transition-fast);
  font-family: var(--font-family);
  text-align: left;
}
.oxinot-ws-item:hover {
  background: var(--color-bg-hover);
}
.oxinot-ws-item:disabled {
  opacity: 0.4;
  cursor: default;
}
.oxinot-ws-del {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  color: var(--color-text-tertiary);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}
.oxinot-ws-del:hover {
  background: color-mix(in srgb, var(--color-error) 12%, transparent);
  color: var(--color-error);
}
.oxinot-ws-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-primary);
  cursor: pointer;
  font-family: var(--font-family);
  font-size: var(--font-size-sm);
  font-weight: 500;
  transition: background-color var(--transition-fast);
}
.oxinot-ws-trigger:hover {
  background: var(--color-interactive-hover);
}
.oxinot-ws-divider {
  height: 1px;
  background: var(--color-border-secondary);
  margin: 4px 12px;
}
.oxinot-ws-section-label {
  padding: 6px 12px 4px;
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  font-family: var(--font-family);
  opacity: 0.7;
}
`;

// ---------------------------------------------------------------------------
// Confirm modal (delete workspace)
// ---------------------------------------------------------------------------

function ConfirmModal({
  name,
  onConfirm,
  onCancel,
}: {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onConfirm, onCancel]);

  const overlayStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    zIndex: 2000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const boxStyle: CSSProperties = {
    backgroundColor: "var(--color-bg-elevated)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-lg)",
    padding: "24px",
    width: 320,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    fontFamily: "var(--font-family)",
  };

  const btnBase: CSSProperties = {
    padding: "7px 16px",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--color-border-primary)",
    fontSize: "var(--font-size-sm)",
    fontFamily: "var(--font-family)",
    fontWeight: 500,
    cursor: "pointer",
    transition: "opacity var(--transition-fast)",
  };

  return createPortal(
    // biome-ignore lint/a11y/useKeyWithClickEvents: overlay dismiss - ESC handled separately
    <div style={overlayStyle} onClick={onCancel}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: modal content - not interactive */}
      <div style={boxStyle} onClick={(e) => e.stopPropagation()}>
        <div>
          <div
            style={{
              fontSize: "var(--font-size-sm)",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              marginBottom: 6,
            }}
          >
            Remove Workspace
          </div>
          <div
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-secondary)",
              lineHeight: 1.5,
            }}
          >
            Remove{" "}
            <span
              style={{ fontWeight: 600, color: "var(--color-text-primary)" }}
            >
              {name}
            </span>{" "}
            from your recent list?
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            style={{
              ...btnBase,
              background: "var(--color-bg-secondary)",
              color: "var(--color-text-secondary)",
            }}
            onClick={onCancel}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.8";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            style={{
              ...btnBase,
              background: "var(--color-error)",
              color: "#fff",
              border: "none",
            }}
            onClick={onConfirm}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.85";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            Remove
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Dropdown
// ---------------------------------------------------------------------------

function WorkspaceDropdown({
  triggerRef,
  currentWorkspacePath,
  onClose,
}: {
  triggerRef: RefObject<HTMLButtonElement | null>;
  currentWorkspacePath: string | null;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [animReady, setAnimReady] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const workspaces = useWorkspaceStore((s) => s.getWorkspaces());
  const openWorkspace = useWorkspaceStore((s) => s.openWorkspace);
  const selectWorkspace = useWorkspaceStore((s) => s.selectWorkspace);
  const removeWorkspace = useWorkspaceStore((s) => s.removeWorkspace);
  const { startReindex, updateProgress, finishReindex, cancelReindex } =
    useSyncStore();

  const calcPosition = useCallback(() => {
    if (!triggerRef.current) return { top: 0, left: 0 };
    const rect = triggerRef.current.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    let left = center - DROPDOWN_WIDTH / 2;
    if (left < 12) left = 12;
    if (left + DROPDOWN_WIDTH > window.innerWidth - 12)
      left = window.innerWidth - DROPDOWN_WIDTH - 12;
    return { top: rect.bottom + 6, left };
  }, [triggerRef]);

  useLayoutEffect(() => {
    setPosition(calcPosition());
    setVisible(true);
    setAnimReady(false);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setAnimReady(true)),
    );
  }, [calcPosition]);

  // Outside click
  // biome-ignore lint/correctness/useExhaustiveDependencies: ref.current is stable
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      handleClose();
    };
    const t = setTimeout(
      () => document.addEventListener("mousedown", handler),
      0,
    );
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handler);
    };
  }, []);

  // ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleClose = useCallback(() => {
    setAnimReady(false);
    setTimeout(() => {
      setVisible(false);
      onClose();
    }, 110);
  }, [onClose]);

  const handleReindex = async () => {
    handleClose();
    if (!currentWorkspacePath) {
      showNotification({
        title: "Error",
        message: "No workspace selected",
        type: "error",
      });
      return;
    }
    try {
      startReindex();
      updateProgress(10, "Scanning workspace files...");
      const result = await tauriAPI.reindexWorkspace(currentWorkspacePath);
      updateProgress(90, "Finalizing...");
      setTimeout(() => {
        finishReindex();
        showToast({
          message: `Re-indexed ${result.pages} pages`,
          type: "success",
        });
        setTimeout(() => window.location.reload(), 1500);
      }, 200);
    } catch {
      cancelReindex();
      showToast({ message: "Re-index failed", type: "error", duration: 2000 });
    }
  };

  const handleDelete = useCallback((path: string) => {
    setDeleteTarget(path);
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteTarget) {
      removeWorkspace(deleteTarget);
      setDeleteTarget(null);
      showToast({
        message: "Workspace removed from recent list",
        type: "success",
      });
    }
  }, [deleteTarget, removeWorkspace]);

  const formatLastAccessed = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  if (!visible) return null;

  return createPortal(
    <>
      <style>{DROPDOWN_CSS}</style>
      <div
        ref={dropdownRef}
        style={{
          position: "fixed",
          top: position.top,
          left: position.left,
          width: DROPDOWN_WIDTH,
          backgroundColor: "var(--color-bg-elevated)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          border: "1px solid var(--color-border-secondary)",
          zIndex: 1200,
          overflow: "hidden",
          fontFamily: "var(--font-family)",
          opacity: animReady ? 1 : 0,
          transform: animReady
            ? "translateY(0) scale(1)"
            : "translateY(-6px) scale(0.98)",
          transition: animReady
            ? "opacity 0.15s ease-out, transform 0.17s cubic-bezier(0.22, 1, 0.36, 1)"
            : "opacity 0.1s ease-in, transform 0.1s ease-in",
        }}
      >
        {/* Workspace list */}
        {workspaces.length === 0 ? (
          <div
            style={{
              padding: "20px 16px",
              textAlign: "center",
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-tertiary)",
            }}
          >
            No workspaces yet
          </div>
        ) : (
          <>
            <div className="oxinot-ws-section-label">Workspaces</div>
            <div
              ref={listRef}
              style={{ maxHeight: 280, overflowY: "auto", padding: "2px 6px" }}
              onPointerMove={(e) => {
                const el = (e.target as HTMLElement).closest<HTMLElement>(
                  "[data-ws-path]",
                );
                setHoveredPath(el ? (el.dataset.wsPath ?? null) : null);
              }}
              onPointerLeave={() => setHoveredPath(null)}
            >
              {workspaces.map((ws) => {
                const isActive = ws.path === currentWorkspacePath;
                const isHovered = hoveredPath === ws.path;
                return (
                  <div
                    key={ws.path}
                    data-ws-path={ws.path}
                    style={{ display: "flex", alignItems: "center", gap: 2 }}
                  >
                    <button
                      type="button"
                      className="oxinot-ws-item"
                      style={{ flex: 1 }}
                      onClick={() => {
                        openWorkspace(ws.path);
                        handleClose();
                      }}
                    >
                      {/* Active indicator */}
                      <div
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: "50%",
                          backgroundColor: isActive
                            ? "var(--color-accent)"
                            : "transparent",
                          flexShrink: 0,
                        }}
                      />

                      {/* Text */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "var(--font-size-sm)",
                            fontWeight: isActive ? 600 : 400,
                            color: isActive
                              ? "var(--color-text-primary)"
                              : "var(--color-text-primary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            lineHeight: 1.3,
                          }}
                        >
                          {ws.name}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "var(--color-text-tertiary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            lineHeight: 1.4,
                            marginTop: 1,
                            opacity: 0.7,
                          }}
                        >
                          {formatLastAccessed(ws.lastAccessed)}
                        </div>
                      </div>
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      className="oxinot-ws-del"
                      style={{ visibility: isHovered ? "visible" : "hidden" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(ws.path);
                      }}
                      aria-label={`Remove ${ws.name}`}
                    >
                      <IconTrash size={12} stroke={1.5} />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Divider */}
        <div className="oxinot-ws-divider" />

        {/* Actions */}
        <div style={{ padding: "4px 6px 6px" }}>
          <button
            type="button"
            className="oxinot-ws-item"
            onClick={() => {
              selectWorkspace();
              handleClose();
            }}
          >
            <IconPlus
              size={13}
              stroke={2}
              style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }}
            />
            <span
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-secondary)",
              }}
            >
              Add Workspace…
            </span>
          </button>

          {currentWorkspacePath && (
            <button
              type="button"
              className="oxinot-ws-item"
              onClick={handleReindex}
            >
              <IconRefresh
                size={13}
                stroke={1.5}
                style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }}
              />
              <span
                style={{
                  fontSize: "var(--font-size-sm)",
                  color: "var(--color-text-secondary)",
                }}
              >
                Re-index Workspace
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Delete confirm modal */}
      {deleteTarget && (
        <ConfirmModal
          name={workspaces.find((w) => w.path === deleteTarget)?.name ?? ""}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// WorkspacePicker trigger
// ---------------------------------------------------------------------------

export function WorkspacePicker({
  currentWorkspacePath,
}: WorkspacePickerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const workspaces = useWorkspaceStore((s) => s.getWorkspaces());
  const currentWorkspace = workspaces.find(
    (w) => w.path === currentWorkspacePath,
  );

  return (
    <>
      <style>{DROPDOWN_CSS}</style>
      <button
        ref={triggerRef}
        type="button"
        className="oxinot-ws-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          style={{
            maxWidth: 180,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {currentWorkspace?.name ?? "Select Workspace"}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          role="img"
          aria-label="Dropdown arrow"
          style={{
            flexShrink: 0,
            opacity: 0.45,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s ease",
          }}
        >
          <path
            d="M2 3.5l3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <WorkspaceDropdown
          triggerRef={triggerRef}
          currentWorkspacePath={currentWorkspacePath}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
