import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, BASE_URL } from "@/services/apiClient";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Network,
  Server,
  Layers,
  Activity,
  ChevronDown,
  Zap,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const CURRENT_APP_ID = "sec_filing";

export interface HubQueueOrStreamItem {
  name: string;
  type: string;
  state: string;
  consumers: number;
  messages: number;
  working: boolean;
}

export interface HubChannelGroupStatus {
  working: boolean;
  topology_ready: boolean;
  status: "online" | "ready" | "offline";
  consumers: number;
  items: HubQueueOrStreamItem[];
  roundtrip_ms?: number | null;
}

export interface HubConnectedServer {
  id: string;
  name: string;
  service_user: string;
  port: number;
  is_self: boolean;
  online: boolean;
  status: "online" | "degraded" | "offline";
  connection_state: string;
  connections_count: number;
  client_name?: string | null;
  queues: HubChannelGroupStatus;
  streams: HubChannelGroupStatus;
  last_seen?: string | null;
}

export interface MessageHubStatusResponse {
  status: "online" | "degraded" | "offline";
  connected: boolean;
  checked_at: string;
  hub: {
    name: string;
    status: "online" | "offline";
    connected: boolean;
    host: string;
    management_url: string;
    management_api_reachable: boolean;
    vhost: string;
    version: string;
    total_connections: number;
    online_servers: number;
    total_servers: number;
  };
  active_test?: {
    tested_at: string;
    queue_roundtrip_ok: boolean;
    queue_roundtrip_ms: number | null;
    stream_publish_ok: boolean;
    stream_roundtrip_ms: number | null;
  } | null;
  servers: HubConnectedServer[];
}

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
    name, type, state: "offline", consumers: 0, messages: 0, working: false,
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

export function MessageHubStatusDropdown({ className = "" }: { className?: string }) {
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

  const getStatusDot = (status: string) => {
    switch (status) {
      case "online":
        return "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.75)] animate-pulse";
      case "degraded":
        return "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.75)] animate-pulse";
      case "offline":
      default:
        return "bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.75)]";
    }
  };

  const getServerBadge = (online: boolean, status: string) => {
    if (online) {
      return (
        <Badge
          variant="outline"
          className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0 gap-1"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          ONLINE
        </Badge>
      );
    }
    if (status === "degraded") {
      return (
        <Badge
          variant="outline"
          className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0 gap-1"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          DEGRADED
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[10px] px-1.5 py-0 gap-1"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
        OFFLINE
      </Badge>
    );
  };

  const formatLastSeen = (iso?: string | null) => {
    if (!iso) return "No heartbeat";
    try {
      const diffSec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
      if (diffSec < 5) return "Just now";
      if (diffSec < 60) return `${diffSec}s ago`;
      return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return "Live";
    }
  };

  // This app first, then the apps that are up, then the rest by name
  const orderedServers = [...servers].sort((a, b) => {
    if (!!a.is_self !== !!b.is_self) return a.is_self ? -1 : 1;
    if (a.online !== b.online) return a.online ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const liveServers = orderedServers.filter((s) => s.online);
  const downServers = orderedServers.filter((s) => !s.online);
  const shownTotal = totalCount || HUB_SERVERS.length;

  const renderMetric = (label: string, unit: string, Icon: typeof Layers, iconClass: string, group: HubChannelGroupStatus) => (
    <div className="rounded-lg border border-border/40 bg-background/70 p-2">
      <div className="flex items-center justify-between gap-1">
        <span className="flex items-center gap-1 text-[11px] font-medium text-foreground">
          <Icon className={`h-3.5 w-3.5 ${iconClass}`} />
          {label}
        </span>
        {group.working ? (
          <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            OK
          </span>
        ) : (
          <span className="flex items-center gap-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
            <XCircle className="h-3 w-3" />
            Down
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
        <span>
          {group.items.length} {unit}
        </span>
        <span>{group.roundtrip_ms != null ? `${group.roundtrip_ms}ms` : `c:${group.consumers}`}</span>
      </div>
    </div>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="RabbitMQ Message Hub Live Server Status"
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full text-xs font-medium border border-border/60 bg-background/80 hover:bg-muted/60 transition-all duration-150 cursor-pointer shadow-sm ${className}`}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${getStatusDot(overallStatus)}`} />
          <Network className="h-3.5 w-3.5 text-primary hidden sm:inline-block" />
          <span className="hidden sm:inline-block text-foreground font-mono text-[11px]">
            {hubConnected ? `Hub ${onlineCount}/${shownTotal}` : "Hub Offline"}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground/70" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="flex w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-xl border-border bg-popover/95 p-0 shadow-xl backdrop-blur sm:w-[26rem]"
      >
        {/* Header (stays in view while the list scrolls) */}
        <div className="space-y-3 border-b border-border/60 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <Network className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-foreground">RabbitMQ Message Hub</span>
                {resolvedData.hub?.vhost && (
                  <Badge variant="secondary" className="h-4 px-1.5 py-0 font-mono text-[10px]">
                    {resolvedData.hub.vhost}
                  </Badge>
                )}
              </div>
              <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
                {resolvedData.hub?.host || "127.0.0.1:5672"} • RabbitMQ v{resolvedData.hub?.version || "4.x"}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleActiveTest}
              disabled={isTesting}
              className="h-7 shrink-0 gap-1.5 px-2.5 text-[11px] text-foreground"
              title="Actively test Queues and Streams round-trip"
            >
              <RefreshCw className={`h-3 w-3 ${isTesting ? "animate-spin text-primary" : ""}`} />
              Test Hub
            </Button>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Application servers</span>
              <span className="font-mono">
                {onlineCount}/{shownTotal} online
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${overallStatus === "online" ? "bg-emerald-500" : "bg-amber-500"}`}
                style={{ width: `${shownTotal ? (onlineCount / shownTotal) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Scrolling list */}
        <div className="max-h-[min(60vh,30rem)] space-y-4 overflow-y-auto px-4 py-3">
          {liveServers.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Online ({liveServers.length})
              </h3>
              {liveServers.map((srv) => (
                <div key={srv.id} className="space-y-2.5 rounded-xl border border-border/50 bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                        <Server className="h-4 w-4 text-emerald-500" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-semibold text-foreground">{srv.name}</span>
                          {srv.is_self && (
                            <Badge variant="secondary" className="h-3.5 px-1 py-0 text-[9px] font-medium">
                              This App
                            </Badge>
                          )}
                        </div>
                        <span className="block truncate font-mono text-[10px] text-muted-foreground">
                          {srv.service_user}
                        </span>
                      </div>
                    </div>
                    {getServerBadge(srv.online, srv.status)}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {renderMetric("Queues", "queues", Layers, "text-blue-500", srv.queues)}
                    {renderMetric("Streams", "streams", Activity, "text-purple-500", srv.streams)}
                  </div>

                  <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                    <span>{srv.connection_state}</span>
                    <span>Heartbeat: {formatLastSeen(srv.last_seen)}</span>
                  </div>
                </div>
              ))}
            </section>
          )}

          {downServers.length > 0 && (
            <section className="space-y-1.5">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Offline ({downServers.length})
              </h3>
              {downServers.map((srv) => (
                <div
                  key={srv.id}
                  title={`State: DISCONNECTED • ${formatLastSeen(srv.last_seen)}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Server className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                    <span className="truncate text-xs font-medium text-foreground/80">{srv.name}</span>
                  </div>
                  {getServerBadge(srv.online, srv.status)}
                </div>
              ))}
            </section>
          )}
        </div>

        {/* Footer (stays in view) */}
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-amber-500" />
            Live event stream + 3s sync
          </span>
          <div className="flex items-center gap-1 font-medium">
            {overallStatus === "online" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            ) : overallStatus === "degraded" ? (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-rose-500" />
            )}
            <span className="capitalize">{overallStatus}</span>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
