/**
 * Structured logger for Paraíso Ceylon Tours.
 * Logs to console; use LOG_LEVEL env (debug|info|warn|error) to control verbosity.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  meta?: Record<string, unknown>;
  error?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";
const minLevelNum = LOG_LEVELS[minLevel] ?? 1;

function shouldLog(level: LogLevel): boolean {
  return (LOG_LEVELS[level] ?? 1) >= minLevelNum;
}

function formatEntry(entry: LogEntry): string {
  const meta = entry.meta ? ` ${JSON.stringify(entry.meta)}` : "";
  const err = entry.error ? ` | ${entry.error}` : "";
  return `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.context ? `[${entry.context}] ` : ""}${entry.message}${meta}${err}`;
}

function createLogger(context?: string) {
  const log = (level: LogLevel, message: string, meta?: Record<string, unknown>, error?: unknown) => {
    if (!shouldLog(level)) return;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      meta,
      error: error instanceof Error ? error.message : error ? String(error) : undefined,
    };
    const formatted = formatEntry(entry);
    if (level === "error") {
      console.error(formatted);
      if (error instanceof Error) console.error(error.stack);
    } else if (level === "warn") {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  };

  return {
    debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
    info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
    warn: (msg: string, meta?: Record<string, unknown>, err?: unknown) => log("warn", msg, meta, err),
    error: (msg: string, meta?: Record<string, unknown>, err?: unknown) => log("error", msg, meta, err),
  };
}

export const logger = createLogger();
export const authLogger = createLogger("auth");
export const apiLogger = createLogger("api");
export const dbLogger = createLogger("db");
