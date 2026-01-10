import { notifications } from "@mantine/notifications";

interface ToastOptions {
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
}

/**
 * Show a minimal, centered toast notification
 * Used for quick feedback like "Committed", "Saved", etc.
 */
export function showToast({ message, type = "info", duration = 1500 }: ToastOptions) {
  const isDark = document.documentElement.getAttribute("data-mantine-color-scheme") === "dark";

  const getColor = () => {
    switch (type) {
      case "success":
        return isDark ? "#51cf66" : "#37b24d";
      case "error":
        return isDark ? "#fa5252" : "#c92a2a";
      default:
        return isDark ? "#909296" : "#868e96";
    }
  };

  notifications.show({
    message,
    position: "bottom-center",
    autoClose: duration,
    withCloseButton: false,
    withBorder: false,
    styles: {
      root: {
        backgroundColor: isDark
          ? "rgba(44, 46, 51, 0.95)"
          : "rgba(241, 243, 245, 0.95)",
        backdropFilter: "blur(8px)",
        border: "none",
        boxShadow: "none",
        padding: "8px 12px",
        minHeight: "auto",
        "&::before": {
          display: "none",
        },
      },
      description: {
        color: getColor(),
        fontSize: "0.75rem",
        margin: 0,
      },
    },
  });
}

/**
 * Show a standard notification with title
 * Used for more detailed feedback
 */
export function showNotification({
  title,
  message,
  type = "info",
  duration = 3000,
}: {
  title: string;
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
}) {
  const color = type === "success" ? "green" : type === "error" ? "red" : "blue";

  notifications.show({
    title,
    message,
    color,
    autoClose: duration,
  });
}
