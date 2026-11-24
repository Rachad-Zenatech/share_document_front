import { Cpu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { AiCoreStatus } from "@/types/aiOverview";
import { STATUS_BADGE_CLASS, STATUS_LABEL, formatCount } from "./statusStyles";

export default function AiCoresGrid({
  cores,
  selectedCore,
  onSelectCore,
}: {
  cores: AiCoreStatus[];
  selectedCore: string;
  onSelectCore: (coreId: string) => void;
}) {
  return (
    <Card className="p-4 shadow-xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">AI Cores & Engines</h2>
          <span className="text-xs text-muted-foreground">
            Click a core to filter which features run on it
          </span>
        </div>
        {selectedCore !== "ALL" && (
          <button
            type="button"
            onClick={() => onSelectCore("ALL")}
            className="text-xs font-medium text-primary hover:underline"
          >
            Show all cores
          </button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cores.map((core) => {
          const isSelected = selectedCore === core.core;
          return (
            <button
              key={core.core}
              type="button"
              onClick={() => onSelectCore(isSelected ? "ALL" : core.core)}
              className={`flex flex-col justify-between rounded-lg border p-3 text-left transition hover:border-primary/60 ${
                isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border/80 bg-card"
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground leading-snug">{core.name}</span>
                  <Badge variant="outline" className={`shrink-0 text-[10px] ${STATUS_BADGE_CLASS[core.status]}`}>
                    {STATUS_LABEL[core.status]}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">{core.detail}</p>
                <p className="font-mono text-[10px] text-foreground/80 break-all">{core.model}</p>
              </div>

              <div className="mt-3 space-y-1.5 border-t border-border/60 pt-2">
                <p className="text-[11px] text-muted-foreground">{core.note}</p>
                <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-muted-foreground">
                  <span>{core.features.length} feature{core.features.length === 1 ? "" : "s"}</span>
                  {core.calls > 0 && (
                    <span>
                      {formatCount(core.calls)} calls{core.tokens > 0 ? ` · ${formatCount(core.tokens)} tok` : ""}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
