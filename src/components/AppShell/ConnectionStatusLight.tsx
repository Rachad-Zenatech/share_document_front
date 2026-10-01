import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Radio,
  Server,
  Database,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface IntegratedService {
  id: string;
  name: string;
  state: string;
  status: "online" | "degraded" | "recovering" | "offline";
  description?: string;
  mode?: string;
  failure_count?: number;
  endpoint?: string;
}

export interface IntegrationStatusResponse {
  status: "healthy" | "degraded" | "recovering" | "offline";
  services: IntegratedService[];
}

export function ConnectionStatusLight({ className = "" }: { className?: string }) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, refetch, isError } = useQuery<IntegrationStatusResponse>({
    queryKey: ["integration-status"],
    queryFn: async () => {
      // 1. Try standard /api/integration/status
      try {
        const res = await apiClient.get<IntegrationStatusResponse>("/api/integration/status");
        if (res && Array.isArray(res.services)) return res;
      } catch {
        // Fallthrough to alternative paths
      }

      // 2. Try /api/purchasing/integration/status (for m7a router prefix)
      try {
        const res = await apiClient.get<IntegrationStatusResponse>("/api/purchasing/integration/status");
        if (res && Array.isArray(res.services)) return res;
      } catch {
        // Fallthrough
      }

      // 3. Fallback to basic alive indicators
      try {
        await apiClient.get("/health/live");
        return {
          status: "healthy",
          services: [
            {
              id: "backend_api",
              name: "Backend Application API",
              state: "CONNECTED",
              status: "online",
              mode: "Live API",
              description: "FastAPI business logic gateway",
            },
            {
              id: "realtime_sse",
              name: "Real-time Notification Stream (SSE)",
              state: "STREAMING",
              status: "online",
              mode: "30s Keep-Alive",
              description: "Event-driven zero-DB streaming connection",
            },
          ],
        };
      } catch {
        return {
          status: "offline",
          services: [
            {
              id: "backend_api",
              name: "Backend Application API",
              state: "DISCONNECTED",
              status: "offline",
              mode: "Unreachable",
              description: "Could not reach backend gateway",
            },
          ],
        };
      }
    },
    staleTime: 15000,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const overallStatus = isError ? "offline" : data?.status ?? "healthy";
  const services = data?.services ?? [];

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case "healthy":
      case "online":
        return "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse";
      case "degraded":
      case "recovering":
        return "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)] animate-pulse";
      case "offline":
      default:
        return "bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "healthy":
      case "online":
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0">
            Live API
          </Badge>
        );
      case "degraded":
      case "recovering":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0">
            Fallback Mode
          </Badge>
        );
      case "offline":
      default:
        return (
          <Badge variant="outline" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[10px] px-1.5 py-0">
            Offline
          </Badge>
        );
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
      case "online":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />;
      case "degraded":
      case "recovering":
        return <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />;
      case "offline":
      default:
        return <XCircle className="h-4 w-4 text-rose-500 flex-shrink-0" />;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Application Connection Status"
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full text-xs font-medium border border-border/60 bg-background/80 hover:bg-muted/60 transition-all duration-150 cursor-pointer shadow-sm ${className}`}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${getStatusDot(overallStatus)}`} />
          <span className="hidden sm:inline-block text-muted-foreground font-mono text-[11px]">
            {overallStatus === "healthy" ? "Live" : overallStatus === "degraded" ? "Fallback" : "Offline"}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground/70" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-84 p-3 bg-popover/95 backdrop-blur border-border shadow-xl rounded-xl">
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary animate-pulse" />
            <span className="font-semibold text-xs text-foreground uppercase tracking-wider">
              Integration Matrix
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
            Refresh
          </Button>
        </div>

        <DropdownMenuSeparator className="my-1" />

        <div className="space-y-2 pt-1">
          {services.length === 0 ? (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>All direct connections active & healthy</span>
            </div>
          ) : (
            services.map((svc) => (
              <div
                key={svc.id}
                className="p-2 rounded-lg bg-muted/30 border border-border/40 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {svc.id.includes("db") || svc.id.includes("database") ? (
                      <Database className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <Server className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="font-medium text-xs text-foreground truncate">
                      {svc.name}
                    </span>
                  </div>
                  {getStatusBadge(svc.status)}
                </div>

                {svc.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {svc.description}
                  </p>
                )}

                {svc.mode && (
                  <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground/80 font-mono">
                    <span>Mode: {svc.mode}</span>
                    <span className="uppercase">{svc.state}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <DropdownMenuSeparator className="my-2" />

        <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
          <span>Overall Health</span>
          <div className="flex items-center gap-1">
            {getStatusIcon(overallStatus)}
            <span className="capitalize font-medium">{overallStatus}</span>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
