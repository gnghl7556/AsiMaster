"use client";

import { ActionQueue } from "@/components/dashboard/ActionQueue";
import { DashboardSummary } from "@/components/dashboard/DashboardSummary";
import { QuickLinksPanel } from "@/components/dashboard/QuickLinksPanel";
import { RecentAlertsPanel } from "@/components/dashboard/RecentAlertsPanel";
import { useUserStore } from "@/stores/useUserStore";
import { useCrawlAll } from "@/lib/hooks/useCrawl";

export default function DashboardPage() {
  const userId = useUserStore((s) => s.currentUserId);
  const crawlAll = useCrawlAll();

  if (!userId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--muted-foreground)]">
        <p className="text-lg font-medium">사업체를 선택해주세요</p>
        <p className="text-sm mt-1">
          헤더의 드롭다운에서 사업체를 선택하거나 추가하세요
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <DashboardSummary
        onRefresh={() => crawlAll.mutate(userId)}
        isRefreshing={crawlAll.isPending}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <ActionQueue />
        <div className="space-y-4">
          <RecentAlertsPanel />
          <QuickLinksPanel />
        </div>
      </div>
    </div>
  );
}
