import { useCallback, useEffect, useState } from "react";
import { Badge, Box, Group, Text } from "@mantine/core";
import { useTodoStore } from "../../stores/todoStore";
import { SMART_VIEWS, type SmartView, type SmartViewType } from "../../types/todo";
import { CollapseToggle } from "../common/CollapseToggle";

export function TodoPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<SmartViewType | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const fetchSmartView = useTodoStore((s) => s.fetchSmartView);

  // Fetch counts for each smart view on mount
  useEffect(() => {
    const fetchCounts = async () => {
      for (const view of SMART_VIEWS) {
        await fetchSmartView(view.id);
        // Count is the length of returned todos
        setCounts((prev) => ({
          ...prev,
          [view.id]: useTodoStore.getState().todos.length,
        }));
      }
    };
    fetchCounts();
  }, [fetchSmartView]);

  const handleToggleCollapse = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsed((c) => !c);
  }, []);

  const handleViewClick = useCallback(
    async (view: SmartView) => {
      setActiveView(view.id);
      await fetchSmartView(view.id);
    },
    [fetchSmartView],
  );

  return (
    <Box
      style={{
        borderBottom: "1px solid var(--color-border-primary)",
      }}
    >
      {/* Header */}
      <Group
        gap="xs"
        style={{
          padding: "8px 12px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <CollapseToggle isCollapsed={collapsed} onClick={handleToggleCollapse} />
        <Text size="sm" fw={600} c="var(--color-text-primary)">
          📋 Tasks
        </Text>
      </Group>

      {/* Smart Views List */}
      {!collapsed && (
        <Box style={{ padding: "0 8px 8px" }}>
          {SMART_VIEWS.map((view) => (
            <Group
              key={view.id}
              gap="xs"
              style={{
                padding: "6px 12px",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                backgroundColor:
                  activeView === view.id
                    ? "var(--color-bg-secondary)"
                    : "transparent",
                transition: "background-color 0.15s ease",
              }}
              onClick={() => handleViewClick(view)}
              onMouseEnter={(e) => {
                if (activeView !== view.id) {
                  e.currentTarget.style.backgroundColor =
                    "var(--color-bg-hover)";
                }
              }}
              onMouseLeave={(e) => {
                if (activeView !== view.id) {
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              <Text size="sm">{view.icon}</Text>
              <Text
                size="sm"
                c="var(--color-text-primary)"
                style={{ flex: 1 }}
              >
                {view.label}
              </Text>
              {counts[view.id] !== undefined && counts[view.id] > 0 && (
                <Badge
                  size="xs"
                  variant="light"
                  color="gray"
                  style={{ minWidth: 20 }}
                >
                  {counts[view.id]}
                </Badge>
              )}
            </Group>
          ))}
        </Box>
      )}
    </Box>
  );
}
