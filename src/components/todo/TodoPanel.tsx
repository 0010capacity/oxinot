import { Badge, Box, Group, Progress, Text } from "@mantine/core";
import {
  IconAlertTriangle,
  IconCalendar,
  IconCalendarPlus,
  IconCheck,
  IconFlag,
  IconList,
} from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { type TodoStatistics, useTodoStore } from "../../stores/todoStore";
import {
  SMART_VIEWS,
  type SmartView,
  type SmartViewType,
} from "../../types/todo";
import { CollapseToggle } from "../common/CollapseToggle";

const ICON_MAP: Record<
  SmartView["iconName"],
  | typeof IconCalendar
  | typeof IconCalendarPlus
  | typeof IconAlertTriangle
  | typeof IconFlag
  | typeof IconList
  | typeof IconCheck
> = {
  IconCalendar,
  IconCalendarPlus,
  IconAlertTriangle,
  IconFlag,
  IconList,
  IconCheck,
};

function SmartViewIcon({
  iconName,
  size = 14,
}: { iconName: SmartView["iconName"]; size?: number }) {
  const IconComponent = ICON_MAP[iconName];
  return <IconComponent size={size} stroke={1.5} />;
}

export function TodoPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<SmartViewType | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<TodoStatistics | null>(null);

  const fetchSmartView = useTodoStore((s) => s.fetchSmartView);
  const fetchStatistics = useTodoStore((s) => s.fetchStatistics);

  useEffect(() => {
    const fetchCounts = async () => {
      for (const view of SMART_VIEWS) {
        await fetchSmartView(view.id);
        setCounts((prev) => ({
          ...prev,
          [view.id]: useTodoStore.getState().todos.length,
        }));
      }
    };
    fetchCounts();
  }, [fetchSmartView]);

  useEffect(() => {
    const loadStats = async () => {
      const result = await fetchStatistics();
      setStats(result);
    };
    loadStats();
  }, [fetchStatistics]);

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
      <Group
        gap="xs"
        style={{
          padding: "8px 12px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <CollapseToggle
          isCollapsed={collapsed}
          onClick={handleToggleCollapse}
        />
        <IconList
          size={14}
          stroke={1.5}
          style={{ color: "var(--color-text-secondary)" }}
        />
        <Text size="sm" fw={600} c="var(--color-text-primary)">
          Tasks
        </Text>
      </Group>

      {!collapsed && stats && (
        <Box style={{ padding: "0 12px 8px" }}>
          <Group gap="xs" mb="xs">
            <Text size="xs" c="var(--color-text-secondary)">
              Completion Rate
            </Text>
            <Text size="xs" fw={600} c="var(--color-text-primary)">
              {stats.completionRate}%
            </Text>
          </Group>
          <Progress
            value={stats.completionRate}
            size="xs"
            color="var(--color-success)"
            style={{ marginBottom: "8px" }}
          />
          <Group gap="md">
            <Text size="xs" c="var(--color-text-secondary)">
              <Text component="span" fw={600} c="var(--color-text-primary)">
                {stats.total}
              </Text>{" "}
              total
            </Text>
            <Text size="xs" c="var(--color-text-secondary)">
              <Text component="span" fw={600} c="var(--color-success)">
                {stats.completed}
              </Text>{" "}
              done
            </Text>
            {stats.overdue > 0 && (
              <Text size="xs" c="var(--color-text-secondary)">
                <Text component="span" fw={600} c="var(--color-error)">
                  {stats.overdue}
                </Text>{" "}
                overdue
              </Text>
            )}
          </Group>
        </Box>
      )}

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
              <SmartViewIcon iconName={view.iconName} size={14} />
              <Text size="sm" c="var(--color-text-primary)" style={{ flex: 1 }}>
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
