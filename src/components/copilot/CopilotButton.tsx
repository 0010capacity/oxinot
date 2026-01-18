import { ActionIcon, Tooltip } from "@mantine/core";
import { IconSparkles } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useCopilotUiStore } from "../../stores/copilotUiStore";

export function CopilotButton() {
  const { t } = useTranslation();
  const toggle = useCopilotUiStore((state) => state.toggle);
  const isOpen = useCopilotUiStore((state) => state.isOpen);

  if (isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "8px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 150, // Higher than bottom controls
      }}
    >
      <Tooltip label={t("settings.ai.copilot.button_tooltip")} position="top">
        <ActionIcon
          variant={isOpen ? "filled" : "light"}
          size="lg"
          radius="xl"
          onClick={toggle}
          color={isOpen ? "violet" : "gray"}
          style={{
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            transition: "all 0.2s ease",
          }}
        >
          <IconSparkles size={20} />
        </ActionIcon>
      </Tooltip>
    </div>
  );
}
