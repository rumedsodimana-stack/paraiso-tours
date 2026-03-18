const DEBUG = process.env.NODE_ENV === "development";
const DEBUG_CLIENT = DEBUG && typeof window !== "undefined";

export function debugLog(label: string, data?: unknown) {
  if (DEBUG) {
    console.log(`[Paraíso] ${label}`, data ?? "");
  }
}

export function debugWarn(label: string, data?: unknown) {
  if (DEBUG) {
    console.warn(`[Paraíso] ${label}`, data ?? "");
  }
}

export function debugError(label: string, data?: unknown) {
  console.error(`[Paraíso] ${label}`, data ?? "");
}

/** Client-only logs (browser console). */
export function debugClient(label: string, data?: unknown) {
  if (DEBUG_CLIENT) {
    console.log(`[Paraíso] ${label}`, data ?? "");
  }
}
