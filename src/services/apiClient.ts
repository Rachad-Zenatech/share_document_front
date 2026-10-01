import { handleResponse } from "./helper";

export interface ActiveApiAction {
  id: string;
  method: string;
  endpoint: string;
  title: string;
  subtitle: string;
  startedAt: number;
}

const activeActions = new Map<string, ActiveApiAction>();
const actionListeners = new Set<(actions: ActiveApiAction[]) => void>();

export function subscribeToApiActions(listener: (actions: ActiveApiAction[]) => void): () => void {
  actionListeners.add(listener);
  listener(Array.from(activeActions.values()));
  return () => {
    actionListeners.delete(listener);
  };
}

function notifyActionListeners() {
  const list = Array.from(activeActions.values());
  actionListeners.forEach((fn) => {
    try {
      fn(list);
    } catch (e) {
      console.error("Error in action listener", e);
    }
  });
}

export interface ApiRequestOptions extends RequestInit {
  actionLabel?: string;
  actionSubtitle?: string;
  skipGlobalLoading?: boolean;
}

function resolveActionMeta(
  method: string,
  endpoint: string,
  _body?: unknown,
  customLabel?: string,
  customSubtitle?: string
): { title: string; subtitle: string } {
  if (customLabel) {
    return {
      title: customLabel,
      subtitle: customSubtitle || "Please wait while your request is being processed...",
    };
  }

  const m = method.toUpperCase();
  const lower = endpoint.toLowerCase();

  // Authentication
  if (lower.includes("/auth/logout") || lower.includes("/logout")) {
    return {
      title: "Signing Out",
      subtitle: "Ending your session safely...",
    };
  }
  if (lower.includes("/auth/login") || lower.includes("/login")) {
    return {
      title: "Authenticating",
      subtitle: "Verifying your credentials...",
    };
  }

  // RBAC & Configurations
  if (lower.includes("/configuration/users") || lower.includes("/users")) {
    if (m === "DELETE") return { title: "Removing User", subtitle: "Updating user access records..." };
    if (m === "POST") return { title: "Creating User", subtitle: "Provisioning account and permissions..." };
    return { title: "Updating User", subtitle: "Saving user details and status..." };
  }

  if (lower.includes("/configuration/roles") || lower.includes("/roles")) {
    if (m === "DELETE") return { title: "Deleting Role", subtitle: "Removing role and attached rules..." };
    if (m === "POST") return { title: "Creating Role", subtitle: "Saving role definitions..." };
    return { title: "Updating Role", subtitle: "Saving role configuration..." };
  }

  if (lower.includes("/permission")) {
    return { title: "Updating Permissions", subtitle: "Synchronizing RBAC access controls..." };
  }

  if (lower.includes("/notifications")) {
    if (lower.includes("/read-all")) {
      return { title: "Marking All as Read", subtitle: "Updating notifications..." };
    }
    return { title: "Updating Notification", subtitle: "Please wait..." };
  }

  // General fallbacks based on HTTP method
  if (m === "DELETE") {
    return {
      title: "Deleting Record",
      subtitle: "Please wait while the record is removed...",
    };
  }

  if (m === "POST") {
    return {
      title: "Creating Record",
      subtitle: "Please wait while the new record is created...",
    };
  }

  return {
    title: "Saving Changes",
    subtitle: "Please wait while your changes are being saved...",
  };
}

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || "";
export const BASE_URL = rawBaseUrl.endsWith("/") ? rawBaseUrl.slice(0, -1) : rawBaseUrl;

const getAuthHeaders = (): Record<string, string> => {
  const token = sessionStorage.getItem("token");
  return token ? { "Authorization": `Bearer ${token}` } : {};
};

const configuredSlowRequestMs = Number(import.meta.env.VITE_SLOW_REQUEST_MS ?? 2000);
const SLOW_REQUEST_MS = Number.isFinite(configuredSlowRequestMs)
  ? Math.max(250, configuredSlowRequestMs)
  : 2000;
const MAX_PERFORMANCE_REPORTS_PER_MINUTE = 5;
const PERFORMANCE_DEDUPLICATION_MS = 60_000;
const performanceReportTimes: number[] = [];
const recentPerformanceReports = new Map<string, number>();

async function monitoredFetch(endpoint: string, options: ApiRequestOptions): Promise<Response> {
  const started = performance.now();
  let statusCode = 0;
  
  let targetEndpoint = endpoint;
  if (!targetEndpoint.startsWith("/api/") && !targetEndpoint.startsWith("/ai/")) {
    const path = targetEndpoint.startsWith("/") ? targetEndpoint : `/${targetEndpoint}`;
    if (path.startsWith("/api/")) {
      targetEndpoint = path;
    } else if (path.startsWith("/ai/")) {
      targetEndpoint = path;
    } else if (path === "/api" || path === "/api/") {
      targetEndpoint = "/api/";
    } else if (path === "/ai" || path === "/ai/") {
      targetEndpoint = "/ai/";
    } else {
      targetEndpoint = `/api${path}`;
    }
  }

  const method = (options.method || "GET").toUpperCase();
  const isMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const isIgnored =
    Boolean(options.skipGlobalLoading) ||
    targetEndpoint.includes("/observability/") ||
    targetEndpoint.includes("/client-performance") ||
    targetEndpoint.includes("/heartbeat") ||
    targetEndpoint.includes("/stream");

  let actionId: string | null = null;
  if (isMutating && !isIgnored) {
    actionId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const customLabel = options.actionLabel;
    const customSubtitle = options.actionSubtitle;
    const meta = resolveActionMeta(method, targetEndpoint, options.body, customLabel, customSubtitle);
    activeActions.set(actionId, {
      id: actionId,
      method,
      endpoint: targetEndpoint,
      title: meta.title,
      subtitle: meta.subtitle,
      startedAt: Date.now(),
    });
    notifyActionListeners();
  }

  try {
    const response = await fetch(`${BASE_URL}${targetEndpoint}`, options);
    statusCode = response.status;
    return response;
  } finally {
    if (actionId) {
      activeActions.delete(actionId);
      notifyActionListeners();
    }
    const durationMs = performance.now() - started;
    if (
      durationMs >= SLOW_REQUEST_MS &&
      !targetEndpoint.startsWith("/api/observability/")
    ) {
      const now = Date.now();
      while (performanceReportTimes.length && performanceReportTimes[0] < now - 60_000) {
        performanceReportTimes.shift();
      }
      for (const [key, reportedAt] of recentPerformanceReports) {
        if (reportedAt < now - PERFORMANCE_DEDUPLICATION_MS) {
          recentPerformanceReports.delete(key);
        }
      }
      const fetchMethod = options.method ?? "GET";
      const path = endpoint.split("?", 1)[0];
      const fingerprint = `${fetchMethod}:${path}`;
      const lastReportedAt = recentPerformanceReports.get(fingerprint) ?? 0;
      if (
        performanceReportTimes.length < MAX_PERFORMANCE_REPORTS_PER_MINUTE &&
        now - lastReportedAt >= PERFORMANCE_DEDUPLICATION_MS
      ) {
        performanceReportTimes.push(now);
        recentPerformanceReports.set(fingerprint, now);
        void fetch(`${BASE_URL}/api/observability/client-performance`, {
          method: "POST",
          credentials: "include",
          keepalive: true,
          headers: { 
            "Content-Type": "application/json",
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            method: fetchMethod,
            path,
            duration_ms: durationMs,
            status_code: statusCode,
          }),
        }).catch(() => undefined);
      }
    }
  }
}

export const apiClient = {
  async get<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    const res = await monitoredFetch(endpoint, {
      ...options, 
      method: "GET",
      credentials: "include",
      headers: {
        ...getAuthHeaders(),
        ...(options?.headers as Record<string, string>)
      } as HeadersInit
    });
    return handleResponse<T>(res);
  },
  
  async post<T>(endpoint: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
    const isFormData = body instanceof FormData;
    const res = await monitoredFetch(endpoint, {
      ...options,
      method: "POST",
      credentials: "include",
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...getAuthHeaders(),
        ...(options?.headers as Record<string, string>),
      } as HeadersInit,
      body: isFormData ? body : JSON.stringify(body),
    });
    return handleResponse<T>(res);
  },
  
  async patch<T>(endpoint: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
    const res = await monitoredFetch(endpoint, {
      ...options,
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
        ...(options?.headers as Record<string, string>),
      } as HeadersInit,
      body: JSON.stringify(body),
    });
    return handleResponse<T>(res);
  },
  
  async put<T>(endpoint: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
    const res = await monitoredFetch(endpoint, {
      ...options,
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
        ...(options?.headers as Record<string, string>),
      } as HeadersInit,
      body: JSON.stringify(body),
    });
    return handleResponse<T>(res);
  },
  
  async delete<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    const res = await monitoredFetch(endpoint, {
      ...options, 
      method: "DELETE",
      credentials: "include",
      headers: {
        ...getAuthHeaders(),
        ...(options?.headers as Record<string, string>)
      } as HeadersInit
    });
    return handleResponse<T>(res);
  },
  
  async downloadFile(endpoint: string, filename: string): Promise<void> {
    const res = await monitoredFetch(endpoint, {
      method: "GET",
      credentials: "include",
      headers: {
        ...getAuthHeaders(),
      } as HeadersInit
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error((err as { detail: string }).detail || "Request failed");
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
};
