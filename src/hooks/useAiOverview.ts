import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import type { AiOverviewResponse } from "@/types/aiOverview";

export function useAiOverview(hours: number) {
  return useQuery({
    queryKey: ["system-security", "ai-overview", hours],
    queryFn: () =>
      apiClient.get<AiOverviewResponse>(`/api/observability/ai/overview?hours=${hours}`, {
        skipGlobalLoading: true,
      }),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
