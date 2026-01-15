import { Badge, Group, Tooltip } from "@mantine/core";
import type React from "react";
import { memo } from "react";

interface MetadataBadgeProps {
  metadataKey: string;
  value: string;
  onClick?: () => void;
}

/**
 * Truncate long JSON values for display
 */
function truncateValue(value: string, maxLength = 30): string {
  // Check if value is JSON object or array
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      JSON.parse(value);
      // Valid JSON - show abbreviated form
      if (trimmed.startsWith("{")) {
        return "{...}";
      }
      return "[...]";
    } catch {
      // Not valid JSON, treat as string
    }
  }

  // Regular string value - truncate if too long
  if (value.length > maxLength) {
    return `${value.slice(0, maxLength)}...`;
  }

  return value;
}

/**
 * Single metadata badge component
 */
export const MetadataBadge: React.FC<MetadataBadgeProps> = memo(
  ({ metadataKey, value, onClick }) => {
    const displayValue = truncateValue(value);
    const fullText = `${metadataKey}::${value}`;

    return (
      <Tooltip label={fullText} withArrow openDelay={500}>
        <Badge
          variant="light"
          size="sm"
          style={{
            cursor: onClick ? "pointer" : "default",
            textTransform: "none",
            fontWeight: 400,
          }}
          onClick={onClick}
        >
          <span style={{ opacity: 0.7 }}>{metadataKey}:</span>{" "}
          <span>{displayValue}</span>
        </Badge>
      </Tooltip>
    );
  }
);

MetadataBadge.displayName = "MetadataBadge";

interface MetadataBadgesProps {
  metadata: Record<string, string>;
  onBadgeClick?: (key: string) => void;
}

/**
 * Container for multiple metadata badges
 */
export const MetadataBadges: React.FC<MetadataBadgesProps> = memo(
  ({ metadata, onBadgeClick }) => {
    const entries = Object.entries(metadata);

    if (entries.length === 0) {
      return null;
    }

    // Sort by key for consistent display
    entries.sort(([a], [b]) => a.localeCompare(b));

    return (
      <Group gap="xs" mt="xs" wrap="wrap">
        {entries.map(([key, value]) => (
          <MetadataBadge
            key={key}
            metadataKey={key}
            value={value}
            onClick={onBadgeClick ? () => onBadgeClick(key) : undefined}
          />
        ))}
      </Group>
    );
  }
);

MetadataBadges.displayName = "MetadataBadges";
