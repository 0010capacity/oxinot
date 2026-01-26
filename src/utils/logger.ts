// src/utils/logger.ts
type LogLevel = "debug" | "info" | "warn" | "error";

const currentLevel: LogLevel = import.meta.env.PROD ? "warn" : "debug";

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function createLogger(module: string) {
  const shouldLog = (level: LogLevel) => levels[level] >= levels[currentLevel];

  return {
    debug: (...args: unknown[]) => {
      if (shouldLog("debug")) console.debug(`[${module}]`, ...args);
    },
    info: (...args: unknown[]) => {
      if (shouldLog("info")) console.info(`[${module}]`, ...args);
    },
    warn: (...args: unknown[]) => {
      if (shouldLog("warn")) console.warn(`[${module}]`, ...args);
    },
    error: (...args: unknown[]) => {
      if (shouldLog("error")) console.error(`[${module}]`, ...args);
    },
    group: (label: string) => {
      if (shouldLog("debug")) console.group(`[${module}]`, label);
    },
    groupEnd: () => {
      if (shouldLog("debug")) console.groupEnd();
    },
    table: (data: unknown) => {
      if (shouldLog("debug")) console.table(data);
    },
  };
}
