import { BASE_URL } from "./apiClient";

export type ClientErrorType = "react" | "runtime" | "unhandled_promise";

interface ClientErrorReport {
  error_type: ClientErrorType;
  message: string;
  stack?: string;
  component_stack?: string;
  path: string;
}

const MAX_REPORTS_PER_MINUTE = 10;
const recentReportTimes: number[] = [];
const recentFingerprints = new Map<string, number>();

function sanitize(value: string, maxLength: number): string {
  return value
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/([?&](?:access_?token|id_?token|token)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted-jwt]")
    .slice(0, maxLength);
}

function normalizeError(value: unknown): { message: string; stack?: string } {
  if (value instanceof Error) {
    return { message: value.message || value.name, stack: value.stack };
  }
  if (typeof value === "string") return { message: value };
  return { message: "Unknown browser error" };
}

export function reportClientError(
  errorType: ClientErrorType,
  value: unknown,
  componentStack?: string,
): void {
  const now = Date.now();
  while (recentReportTimes.length && recentReportTimes[0] < now - 60_000) {
    recentReportTimes.shift();
  }
  if (recentReportTimes.length >= MAX_REPORTS_PER_MINUTE) return;

  const normalized = normalizeError(value);
  const fingerprint = `${errorType}:${normalized.message}:${componentStack ?? ""}`.slice(0, 1_000);
  if (now - (recentFingerprints.get(fingerprint) ?? 0) < 5_000) return;

  recentReportTimes.push(now);
  recentFingerprints.set(fingerprint, now);
  const report: ClientErrorReport = {
    error_type: errorType,
    message: sanitize(normalized.message, 2_000),
    stack: normalized.stack ? sanitize(normalized.stack, 8_000) : undefined,
    component_stack: componentStack ? sanitize(componentStack, 8_000) : undefined,
    path: window.location.pathname.slice(0, 2_048),
  };

  void fetch(`${BASE_URL}/api/observability/client-error`, {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
  }).catch(() => undefined);
}

export function installGlobalErrorReporting(): void {
  window.addEventListener("error", (event) => {
    reportClientError("runtime", event.error ?? event.message);
  });
  window.addEventListener("unhandledrejection", (event) => {
    reportClientError("unhandled_promise", event.reason);
  });
}
