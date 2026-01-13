import { useErrorStore } from "@/stores/errorStore";
import { Alert, CloseButton, Group, Stack } from "@mantine/core";

export const ErrorNotifications = () => {
  const errors = useErrorStore((state) => state.errors);
  const removeError = useErrorStore((state) => state.removeError);

  if (errors.length === 0) {
    return null;
  }

  return (
    <Stack
      gap="xs"
      style={{
        position: "fixed",
        top: 16,
        left: 16,
        right: "auto",
        zIndex: 9999,
        maxWidth: 400,
        pointerEvents: "auto",
      }}
    >
      {errors.map((error) => (
        <Alert
          key={error.id}
          title={
            error.type === "error"
              ? "Error"
              : error.type === "warning"
                ? "Warning"
                : "Info"
          }
          color={
            error.type === "error"
              ? "red"
              : error.type === "warning"
                ? "yellow"
                : "blue"
          }
          withCloseButton
          icon={null}
          onClose={() => removeError(error.id)}
          style={{
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          }}
        >
          <Group justify="space-between" wrap="nowrap">
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 4 }}>{error.message}</div>
              {error.details && (
                <div
                  style={{
                    fontSize: 12,
                    opacity: 0.7,
                    fontFamily: "monospace",
                    marginTop: 4,
                  }}
                >
                  {error.details}
                </div>
              )}
            </div>
            <CloseButton
              icon={null}
              onClick={() => removeError(error.id)}
              style={{ flexShrink: 0 }}
            />
          </Group>
        </Alert>
      ))}
    </Stack>
  );
};
