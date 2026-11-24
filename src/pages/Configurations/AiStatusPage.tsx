import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAiOverview } from "@/hooks/useAiOverview";
import type { AiErrorsFilter } from "@/types/aiOverview";
import AiCoresGrid from "./aiStatus/AiCoresGrid";
import AiErrorsDialog from "./aiStatus/AiErrorsDialog";
import AiFeatureMatrix from "./aiStatus/AiFeatureMatrix";
import AiPipelineTelemetry from "./aiStatus/AiPipelineTelemetry";
import AiSummaryCards from "./aiStatus/AiSummaryCards";

const WINDOW_OPTIONS = [
  { value: "1", label: "Last 1 hour" },
  { value: "24", label: "Last 24 hours" },
  { value: "168", label: "Last 7 days" },
  { value: "720", label: "Last 30 days" },
];

export default function AiStatusPage() {
  const [hours, setHours] = useState<number>(24);
  const [selectedCore, setSelectedCore] = useState<string>("ALL");
  const [errorFilter, setErrorFilter] = useState<AiErrorsFilter | null>(null);
  const { data, isLoading, isError, error, isFetching, refetch } = useAiOverview(hours);

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[1280px] items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading AI status, usage, and core mapping...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="mx-auto my-6 max-w-2xl p-6 text-sm text-rose-700 dark:text-rose-300">
        Could not load AI telemetry ({error instanceof Error ? error.message : "unknown error"}).
      </Card>
    );
  }

  const coreLabel = data.cores.find((c) => c.core === selectedCore)?.name;

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-4 pb-6 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-foreground">AI Status, Usage &amp; Core Mapping</h1>
          <p className="text-sm text-muted-foreground">
            See which AI cores and features are healthy, out, or overflowing, token/call usage, and which core powers each feature.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOW_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => void refetch()}>
            <RefreshCw className={isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            Refresh
          </Button>
        </div>
      </div>
      <AiSummaryCards data={data} onShowErrors={setErrorFilter} />
      <AiCoresGrid cores={data.cores} selectedCore={selectedCore} onSelectCore={setSelectedCore} />
      <AiFeatureMatrix features={data.features} selectedCore={selectedCore} coreLabel={coreLabel} onShowErrors={setErrorFilter} />
      <AiPipelineTelemetry data={data} onShowErrors={setErrorFilter} />
      <AiErrorsDialog
        hours={hours}
        filter={errorFilter}
        onChangeFilter={setErrorFilter}
        onClose={() => setErrorFilter(null)}
      />
    </div>
  );
}
