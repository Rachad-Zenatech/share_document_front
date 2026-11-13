import { Network, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMessageHubStatus } from "./messageHub/useMessageHubStatus";
import {
  HubDropdownHeader,
  HubDropdownFooter,
  OnlineServerCard,
  OfflineServerRow,
  getStatusDot,
} from "./messageHub/MessageHubServerCards";

export type {
  HubQueueOrStreamItem,
  HubChannelGroupStatus,
  HubConnectedServer,
  MessageHubStatusResponse,
} from "./messageHub/types";

/** Top-bar dropdown showing live RabbitMQ Message Hub and connected app server status. */
export function MessageHubStatusDropdown({ className = "" }: { className?: string }) {
  const {
    resolvedData,
    onlineCount,
    shownTotal,
    hubConnected,
    overallStatus,
    liveServers,
    downServers,
    isTesting,
    handleActiveTest,
  } = useMessageHubStatus();

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
        <HubDropdownHeader
          resolvedData={resolvedData}
          onlineCount={onlineCount}
          shownTotal={shownTotal}
          overallStatus={overallStatus}
          isTesting={isTesting}
          onActiveTest={handleActiveTest}
        />

        <div className="max-h-[min(60vh,30rem)] space-y-4 overflow-y-auto px-4 py-3">
          {liveServers.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Online ({liveServers.length})
              </h3>
              {liveServers.map((srv) => (
                <OnlineServerCard key={srv.id} server={srv} />
              ))}
            </section>
          )}

          {downServers.length > 0 && (
            <section className="space-y-1.5">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Offline ({downServers.length})
              </h3>
              {downServers.map((srv) => (
                <OfflineServerRow key={srv.id} server={srv} />
              ))}
            </section>
          )}
        </div>

        <HubDropdownFooter overallStatus={overallStatus} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
