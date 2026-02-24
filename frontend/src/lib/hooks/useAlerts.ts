"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { alertsApi } from "@/lib/api/alerts";
import { useUserStore } from "@/stores/useUserStore";
import type { Alert } from "@/types";

export function useAlerts() {
  const userId = useUserStore((s) => s.currentUserId);

  return useQuery({
    queryKey: ["alerts", userId],
    queryFn: () => alertsApi.getList(userId!),
    enabled: !!userId,
    refetchInterval: 30_000,
  });
}

export function useAlertSettings() {
  const userId = useUserStore((s) => s.currentUserId);

  return useQuery({
    queryKey: ["alert-settings", userId],
    queryFn: () => alertsApi.getSettings(userId!),
    enabled: !!userId,
  });
}

export function useMarkAlertRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alertId: number) => alertsApi.markRead(alertId),
    onMutate: async (alertId) => {
      await queryClient.cancelQueries({ queryKey: ["alerts"] });
      queryClient.setQueriesData<Alert[]>({ queryKey: ["alerts"] }, (current) =>
        current?.map((alert) =>
          alert.id === alertId ? { ...alert, is_read: true } : alert
        )
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });
}

export function useMarkAllAlertsRead() {
  const userId = useUserStore((s) => s.currentUserId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => alertsApi.markAllRead(userId!),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["alerts"] });
      queryClient.setQueriesData<Alert[]>({ queryKey: ["alerts"] }, (current) =>
        current?.map((alert) => ({ ...alert, is_read: true }))
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });
}
