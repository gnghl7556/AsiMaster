import type { Alert } from "@/types";
import apiClient from "./client";

export interface AlertSetting {
  id: number;
  user_id: number;
  type: string;
  is_enabled: boolean;
  threshold: number | null;
}

export const alertsApi = {
  getList: (userId: number) =>
    apiClient.get<Alert[]>(`/users/${userId}/alerts`).then((r) => r.data),

  markRead: (alertId: number) =>
    apiClient.patch(`/alerts/${alertId}/read`),

  markAllRead: (userId: number) =>
    apiClient.post(`/users/${userId}/alerts/read-all`),

  getSettings: (userId: number) =>
    apiClient
      .get<AlertSetting[]>(`/users/${userId}/alert-settings`)
      .then((r) => r.data),

  updateSetting: (settingId: number, data: { is_enabled?: boolean; threshold?: number }) =>
    apiClient
      .patch<AlertSetting>(`/alert-settings/${settingId}`, data)
      .then((r) => r.data),
};
