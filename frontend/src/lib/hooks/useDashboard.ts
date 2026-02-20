"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/api/dashboard";
import { useUserStore } from "@/stores/useUserStore";

export function useDashboard() {
  const userId = useUserStore((s) => s.currentUserId);

  return useQuery({
    queryKey: ["dashboard", userId],
    queryFn: () => dashboardApi.getSummary(userId!),
    enabled: !!userId,
    refetchInterval: 60000,
  });
}
