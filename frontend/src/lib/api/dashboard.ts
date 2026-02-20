import type { DashboardSummary } from "@/types";
import apiClient from "./client";

export const dashboardApi = {
  getSummary: (userId: number) =>
    apiClient.get<DashboardSummary>(`/users/${userId}/dashboard/summary`).then((r) => r.data),

  exportCsv: (userId: number) =>
    apiClient.get(`/users/${userId}/dashboard/export`, { responseType: "blob" }).then((r) => r.data),
};
