import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Network,
  Server,
  Layers,
  Activity,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  HubChannelGroupStatus,
  HubConnectedServer,
  MessageHubStatusResponse,
} from "./types";

export function getStatusDot(status: string): string {
  switch (status) {
    case "online":
      return "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.75)] animate-pulse";
    case "degraded":
      return "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.75)] animate-pulse";
    case "offline":
    default:
      return "bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.75)]";
  }
}

function formatLastSeen(iso?: string | null): string {
  if (!iso) return "No heartbeat";
  try {
    const diffSec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (diffSec < 5) return "Just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "Live";
  }
}

function ServerStatusBadge({ online, status }: { online: boolean; status: string }) {
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
}

function ChannelMetricCard({
  label,
  unit,
  Icon,
  iconClass,
  group,
}: {
  label: string;
  unit: string;
  Icon: typeof Layers;
  iconClass: string;
  group: HubChannelGroupStatus;
}) {
  return (
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
}

/** Card for an online application server showing queues, streams, and heartbeat. */
export function OnlineServerCard({ server: srv }: { server: HubConnectedServer }) {
  return (
    <div className="space-y-2.5 rounded-xl border border-border/50 bg-muted/30 p-3">
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
        <ServerStatusBadge online={srv.online} status={srv.status} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ChannelMetricCard label="Queues" unit="queues" Icon={Layers} iconClass="text-blue-500" group={srv.queues} />
        <ChannelMetricCard label="Streams" unit="streams" Icon={Activity} iconClass="text-purple-500" group={srv.streams} />
      </div>

      <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
        <span>{srv.connection_state}</span>
        <span>Heartbeat: {formatLastSeen(srv.last_seen)}</span>
      </div>
    </div>
  );
}

/** Compact row for an offline application server. */
export function OfflineServerRow({ server: srv }: { server: HubConnectedServer }) {
  return (
    <div
      title={`State: DISCONNECTED • ${formatLastSeen(srv.last_seen)}`}
      className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Server className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
        <span className="truncate text-xs font-medium text-foreground/80">{srv.name}</span>
      </div>
      <ServerStatusBadge online={srv.online} status={srv.status} />
    </div>
  );
}

/** Sticky header for the Message Hub dropdown showing broker info and test button. */
export function HubDropdownHeader({
  resolvedData,
  onlineCount,
  shownTotal,
  overallStatus,
  isTesting,
  onActiveTest,
}: {
  resolvedData: MessageHubStatusResponse;
  onlineCount: number;
  shownTotal: number;
  overallStatus: "online" | "degraded" | "offline";
  isTesting: boolean;
  onActiveTest: () => void;
}) {
  return (
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
          onClick={onActiveTest}
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
  );
}

/** Sticky footer for the Message Hub dropdown. */
export function HubDropdownFooter({ overallStatus }: { overallStatus: "online" | "degraded" | "offline" }) {
  return (
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
  );
}
