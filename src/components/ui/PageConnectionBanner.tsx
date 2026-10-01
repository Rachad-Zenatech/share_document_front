import { Badge } from "@/components/ui/badge";

export interface PageConnectionBannerProps {
  serviceName: string;
  state?: "online" | "degraded" | "recovering" | "offline";
  mode?: string;
  description?: string;
  className?: string;
}

export function PageConnectionBanner({
  serviceName,
  state = "online",
  mode,
  description,
  className = "",
}: PageConnectionBannerProps) {
  const isOnline = state === "online";
  const isDegraded = state === "degraded" || state === "recovering";

  return (
    <div
      className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs mb-3 transition-colors ${
        isOnline
          ? "bg-emerald-500/5 border-emerald-500/20 text-foreground"
          : isDegraded
          ? "bg-amber-500/5 border-amber-500/20 text-foreground"
          : "bg-rose-500/5 border-rose-500/20 text-foreground"
      } ${className}`}
    >
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          {isOnline && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          )}
          <span
            className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
              isOnline ? "bg-emerald-500" : isDegraded ? "bg-amber-500" : "bg-rose-500"
            }`}
          />
        </span>
        <span className="font-semibold text-xs">{serviceName}</span>
        {description && <span className="text-muted-foreground hidden sm:inline">• {description}</span>}
      </div>

      <div className="flex items-center gap-1.5">
        <Badge
          variant="outline"
          className={`text-[10px] font-bold px-2 py-0.5 ${
            isOnline
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
              : isDegraded
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
          }`}
        >
          {mode || (isOnline ? "Connected" : isDegraded ? "Fallback Mode" : "Disconnected")}
        </Badge>
      </div>
    </div>
  );
}

export default PageConnectionBanner;
