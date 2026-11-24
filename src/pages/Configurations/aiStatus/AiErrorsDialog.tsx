import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiClient } from "@/services/apiClient";
import type { AiErrorEntry, AiErrorsFilter, AiErrorsResponse } from "@/types/aiOverview";
import { formatLatency } from "./statusStyles";

function ErrorEntryRow({ entry }: { entry: AiErrorEntry }) {
  return (
    <div className="rounded-lg border border-rose-200/80 bg-rose-50/40 p-3 text-xs dark:border-rose-900/60 dark:bg-rose-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="border-rose-300 bg-rose-50 text-[10px] text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
            {entry.error_kind || entry.status}
          </Badge>
          <span className="font-mono font-semibold text-foreground">{entry.feature}</span>
          {entry.error_type && (
            <span className="font-mono text-[11px] text-rose-700 dark:text-rose-300">{entry.error_type}</span>
          )}
          {entry.model && (
            <Badge variant="secondary" className="font-mono text-[10px] font-normal">
              {entry.model}
            </Badge>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {new Date(entry.created_at).toLocaleString()}
          {entry.latency_ms != null ? ` · ${formatLatency(entry.latency_ms)}` : ""}
        </span>
      </div>
      <p className="mt-1.5 whitespace-pre-wrap break-words text-xs text-foreground/90">
        {entry.message || `${entry.error_type || entry.status} (no additional error detail recorded)`}
      </p>
      {(entry.trace_id || entry.route_tier || entry.guard_verdict) && (
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          {entry.trace_id ? `trace:${entry.trace_id}` : ""}
          {entry.route_tier ? ` · tier:${entry.route_tier}` : ""}
          {entry.guard_verdict ? ` · guard:${entry.guard_verdict}` : ""}
        </p>
      )}
    </div>
  );
}

export default function AiErrorsDialog({
  hours,
  filter,
  onChangeFilter,
  onClose,
}: {
  hours: number;
  filter: AiErrorsFilter | null;
  onChangeFilter: (next: AiErrorsFilter) => void;
  onClose: () => void;
}) {
  const params = new URLSearchParams({ hours: String(hours), limit: "100" });
  if (filter?.feature) params.set("feature", filter.feature);
  if (filter?.model) params.set("model", filter.model);

  const query = useQuery({
    queryKey: ["system-security", "ai-errors", hours, filter?.feature ?? "", filter?.model ?? ""],
    queryFn: () => apiClient.get<AiErrorsResponse>(`/api/observability/ai/errors?${params.toString()}`, { skipGlobalLoading: true }),
    enabled: Boolean(filter),
  });

  const scopeLabel = filter?.label || filter?.feature || "All AI Features";
  const items = query.data?.items ?? [];

  return (
    <Dialog open={Boolean(filter)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4 text-rose-600" />
              AI Errors — {scopeLabel}
            </DialogTitle>
            {(filter?.feature || filter?.model) && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onChangeFilter({})}>
                Show all features
              </Button>
            )}
          </div>
          <DialogDescription>
            Error and blocked calls in the last {hours}h{filter?.model ? ` on ${filter.model}` : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {query.isLoading ? (
            <div className="flex items-center gap-2 py-8 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading AI error logs...
            </div>
          ) : query.isError ? (
            <p className="py-6 text-xs text-rose-600">Could not load AI error logs.</p>
          ) : items.length === 0 ? (
            <p className="py-6 text-xs text-muted-foreground">No error logs found for this filter in the last {hours}h.</p>
          ) : (
            items.map((entry) => <ErrorEntryRow key={entry.id} entry={entry} />)
          )}
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
