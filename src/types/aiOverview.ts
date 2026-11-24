export type AiStateCode = "OK" | "READY" | "OUT" | "OVERFLOW" | "FALLBACK" | "UNCONFIGURED";

export interface AiFeatureCoreRef {
  id: string;
  label: string;
}

export interface AiFeatureUsage24h {
  used: number;
  limit: number;
  company_used: number;
  company_limit: number;
  remaining: number | null;
  resets_at?: string | null;
}

export interface AiOverviewFeature {
  feature: string;
  label: string;
  purpose: string;
  primary_core: string;
  primary_core_label: string;
  cores: AiFeatureCoreRef[];
  routing_tier: string;
  status: AiStateCode;
  healthy: boolean;
  issue_reason?: string | null;
  issue_message?: string | null;
  issue_since?: string | null;
  calls: number;
  errors: number;
  blocked: number;
  cache_hits: number;
  input_tokens: number;
  output_tokens: number;
  avg_latency_ms: number | null;
  p95_latency_ms: number | null;
  models_used: string[];
  last_call_at?: string | null;
  last_status?: string | null;
  last_error_type?: string | null;
  usage_24h?: AiFeatureUsage24h | null;
}

export interface AiCoreStatus {
  core: string;
  name: string;
  provider: string;
  status: AiStateCode;
  configured: boolean;
  model: string;
  detail: string;
  note: string;
  calls: number;
  tokens: number;
  features: string[];
}

export interface AiModelBreakdownRow {
  feature: string;
  model: string | null;
  calls: number;
  errors: number;
  blocked: number;
  cache_hits: number;
  input_tokens: number;
  output_tokens: number;
  avg_latency_ms: number | null;
  p95_latency_ms: number | null;
}

export interface AiStepBreakdownRow {
  kind: string;
  name: string;
  calls: number;
  not_ok: number;
  avg_ms: number | null;
  p95_ms: number | null;
}

export interface AiGuardBreakdownRow {
  feature: string;
  guard_verdict: string;
  calls: number;
}

export interface AiErrorsFilter {
  feature?: string;
  label?: string;
  model?: string;
}

export interface AiErrorEntry {
  id: string;
  trace_id?: string | null;
  feature: string;
  model?: string | null;
  status: string;
  error_type?: string | null;
  error_kind?: string | null;
  route_tier?: string | null;
  message?: string | null;
  guard_verdict?: string | null;
  latency_ms?: number | null;
  created_at: string;
}

export interface AiErrorsResponse {
  hours: number;
  feature?: string | null;
  model?: string | null;
  items: AiErrorEntry[];
}

export interface AiOverviewResponse {
  generated_at: string;
  hours: number;
  health: {
    available: boolean;
    reason?: string | null;
    title?: string | null;
    message?: string | null;
    since?: string | null;
    degraded_features: {
      feature: string;
      label: string;
      status: "OUT" | "OVERFLOW";
      reason: string;
      message: string;
      since?: string | null;
      affected_features?: string[];
    }[];
  };
  totals: {
    calls: number;
    errors: number;
    blocked: number;
    cache_hits: number;
    input_tokens: number;
    output_tokens: number;
    features_total: number;
    features_out: number;
    features_overflow: number;
    features_healthy: number;
  };
  cores: AiCoreStatus[];
  features: AiOverviewFeature[];
  models: AiModelBreakdownRow[];
  steps: AiStepBreakdownRow[];
  guard: AiGuardBreakdownRow[];
}
