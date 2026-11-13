import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, BASE_URL } from "@/services/apiClient";
import type {
  HubConnectedServer,
  HubQueueOrStreamItem,
  MessageHubStatusResponse,
} from "./types";

const CURRENT_APP_ID = "sec_filing";

function forceServerOffline(srv: HubConnectedServer): HubConnectedServer {
  return {
    ...srv,
    online: false,
    status: "offline",
    connection_state: "DISCONNECTED",
    connections_count: 0,
    queues: {
      ...srv.queues,
      working: false,
      status: "offline",
      consumers: 0,
      roundtrip_ms: null,
    },
    streams: {
      ...srv.streams,
      working: false,
      status: "offline",
      consumers: 0,
      roundtrip_ms: null,
    },
  };
}

const HUB_SERVERS: { id: string; name: string; user: string; port: number }[] = [
  { id: "ma", name: "M&A", user: "acquisition_service", port: 8003 },
  { id: "administration", name: "Administration", user: "administration_service", port: 8002 },
  { id: "ceo", name: "CEO Dashboard", user: "ceo_service", port: 8000 },
  { id: "social_media_compliance", name: "Social Media Compliance", user: "compliance_service", port: 8009 },
  { id: "finance", name: "Finance (Enterprise System)", user: "finance_service", port: 8001 },
  { id: "marketing", name: "Marketing Management", user: "marketing_service", port: 8010 },
  { id: "sec_filing", name: "SEC Filing (Share Document)", user: "sec_filing_service", port: 8006 },
  { id: "travel", name: "Travel Management", user: "travel_service", port: 8008 },
  { id: "real_estate", name: "Real Estate", user: "real_estate_service", port: 8007 },
];

// Backends that serve /api/message-hub/status; asked when this app's own backend is down
const PEER_BACKEND_URLS = ["travel", "marketing", "administration", "ceo"]
  .filter((id) => id !== CURRENT_APP_ID)
  .map((id) => `http://127.0.0.1:${HUB_SERVERS.find((h) => h.id === id)!.port}`);

function buildOfflineServer(s: { id: string; name: string; user: string; port: number }): HubConnectedServer {
  const q = (name: string, type: string): HubQueueOrStreamItem => ({
    name,
    type,
    state: "offline",
    consumers: 0,
    messages: 0,
    working: false,
  });
  return {
    id: s.id,
    name: s.name,
    service_user: s.user,
    port: s.port,
    is_self: s.id === CURRENT_APP_ID,
    online: false,
    status: "offline",
    connection_state: "DISCONNECTED",
    connections_count: 0,
    queues: {
      working: false,
      topology_ready: false,
      status: "offline",
      consumers: 0,
      items: [
        q(`${s.id}.commands`, "classic"),
        q(`${s.id}.commands.dlq`, "classic"),
        q(`ceo.${s.id}.events`, "classic"),
      ],
      roundtrip_ms: null,
    },
    streams: {
      working: false,
      topology_ready: false,
      status: "offline",
      consumers: 0,
      items: [q(`${s.id}.events.stream`, "stream"), q("hub.presence.stream", "stream")],
      roundtrip_ms: null,
    },
    last_seen: null,
  };
}

function buildAllOfflineFallback(previous?: MessageHubStatusResponse): MessageHubStatusResponse {
  const nowIso = new Date().toISOString();
  const baseServers: HubConnectedServer[] =
    previous?.servers && previous.servers.length > 0
      ? previous.servers.map((s) => ({
          ...forceServerOffline(s),
          is_self: s.id === CURRENT_APP_ID,
        }))
      : HUB_SERVERS.map(buildOfflineServer);

  return {
    status: "offline",
    connected: false,
    checked_at: nowIso,
    hub: {
      name: "RabbitMQ Message Hub",
      status: "offline",
      connected: false,
      host: previous?.hub?.host || "127.0.0.1:5672",
      management_url: previous?.hub?.management_url || "http://127.0.0.1:15672",
      management_api_reachable: false,
      vhost: previous?.hub?.vhost || "zenatech-local",
      version: previous?.hub?.version || "4.4.0",
      total_connections: 0,
      online_servers: 0,
      total_servers: baseServers.length,
    },
    active_test: null,
    servers: baseServers,
  };
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 1800): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Fetches, streams via SSE, and tests live RabbitMQ Message Hub status. */
export function useMessageHubStatus() {
  const [isTesting, setIsTesting] = useState(false);
  const queryClient = useQueryClient();

  const { data, refetch } = useQuery<MessageHubStatusResponse>({
    queryKey: ["message-hub-live-status"],
    queryFn: async () => {
      const previous = queryClient.getQueryData<MessageHubStatusResponse>(["message-hub-live-status"]);

      // 1. Try local backend first
      try {
        const res = await apiClient.get<MessageHubStatusResponse>("/api/message-hub/status");
        if (res && Array.isArray(res.servers)) {
          return res;
        }
      } catch {
        // Local backend is turned off / unreachable — fall through to peer backend
      }

      // 2. Local backend is offline: ask a surviving peer backend so we still see live hub status
      // while forcing This App's entry to OFFLINE
      for (const peerUrl of PEER_BACKEND_URLS) {
        try {
          const peerResp = await fetchWithTimeout(`${peerUrl}/api/message-hub/status`, {
            method: "GET",
            credentials: "include",
            headers: { Accept: "application/json" },
          });
          if (!peerResp.ok) continue;
          const peerData = (await peerResp.json()) as MessageHubStatusResponse;
          if (!peerData || !Array.isArray(peerData.servers)) continue;
          const adjustedServers = peerData.servers.map((srv) =>
            srv.id === CURRENT_APP_ID ? { ...forceServerOffline(srv), is_self: true } : { ...srv, is_self: false },
          );
          const onlineCount = adjustedServers.filter((s) => s.online).length;
          return {
            ...peerData,
            status: onlineCount === adjustedServers.length ? "online" : onlineCount > 0 ? "degraded" : "offline",
            connected: peerData.connected,
            hub: { ...peerData.hub, online_servers: onlineCount, total_servers: adjustedServers.length },
            servers: adjustedServers,
          } as MessageHubStatusResponse;
        } catch {
          // This peer is unreachable too; try the next one
        }
      }

      // 3. Both backends unreachable: mark all servers inside dropdown as OFFLINE
      return buildAllOfflineFallback(previous);
    },
    staleTime: 1500,
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    retry: false,
  });

  // Real-time SSE listener: receives instant cross-server disconnect/reconnect pushes
  useEffect(() => {
    const streamUrl = `${BASE_URL || ""}/api/message-hub/stream`;
    let es: EventSource | null = null;
    try {
      es = new EventSource(streamUrl, { withCredentials: true });
      es.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data) as MessageHubStatusResponse;
          if (payload && Array.isArray(payload.servers)) {
            queryClient.setQueryData(["message-hub-live-status"], payload);
          }
        } catch {
          // Ignore malformed event
        }
      };
      es.onerror = () => {
        // When This App's server stops, SSE drops immediately — trigger refetch to flip This App to OFFLINE
        refetch();
      };
    } catch {
      // EventSource not available
    }
    return () => {
      if (es) es.close();
    };
  }, [queryClient, refetch]);

  const handleActiveTest = async () => {
    setIsTesting(true);
    try {
      const tested = await apiClient.post<MessageHubStatusResponse>("/api/message-hub/test", {});
      if (tested && Array.isArray(tested.servers)) {
        queryClient.setQueryData(["message-hub-live-status"], tested);
      } else {
        await refetch();
      }
    } catch {
      await refetch();
    } finally {
      setTimeout(() => setIsTesting(false), 400);
    }
  };

  const resolvedData = data ?? buildAllOfflineFallback();
  const servers = resolvedData.servers;
  const onlineCount = servers.filter((s) => s.online).length;
  const totalCount = servers.length;
  const hubConnected = Boolean(resolvedData.connected && onlineCount > 0);
  const overallStatus: "online" | "degraded" | "offline" =
    !resolvedData.connected || onlineCount === 0
      ? "offline"
      : onlineCount < totalCount
      ? "degraded"
      : "online";

  // This app first, then the apps that are up, then the rest by name
  const orderedServers = [...servers].sort((a, b) => {
    if (!!a.is_self !== !!b.is_self) return a.is_self ? -1 : 1;
    if (a.online !== b.online) return a.online ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return {
    resolvedData,
    onlineCount,
    shownTotal: totalCount || HUB_SERVERS.length,
    hubConnected,
    overallStatus,
    liveServers: orderedServers.filter((s) => s.online),
    downServers: orderedServers.filter((s) => !s.online),
    isTesting,
    handleActiveTest,
  };
}
