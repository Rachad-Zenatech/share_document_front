import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  AiErrorsFilter,
  AiGuardBreakdownRow,
  AiModelBreakdownRow,
  AiOverviewResponse,
  AiStepBreakdownRow,
} from "@/types/aiOverview";
import { formatCount, formatLatency } from "./statusStyles";

function ModelsTable({
  rows,
  onShowErrors,
}: {
  rows: AiModelBreakdownRow[];
  onShowErrors: (filter: AiErrorsFilter) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Feature</TableHead>
          <TableHead>Model</TableHead>
          <TableHead className="text-right">Calls</TableHead>
          <TableHead className="text-right">Errors</TableHead>
          <TableHead className="text-right">Cache Hits</TableHead>
          <TableHead className="text-right">Tokens (In / Out)</TableHead>
          <TableHead className="text-right">Avg / P95</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="py-6 text-center text-xs text-muted-foreground">
              No model calls recorded in this window.
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row, i) => (
            <TableRow key={`${row.feature}-${row.model ?? "none"}-${i}`}>
              <TableCell className="font-mono text-xs">{row.feature}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{row.model || "—"}</TableCell>
              <TableCell className="text-right text-xs tabular-nums">{formatCount(row.calls)}</TableCell>
              <TableCell className="text-right text-xs tabular-nums">
                {row.errors > 0 ? (
                  <button
                    type="button"
                    onClick={() => onShowErrors({ feature: row.feature, model: row.model || undefined })}
                    className="font-medium text-rose-600 underline decoration-rose-400/70 underline-offset-2 hover:text-rose-700"
                  >
                    {row.errors} err
                  </button>
                ) : (
                  "0"
                )}
              </TableCell>
              <TableCell className="text-right text-xs tabular-nums">{formatCount(row.cache_hits)}</TableCell>
              <TableCell className="text-right text-xs tabular-nums">
                {formatCount(row.input_tokens)} / {formatCount(row.output_tokens)}
              </TableCell>
              <TableCell className="text-right text-xs tabular-nums">
                {formatLatency(row.avg_latency_ms)} / {formatLatency(row.p95_latency_ms)}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function StepsTable({ rows }: { rows: AiStepBreakdownRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Kind</TableHead>
          <TableHead>Step</TableHead>
          <TableHead className="text-right">Calls</TableHead>
          <TableHead className="text-right">Not OK</TableHead>
          <TableHead className="text-right">Avg / P95</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
              No retrieval, embedding, or tool spans in this window.
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row, i) => (
            <TableRow key={`${row.kind}-${row.name}-${i}`}>
              <TableCell>
                <Badge variant="outline" className="text-[10px] uppercase">{row.kind}</Badge>
              </TableCell>
              <TableCell className="font-mono text-xs">{row.name}</TableCell>
              <TableCell className="text-right text-xs tabular-nums">{formatCount(row.calls)}</TableCell>
              <TableCell className="text-right text-xs tabular-nums">
                {row.not_ok > 0 ? <span className="font-medium text-rose-600">{row.not_ok}</span> : "0"}
              </TableCell>
              <TableCell className="text-right text-xs tabular-nums">
                {formatLatency(row.avg_ms)} / {formatLatency(row.p95_ms)}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function GuardTable({ rows }: { rows: AiGuardBreakdownRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Feature</TableHead>
          <TableHead>Guard Verdict</TableHead>
          <TableHead className="text-right">Calls</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={3} className="py-6 text-center text-xs text-muted-foreground">
              No guardrail events recorded in this window.
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row, i) => (
            <TableRow key={`${row.feature}-${row.guard_verdict}-${i}`}>
              <TableCell className="font-mono text-xs">{row.feature}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-[10px]">{row.guard_verdict}</Badge>
              </TableCell>
              <TableCell className="text-right text-xs tabular-nums">{formatCount(row.calls)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export default function AiPipelineTelemetry({
  data,
  onShowErrors,
}: {
  data: AiOverviewResponse;
  onShowErrors: (filter: AiErrorsFilter) => void;
}) {
  return (
    <Card className="overflow-hidden py-0 shadow-xs">
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
        <Activity className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Detailed Telemetry</h2>
        <span className="text-xs text-muted-foreground">Models, RAG/embedding steps & guardrails ({data.hours}h)</span>
      </div>
      <Tabs defaultValue="models" className="gap-0">
        <div className="border-b border-border/70 px-3">
          <TabsList className="bg-transparent p-1">
            <TabsTrigger value="models">By Model ({data.models.length})</TabsTrigger>
            <TabsTrigger value="steps">Embeddings / Cache / Tools ({data.steps.length})</TabsTrigger>
            <TabsTrigger value="guard">Guardrails ({data.guard.length})</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="models" className="m-0"><ModelsTable rows={data.models} onShowErrors={onShowErrors} /></TabsContent>
        <TabsContent value="steps" className="m-0"><StepsTable rows={data.steps} /></TabsContent>
        <TabsContent value="guard" className="m-0"><GuardTable rows={data.guard} /></TabsContent>
      </Tabs>
    </Card>
  );
}
