"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAlertSettings } from "@/lib/hooks/useAlerts";
import { alertsApi } from "@/lib/api/alerts";

const TYPE_LABELS: Record<string, { label: string; description: string }> = {
  price_undercut: {
    label: "최저 총액 이탈",
    description: "배송비 포함 최저 총액 기준에서 밀릴 때",
  },
  new_competitor: {
    label: "신규 경쟁자",
    description: "새로운 판매자가 감지될 때",
  },
  price_surge: {
    label: "가격 급변동",
    description: "경쟁사 가격이 임계값 이상 변동할 때",
  },
};

export function AlertSettings() {
  const { data: settings = [], isLoading } = useAlertSettings();
  const queryClient = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_enabled }: { id: number; is_enabled: boolean }) =>
      alertsApi.updateSetting(id, { is_enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-settings"] });
      toast.success("알림 설정이 변경되었습니다");
    },
  });

  const thresholdMutation = useMutation({
    mutationFn: ({ id, threshold }: { id: number; threshold: number }) =>
      alertsApi.updateSetting(id, { threshold }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-settings"] });
      toast.success("임계값이 변경되었습니다");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton h-16" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {settings.map((setting) => {
        const info = TYPE_LABELS[setting.type] || {
          label: setting.type,
          description: "",
        };
        return (
          <div
            key={setting.id}
            className="glass-card flex items-center justify-between p-4"
          >
            <div className="flex-1">
              <h3 className="font-medium text-sm">{info.label}</h3>
              <p className="text-xs text-[var(--muted-foreground)]">
                {info.description}
              </p>
              {setting.threshold != null && setting.is_enabled && (
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-xs text-[var(--muted-foreground)]">
                    임계값
                  </label>
                  <input
                    type="number"
                    defaultValue={setting.threshold}
                    onBlur={(e) => {
                      const val = Number(e.target.value);
                      if (val > 0 && val !== setting.threshold) {
                        thresholdMutation.mutate({
                          id: setting.id,
                          threshold: val,
                        });
                      }
                    }}
                    className="w-20 rounded border border-[var(--border)] bg-transparent px-2 py-0.5 text-xs outline-none focus:border-blue-500"
                  />
                  <span className="text-xs text-[var(--muted-foreground)]">%</span>
                </div>
              )}
            </div>
            <button
              onClick={() =>
                toggleMutation.mutate({
                  id: setting.id,
                  is_enabled: !setting.is_enabled,
                })
              }
              className={`relative h-6 w-11 rounded-full transition-colors ${
                setting.is_enabled
                  ? "bg-blue-500"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  setting.is_enabled ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}
