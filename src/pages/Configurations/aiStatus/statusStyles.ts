import type { AiStateCode } from "@/types/aiOverview";

export const STATUS_BADGE_CLASS: Record<AiStateCode, string> = {
  OK: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  READY: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  OUT: "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
  OVERFLOW: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  FALLBACK: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  UNCONFIGURED: "border-slate-200 bg-slate-100 text-slate-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export const STATUS_LABEL: Record<AiStateCode, string> = {
  OK: "Operational",
  READY: "Ready (idle)",
  OUT: "OUT",
  OVERFLOW: "OVERFLOW",
  FALLBACK: "Fallback",
  UNCONFIGURED: "Off / Unconfigured",
};

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "0";
  return value.toLocaleString();
}

export function formatLatency(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}
