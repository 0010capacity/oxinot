import { Box, Button, Group, Popover, Stack } from "@mantine/core";
import { IconAlarm, IconCalendar } from "@tabler/icons-react";
import { useCallback, useState } from "react";
import { useBlockStore } from "../../stores/blockStore";

interface TodoDatePickerProps {
  blockId: string;
  type: "scheduled" | "deadline";
  value?: string | null;
  onClose?: () => void;
}

export function TodoDatePicker({
  blockId,
  type,
  value,
  onClose,
}: TodoDatePickerProps) {
  const [opened, setOpened] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(
    value || new Date().toISOString().split("T")[0],
  );

  const setBlockMetadata = useBlockStore((s) => s.setBlockMetadata);

  const handleSave = useCallback(async () => {
    await setBlockMetadata(blockId, type, selectedDate);
    setOpened(false);
    onClose?.();
  }, [blockId, type, selectedDate, setBlockMetadata, onClose]);

  const handleClear = useCallback(async () => {
    await setBlockMetadata(blockId, type, null);
    setOpened(false);
    onClose?.();
  }, [blockId, type, setBlockMetadata, onClose]);

  const label = type === "scheduled" ? "Scheduled" : "Deadline";
  const Icon = type === "scheduled" ? IconCalendar : IconAlarm;

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      withinPortal
      shadow="md"
    >
      <Popover.Target>
        <Box
          onClick={(e) => {
            e.stopPropagation();
            setOpened((o) => !o);
          }}
          style={{
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "var(--font-size-xs)",
            color: "var(--color-text-secondary)",
            padding: "2px 6px",
            borderRadius: "var(--radius-sm)",
            backgroundColor: "var(--color-bg-secondary)",
          }}
        >
          <Icon size={12} stroke={1.5} />
          {value || `Set ${label}`}
        </Box>
      </Popover.Target>

      <Popover.Dropdown>
        <Stack gap="xs">
          <div
            style={{
              fontSize: "var(--font-size-sm)",
              fontWeight: 500,
              color: "var(--color-text-primary)",
            }}
          >
            {label}
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              padding: "8px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border-primary)",
              backgroundColor: "var(--color-bg-primary)",
              color: "var(--color-text-primary)",
              fontSize: "var(--font-size-sm)",
            }}
          />
          <Group gap="xs" justify="flex-end">
            <Button
              size="xs"
              variant="subtle"
              onClick={handleClear}
              color="red"
            >
              Clear
            </Button>
            <Button size="xs" onClick={handleSave}>
              Save
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
