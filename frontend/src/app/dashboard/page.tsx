"use client";

import { DashboardSummary } from "@/components/dashboard/DashboardSummary";
import { ProductList } from "@/components/products/ProductList";
import { SortDropdown } from "@/components/products/SortDropdown";
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

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">상품 한눈에 보기</h2>
          <SortDropdown />
        </div>
        <ProductList hideMeta />
      </div>
    </div>
  );
}
