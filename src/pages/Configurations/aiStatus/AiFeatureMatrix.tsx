import { useMemo, useState } from "react";
import { Layers, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AiErrorsFilter, AiOverviewFeature } from "@/types/aiOverview";
import { STATUS_BADGE_CLASS, STATUS_LABEL, formatCount, formatLatency } from "./statusStyles";

type StatusFilter = "ALL" | "ISSUES" | "HEALTHY";

function FeatureRow({
  item,
  onShowErrors,
}: {
  item: AiOverviewFeature;
  onShowErrors: (filter: AiErrorsFilter) => void;
}) {
  const u = item.usage_24h;
  const totalTokens = item.input_tokens + item.output_tokens;
  return (
    <TableRow className={!item.healthy ? "bg-rose-50/40 dark:bg-rose-950/10" : undefined}>
      <TableCell className="align-top whitespace-nowrap">
        <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE_CLASS[item.status]}`}>
          {STATUS_LABEL[item.status]}
        </Badge>
        {item.issue_message && (
          <p className="mt-1 max-w-[220px] whitespace-normal text-[11px] text-rose-700 dark:text-rose-300">
            {item.issue_message}
          </p>
        )}
      </TableCell>
      <TableCell className="align-top min-w-[220px] whitespace-normal">
        <div className="font-medium text-xs text-foreground">{item.label}</div>
        <div className="font-mono text-[10px] text-muted-foreground">{item.feature}</div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{item.purpose}</p>
      </TableCell>
      <TableCell className="align-top min-w-[190px] whitespace-normal">
        <div className="flex flex-wrap gap-1">
          {item.cores.map((c, idx) => (
            <Badge key={c.id} variant={idx === 0 ? "secondary" : "outline"} className="text-[10px] font-normal">
              {c.label}
            </Badge>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Tier: <span className="font-mono">{item.routing_tier}</span>
        </p>
        {item.models_used.length > 0 && (
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground break-all">
            {item.models_used.join(", ")}
          </p>
        )}
      </TableCell>
      <TableCell className="align-top text-right text-xs tabular-nums">
        <div className="font-semibold">{formatCount(item.calls)}</div>
        <div className="text-[10px] text-muted-foreground">
          {item.errors > 0 ? (
            <button
              type="button"
              onClick={() => onShowErrors({ feature: item.feature, label: item.label })}
              className="font-medium text-rose-600 underline decoration-rose-400/70 underline-offset-2 hover:text-rose-700"
            >
              {item.errors} err
            </button>
          ) : (
            "0 err"
          )}{" "}
          · {item.cache_hits} cache
        </div>
      </TableCell>
      <TableCell className="align-top text-right text-xs tabular-nums">
        <div className="font-semibold">{formatCount(totalTokens)}</div>
        <div className="text-[10px] text-muted-foreground">
          {formatCount(item.input_tokens)} in / {formatCount(item.output_tokens)} out
        </div>
      </TableCell>
      <TableCell className="align-top text-right text-xs tabular-nums">
        <div>{formatLatency(item.avg_latency_ms)}</div>
        <div className="text-[10px] text-muted-foreground">p95 {formatLatency(item.p95_latency_ms)}</div>
      </TableCell>
      <TableCell className="align-top text-right text-xs tabular-nums">
        {u ? (
          <div>
            <div>{u.company_limit ? `${u.company_used} / ${u.company_limit}` : `${u.company_used} co.`}</div>
            <div className="text-[10px] text-muted-foreground">
              you: {u.used} · {u.limit ? `cap ${u.limit}` : "no cap"}
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

export default function AiFeatureMatrix({
  features,
  selectedCore,
  coreLabel,
  onShowErrors,
}: {
  features: AiOverviewFeature[];
  selectedCore: string;
  coreLabel?: string;
  onShowErrors: (filter: AiErrorsFilter) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return features.filter((item) => {
      if (selectedCore !== "ALL" && !item.cores.some((c) => c.id === selectedCore)) return false;
      if (statusFilter === "ISSUES" && item.healthy) return false;
      if (statusFilter === "HEALTHY" && !item.healthy) return false;
      if (!q) return true;
      return (
        item.label.toLowerCase().includes(q) ||
        item.feature.toLowerCase().includes(q) ||
        item.purpose.toLowerCase().includes(q) ||
        item.cores.some((c) => c.label.toLowerCase().includes(q))
      );
    });
  }, [features, selectedCore, statusFilter, search]);

  const issueCount = features.filter((f) => !f.healthy).length;

  return (
    <Card className="overflow-hidden py-0 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">
            Feature-to-Core Mapping & Usage
            {coreLabel && selectedCore !== "ALL" ? ` · ${coreLabel}` : ""}
          </h2>
          <Badge variant="outline" className="text-[10px]">
            {filtered.length} shown
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-border bg-muted/40 p-0.5 text-xs">
            {(
              [
                ["ALL", "All"],
                ["ISSUES", `Out / Overflow (${issueCount})`],
                ["HEALTHY", "Working"],
              ] as const
            ).map(([key, text]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                  statusFilter === key ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {text}
              </button>
            ))}
          </div>
          <div className="relative w-52">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter feature or core..."
              className="h-7.5 pl-8 text-xs"
            />
          </div>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Feature & Role</TableHead>
            <TableHead>AI Core(s) & Models Used</TableHead>
            <TableHead className="text-right">Calls</TableHead>
            <TableHead className="text-right">Tokens</TableHead>
            <TableHead className="text-right">Latency</TableHead>
            <TableHead className="text-right">24h Quota / Runs</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                No AI features match the current filter.
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((item) => <FeatureRow key={item.feature} item={item} onShowErrors={onShowErrors} />)
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
