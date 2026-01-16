import { Select, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type {
  DateOrder,
  DateSeparator,
  TimeFormat,
} from "../../stores/clockFormatStore";
import { useClockFormatStore } from "../../stores/clockFormatStore";
import type { DatetimeSettingsProps } from "./types";

const TIMEZONE_LIST = [
  { label: "UTC", value: "UTC" },
  {
    label: "America/New_York (EST)",
    value: "America/New_York",
  },
  {
    label: "America/Chicago (CST)",
    value: "America/Chicago",
  },
  {
    label: "America/Denver (MST)",
    value: "America/Denver",
  },
  {
    label: "America/Los_Angeles (PST)",
    value: "America/Los_Angeles",
  },
  {
    label: "Europe/London (GMT)",
    value: "Europe/London",
  },
  {
    label: "Europe/Paris (CET)",
    value: "Europe/Paris",
  },
  {
    label: "Europe/Berlin (CET)",
    value: "Europe/Berlin",
  },
  {
    label: "Asia/Seoul (KST)",
    value: "Asia/Seoul",
  },
  {
    label: "Asia/Tokyo (JST)",
    value: "Asia/Tokyo",
  },
  {
    label: "Asia/Shanghai (CST)",
    value: "Asia/Shanghai",
  },
  {
    label: "Asia/Hong_Kong (HKT)",
    value: "Asia/Hong_Kong",
  },
  {
    label: "Asia/Singapore (SGT)",
    value: "Asia/Singapore",
  },
  {
    label: "Australia/Sydney (AEDT)",
    value: "Australia/Sydney",
  },
];

function getTimezoneList(): Array<{ label: string; value: string }> {
  const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const systemTzExists = TIMEZONE_LIST.some((tz) => tz.value === systemTz);

  return systemTzExists
    ? TIMEZONE_LIST
    : [
        {
          label: `System Default (${systemTz})`,
          value: systemTz,
        },
        ...TIMEZONE_LIST,
      ];
}

export function DatetimeSettings({
  matchesSearch,
  timeFormat,
  dateOrder,
  dateSeparator,
  setTimeFormat,
  setDateOrder,
  setDateSeparator,
  timezone,
  setTimezone,
}: DatetimeSettingsProps) {
  const { t } = useTranslation();

  return (
    <Stack gap="xl">
      <div>
        <Text size="xl" fw={600} mb="lg">
          {t("settings.datetime.title")}
        </Text>
        <Text size="sm" c="dimmed" mb="xl">
          {t("settings.datetime.description")}
        </Text>

        <Stack gap="lg">
          {matchesSearch(t("settings.datetime.time_format")) && (
            <div>
              <Text size="sm" fw={500} mb={8}>
                {t("settings.datetime.time_format")}
              </Text>
              <Select
                value={timeFormat}
                onChange={(value) => setTimeFormat(value as TimeFormat)}
                data={[
                  { label: "24-Hour (13:34)", value: "24h" },
                  { label: "12-Hour (01:34 PM)", value: "12h" },
                ]}
                placeholder={t("settings.datetime.time_format")}
              />
            </div>
          )}

          {matchesSearch(t("settings.datetime.date_order")) && (
            <div>
              <Text size="sm" fw={500} mb={8}>
                {t("settings.datetime.date_order")}
              </Text>
              <Select
                value={dateOrder}
                onChange={(value) => setDateOrder(value as DateOrder)}
                data={[
                  { label: "Month/Day/Year (MDY)", value: "MDY" },
                  { label: "Day/Month/Year (DMY)", value: "DMY" },
                  { label: "Year/Month/Day (YMD)", value: "YMD" },
                ]}
                placeholder={t("settings.datetime.date_order")}
              />
              <Text size="xs" c="dimmed" mt={4}>
                {t("settings.datetime.date_separator_desc")}
              </Text>
            </div>
          )}

          {matchesSearch(t("settings.datetime.date_separator")) && (
            <div>
              <Text size="sm" fw={500} mb={8}>
                {t("settings.datetime.date_separator")}
              </Text>
              <Select
                value={dateSeparator}
                onChange={(value) => setDateSeparator(value as DateSeparator)}
                data={[
                  { label: "Slash (/)", value: "/" },
                  { label: "Hyphen (-)", value: "-" },
                  { label: "Dot (.)", value: "." },
                ]}
                placeholder={t("settings.datetime.date_separator")}
              />
            </div>
          )}

          {matchesSearch(t("settings.datetime.timezone")) && (
            <div>
              <Text size="sm" fw={500} mb={8}>
                {t("settings.datetime.timezone")}
              </Text>
              <Select
                value={timezone}
                onChange={(value) => {
                  if (value) setTimezone(value);
                }}
                data={getTimezoneList()}
                placeholder={t("settings.datetime.timezone")}
                searchable
              />
            </div>
          )}

          {matchesSearch(t("settings.datetime.preview")) && (
            <div
              style={{
                padding: 16,
                borderRadius: 6,
                backgroundColor: "var(--color-bg-tertiary)",
              }}
            >
              <Text size="sm" fw={500} mb={4}>
                {t("settings.datetime.preview")}
              </Text>
              <Text size="sm">
                {useClockFormatStore.getState().formatDate(new Date())} |{" "}
                {useClockFormatStore.getState().formatTime(new Date())}
              </Text>
            </div>
          )}
        </Stack>
      </div>
    </Stack>
  );
}
