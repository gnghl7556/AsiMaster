"use client";

import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import { useAlerts } from "@/lib/hooks/useAlerts";
import { timeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const ALERT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  price_undercut: { label: "최저가 이탈", color: "text-red-500" },
  new_competitor: { label: "신규 경쟁자", color: "text-amber-500" },
  price_surge: { label: "가격 급변동", color: "text-blue-500" },
};

export function RecentAlertsPanel() {
  const { data: alerts = [], isLoading } = useAlerts();
  const unread = alerts.filter((a) => !a.is_read).slice(0, 5);

  return (
    <section className="glass-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-blue-500" />
          <h3 className="font-medium">최근 알림</h3>
        </div>
        <Link
          href="/alerts"
          className="inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          전체 보기 <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-14 w-full" />
          ))}
        </div>
      ) : unread.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/60 px-3 py-6 text-center text-sm text-[var(--muted-foreground)]">
          미확인 알림이 없습니다
        </div>
      ) : (
        <div className="space-y-2">
          {unread.map((alert) => {
            const typeConfig = ALERT_TYPE_LABELS[alert.type] || {
              label: alert.type,
              color: "text-[var(--muted-foreground)]",
            };
            return (
              <Link
                key={alert.id}
                href="/alerts"
                className="block rounded-xl border border-[var(--border)] bg-[var(--card)]/70 px-3 py-2.5 transition-colors hover:bg-[var(--card)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className={cn("text-[11px] font-medium", typeConfig.color)}>
                      {typeConfig.label}
                    </div>
                    <div className="truncate text-sm font-medium">{alert.title}</div>
                  </div>
                  <div className="shrink-0 text-[11px] text-[var(--muted-foreground)]">
                    {timeAgo(alert.created_at)}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

