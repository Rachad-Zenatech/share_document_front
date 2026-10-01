import { apiClient } from "./apiClient";

export async function getAnnualReport() {
  return apiClient.get<Record<string, unknown>>(`/reports/annual`);
}
