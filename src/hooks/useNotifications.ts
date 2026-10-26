import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, BASE_URL } from "@/services/apiClient";

export interface Notification {
  id: number;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link_url: string | null;
  entity_type: string | null;
  entity_id: string | null;
  sender_name: string | null;
  sender_avatar: string | null;
  attachments: any[] | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

/* --------------------------------------------------------------------------
 * Shared notification socket
 *
 * Real-time notifications run over WebSocket rather than SSE: CloudFront caps
 * the total duration of a streaming HTTP response at ~60s, so the old SSE
 * stream was severed every minute and the browser reconnected in a permanent
 * loop (ERR_HTTP2_PROTOCOL_ERROR alongside a 200). WebSockets are exempt.
 *
 * The connection is a module-level singleton rather than per-component state:
 * several components subscribe to notifications, and one socket each meant a
 * growing pile of duplicate connections to the same endpoint.
 * ----------------------------------------------------------------------- */

type NotificationListener = (payload: any) => void;

const RECONNECT_DELAY_MS = 5000;
const MAX_AUTH_RETRIES = 3;
// Once credentials are exhausted, keep a slow poll rather than giving up, so
// the stream recovers on its own after the user signs in again.
const DORMANT_RETRY_MS = 60000;

const listeners = new Set<NotificationListener>();
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let authRetries = 0;

const toWebSocketScheme = (url: string) => url.replace(/^http/i, "ws");

/**
 * An already-expired JWT is worse than none: it is checked first and rejected,
 * whereas omitting it lets the handshake fall back to the HttpOnly auth cookie,
 * which the heartbeat keeps fresh.
 */
function isTokenUsable(token: string | null): token is string {
  if (!token) return false;
  try {
    const claims = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof claims.exp !== "number" || claims.exp * 1000 > Date.now() + 5000;
  } catch {
    return false;
  }
}

function scheduleReconnect(delayMs: number) {
  if (reconnectTimer || listeners.size === 0) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    openSocket();
  }, delayMs);
}

function openSocket() {
  if (listeners.size === 0) return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  let opened = false;
  try {
    const base = /^https?:\/\//i.test(BASE_URL)
      ? toWebSocketScheme(BASE_URL)
      : `${toWebSocketScheme(window.location.origin)}${BASE_URL}`;
    const storedToken = sessionStorage.getItem("token");
    const tokenParam = isTokenUsable(storedToken) ? `?token=${encodeURIComponent(storedToken)}` : "";

    const ws = new WebSocket(`${base}/ws/notifications${tokenParam}`);
    socket = ws;

    ws.onopen = () => {
      opened = true;
      authRetries = 0;
    };

    ws.onmessage = (event) => {
      if (!event.data) return;
      try {
        const payload = JSON.parse(event.data);
        // Keep-alive frames carry no notification payload.
        if (!payload || payload.type === "ping") return;
        listeners.forEach((listener) => {
          try {
            listener(payload);
          } catch {
            // One bad subscriber must not starve the others.
          }
        });
      } catch {
        // Ignore non-JSON frames
      }
    };

    ws.onerror = () => {
      // onclose always follows and owns recovery.
      ws.close();
    };

    ws.onclose = () => {
      if (socket === ws) socket = null;
      if (listeners.size === 0) return;

      if (opened) {
        authRetries = 0;
        scheduleReconnect(RECONNECT_DELAY_MS);
        return;
      }

      // Never opened, so the handshake itself was rejected, which in practice
      // means the credentials expired. There is no status code to inspect:
      // CloudFront rewrites the backend's 403 into a 200 HTML page.
      if (authRetries < MAX_AUTH_RETRIES) {
        authRetries += 1;
        // Silent refresh. The heartbeat re-issues the HttpOnly auth cookie,
        // which the handshake falls back to once the stored token is stale.
        // It is HttpOnly by design, so it cannot be copied into sessionStorage.
        apiClient
          .post("/auth/heartbeat", {})
          .then(() => scheduleReconnect(RECONNECT_DELAY_MS))
          .catch(() => scheduleReconnect(RECONNECT_DELAY_MS * authRetries));
      } else {
        scheduleReconnect(DORMANT_RETRY_MS);
      }
    };
  } catch {
    scheduleReconnect(RECONNECT_DELAY_MS);
  }
}

function subscribeToNotifications(listener: NotificationListener) {
  listeners.add(listener);
  openSocket();

  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    authRetries = 0;
    if (socket) {
      const ws = socket;
      socket = null;
      // Detach first so teardown does not schedule a reconnect.
      ws.onclose = null;
      ws.close();
    }
  };
}

/**
 * Subscribe to the shared notification stream. Always refreshes the
 * notification caches; `onNotification` receives the raw payload for callers
 * that need to react to it directly (toasts, desktop notifications).
 */
export function useNotificationStream(options?: { onNotification?: NotificationListener }) {
  const queryClient = useQueryClient();
  const handlerRef = useRef<NotificationListener | undefined>(options?.onNotification);
  handlerRef.current = options?.onNotification;

  useEffect(() => {
    // Subscribing through a ref keeps a changing callback identity from
    // tearing down and re-opening the shared socket on every render.
    return subscribeToNotifications((payload) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
      handlerRef.current?.(payload);
    });
  }, [queryClient]);
}

export function useNotifications(options?: { refetchInterval?: number | false }) {
  useNotificationStream();
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiClient.get<Notification[]>("/api/notifications"),
    refetchInterval: options?.refetchInterval ?? false,
    refetchOnWindowFocus: true,
  });
}

export function useUnreadNotificationCount(options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => apiClient.get<{ count: number }>("/api/notifications/unread-count"),
    refetchInterval: options?.refetchInterval ?? false,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: number) =>
      apiClient.patch(`/api/notifications/${notificationId}/read`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.patch(`/api/notifications/read-all`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });
}

export function useClearReadNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.delete("/api/notifications/read"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });
}

export function useClearAllNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.delete("/api/notifications/all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });
}
