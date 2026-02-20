import type { CopilotChange } from "@/stores/copilotChangeStore";
import {
  useCopilotChangeStore,
  useHasPendingChanges,
  usePendingChanges,
} from "@/stores/copilotChangeStore";
import { useFloatingPanelStore } from "@/stores/floatingPanelStore";

function ChangeItem({
  change,
  onKeep,
  onRevert,
}: {
  change: CopilotChange;
  onKeep: () => void;
  onRevert: () => void;
}) {
  const typeColors = {
    create: "var(--color-success)",
    update: "var(--color-accent)",
    delete: "var(--color-error)",
  };

  const typeLabels = {
    create: "+",
    update: "~",
    delete: "-",
  };

  return (
    <div
      style={{
        padding: "var(--spacing-xs) var(--spacing-sm)",
        backgroundColor: "rgba(255, 255, 255, 0.03)",
        borderRadius: "var(--radius-sm)",
        display: "flex",
        alignItems: "center",
        gap: "var(--spacing-sm)",
        fontSize: "var(--font-size-xs)",
      }}
    >
      <span
        style={{
          color: typeColors[change.type],
          fontWeight: 600,
          minWidth: "16px",
        }}
      >
        {typeLabels[change.type]}
      </span>
      <span style={{ flex: 1, color: "var(--color-text-primary)" }}>
        {change.description}
      </span>
      <div style={{ display: "flex", gap: "4px" }}>
        <button
          type="button"
          onClick={onKeep}
          title="Keep this change"
          style={{
            padding: "2px 6px",
            background: "var(--color-success)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            color: "white",
            cursor: "pointer",
            fontSize: "10px",
          }}
        >
          Keep
        </button>
        <button
          type="button"
          onClick={onRevert}
          title="Revert this change"
          style={{
            padding: "2px 6px",
            background: "var(--color-error)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            color: "white",
            cursor: "pointer",
            fontSize: "10px",
          }}
        >
          Revert
        </button>
      </div>
    </div>
  );
}

export function CopilotChangesPanel() {
  const currentSessionId = useFloatingPanelStore((s) => s.currentSessionId);
  const pendingChanges = usePendingChanges(currentSessionId);
  const hasPendingChanges = useHasPendingChanges(currentSessionId);
  const { keepChange, revertChange, keepAllChanges, revertAllChanges } =
    useCopilotChangeStore();

  if (!hasPendingChanges) return null;

  return (
    <div
      style={{
        padding: "var(--spacing-sm) var(--spacing-md)",
        borderTop: "1px solid var(--color-border-secondary)",
        backgroundColor: "rgba(124, 58, 237, 0.1)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--spacing-xs)",
        }}
      >
        <span
          style={{
            fontSize: "var(--font-size-xs)",
            fontWeight: 600,
            color: "var(--color-accent)",
          }}
        >
          Pending Changes ({pendingChanges.length})
        </span>
        <div style={{ display: "flex", gap: "var(--spacing-xs)" }}>
          <button
            type="button"
            onClick={() => keepAllChanges(currentSessionId || "")}
            style={{
              padding: "2px 8px",
              background: "var(--color-success)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              color: "white",
              cursor: "pointer",
              fontSize: "10px",
            }}
          >
            Keep All
          </button>
          <button
            type="button"
            onClick={() => revertAllChanges(currentSessionId || "")}
            style={{
              padding: "2px 8px",
              background: "transparent",
              border: "1px solid var(--color-error)",
              borderRadius: "var(--radius-sm)",
              color: "var(--color-error)",
              cursor: "pointer",
              fontSize: "10px",
            }}
          >
            Revert All
          </button>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-xs)",
          maxHeight: "120px",
          overflow: "auto",
        }}
      >
        {pendingChanges.map((change) => (
          <ChangeItem
            key={change.id}
            change={change}
            onKeep={() => keepChange(currentSessionId || "", change.id)}
            onRevert={() => revertChange(currentSessionId || "", change.id)}
          />
        ))}
      </div>
    </div>
  );
}
