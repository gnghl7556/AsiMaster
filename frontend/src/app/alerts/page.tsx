"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, Settings } from "lucide-react";
import apiClient from "@/lib/api/client";
import { useUserStore } from "@/stores/useUserStore";
import { AlertSettings } from "@/components/alerts/AlertSettings";
import type { Alert } from "@/types";
import { cn } from "@/lib/utils/cn";

const ALERT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  price_undercut: { label: "최저가 이탈", color: "text-red-500" },
  new_competitor: { label: "신규 경쟁자", color: "text-amber-500" },
  price_surge: { label: "가격 급변동", color: "text-blue-500" },
};

type Tab = "list" | "settings";

export default function AlertsPage() {
  const userId = useUserStore((s) => s.currentUserId);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("list");

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["alerts", userId],
    queryFn: () => apiClient.get<Alert[]>(`/users/${userId}/alerts`).then((r) => r.data),
    enabled: !!userId,
  });

  const markReadMutation = useMutation({
    mutationFn: (alertId: number) => apiClient.patch(`/alerts/${alertId}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const markAllMutation = useMutation({
    mutationFn: () => apiClient.post(`/users/${userId}/alerts/read-all`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });

  if (!userId) {
    return <div className="py-20 text-center text-[var(--muted-foreground)]">사업체를 선택해주세요</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* 헤더 + 탭 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">알림</h1>
        <div className="flex items-center gap-2">
          {tab === "list" && alerts.some((a) => !a.is_read) && (
            <button
              onClick={() => markAllMutation.mutate()}
              className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600"
            >
              <CheckCheck className="h-4 w-4" />
              모두 읽음
            </button>
          )}
          <button
            onClick={() => setTab(tab === "list" ? "settings" : "list")}
            className={cn(
              "rounded-lg p-1.5 transition-colors",
              tab === "settings" ? "bg-blue-500/10 text-blue-500" : "hover:bg-[var(--muted)]"
            )}
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      {tab === "settings" ? (
        <AlertSettings />
      ) : isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-16" />)}</div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-[var(--muted-foreground)]">
          <Bell className="h-12 w-12 mb-3 opacity-30" />
          <p>새로운 알림이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const typeConfig = ALERT_TYPE_LABELS[alert.type] || { label: alert.type, color: "" };
            return (
              <div
                key={alert.id}
                className={cn(
                  "glass-card p-4 transition-all",
                  !alert.is_read && "border-l-4 border-l-blue-500"
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className={cn("text-xs font-medium", typeConfig.color)}>
                      {typeConfig.label}
                    </span>
                    <h3 className="font-medium mt-0.5">{alert.title}</h3>
                    {alert.message && (
                      <p className="text-sm text-[var(--muted-foreground)] mt-1">{alert.message}</p>
                    )}
                    <span className="text-xs text-[var(--muted-foreground)] mt-1 block">
                      {new Date(alert.created_at).toLocaleString("ko-KR")}
                    </span>
                  </div>
                  {!alert.is_read && (
                    <button
                      onClick={() => markReadMutation.mutate(alert.id)}
                      className="rounded-lg p-1 hover:bg-[var(--muted)]"
                    >
                      <Check className="h-4 w-4 text-[var(--muted-foreground)]" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
