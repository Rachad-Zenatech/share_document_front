import { AlertTriangle, CheckCircle2, Cpu, ShieldAlert, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { AiErrorsFilter, AiOverviewResponse } from "@/types/aiOverview";
import { formatCount } from "./statusStyles";

function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: React.ReactNode;
  tone?: "default" | "danger" | "ok";
}) {
  const valueClass =
    tone === "danger"
      ? "text-rose-600 dark:text-rose-400"
      : tone === "ok"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-foreground";
  return (
    <Card className="p-4 shadow-xs">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold tracking-tight ${valueClass}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </Card>
  );
}

function OverallStatusBanner({ data, cachePct }: { data: AiOverviewResponse; cachePct: number }) {
  const { totals, health, hours } = data;
  const hasOutage = !health.available || totals.features_out > 0;
  const hasOverflow = totals.features_overflow > 0;
  const affectedList = Array.from(new Set(health.degraded_features.flatMap((d) => d.affected_features ?? [])));

  return (
    <Card
      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 shadow-xs ${
        hasOutage
          ? "border-rose-300 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/30"
          : hasOverflow
            ? "border-amber-300 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30"
            : "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20"
      }`}
    >
      <div className="flex items-start gap-2.5">
        {hasOutage ? (
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
        ) : hasOverflow ? (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        )}
        <div>
          <p className="text-sm font-semibold text-foreground">
            {!health.available
              ? health.title || "Primary AI unavailable"
              : hasOutage || hasOverflow
                ? `${totals.features_out} out, ${totals.features_overflow} overflow — ${totals.features_healthy}/${totals.features_total} features operational`
                : `All ${totals.features_total} AI features operational`}
          </p>
          <p className="text-xs text-muted-foreground">
            {!health.available
              ? health.message
              : `Last updated ${new Date(data.generated_at).toLocaleTimeString()} · Rolling ${hours}h window`}
          </p>
          {affectedList.length > 0 && (
            <p className="mt-0.5 text-xs text-foreground/85">
              <strong>Affected features:</strong> {affectedList.join(", ")}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Cpu className="h-3.5 w-3.5" /> {data.cores.length} cores tracked
        </span>
        <span className="inline-flex items-center gap-1">
          <Zap className="h-3.5 w-3.5" /> {formatCount(totals.cache_hits)} cached ({cachePct}%)
        </span>
      </div>
    </Card>
  );
}

export default function AiSummaryCards({
  data,
  onShowErrors,
}: {
  data: AiOverviewResponse;
  onShowErrors: (filter: AiErrorsFilter) => void;
}) {
  const { totals, hours } = data;
  const totalTokens = totals.input_tokens + totals.output_tokens;
  const cachePct = totals.calls > 0 ? Math.round((totals.cache_hits / totals.calls) * 100) : 0;

  return (
    <div className="space-y-3">
      <OverallStatusBanner data={data} cachePct={cachePct} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Features Working / Out"
          value={`${totals.features_healthy} / ${totals.features_out + totals.features_overflow}`}
          sub={`${totals.features_out} OUT · ${totals.features_overflow} OVERFLOW`}
          tone={totals.features_out + totals.features_overflow > 0 ? "danger" : "ok"}
        />
        <KpiCard
          label={`AI Calls (${hours}h)`}
          value={formatCount(totals.calls)}
          sub={
            totals.errors > 0 || totals.blocked > 0 ? (
              <button
                type="button"
                onClick={() => onShowErrors({})}
                className="font-medium text-rose-600 underline-offset-2 hover:underline dark:text-rose-400"
              >
                {formatCount(totals.errors)} errors · {formatCount(totals.blocked)} blocked (view all)
              </button>
            ) : (
              `${formatCount(totals.errors)} errors · ${formatCount(totals.blocked)} blocked`
            )
          }
        />
        <KpiCard
          label={`Total Tokens (${hours}h)`}
          value={formatCount(totalTokens)}
          sub={`${formatCount(totals.input_tokens)} in · ${formatCount(totals.output_tokens)} out`}
        />
        <KpiCard
          label={`Cache Hits (${hours}h)`}
          value={`${cachePct}%`}
          sub={`${formatCount(totals.cache_hits)} reused without LLM calls`}
        />
      </div>
    </div>
  );
}
