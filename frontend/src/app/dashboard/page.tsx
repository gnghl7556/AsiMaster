"use client";

import { Download, RefreshCw, Loader2 } from "lucide-react";
import { DashboardSummary } from "@/components/dashboard/DashboardSummary";
import { ProductList } from "@/components/products/ProductList";
import { useUserStore } from "@/stores/useUserStore";
import { useCrawlAll } from "@/lib/hooks/useCrawl";
import { dashboardApi } from "@/lib/api/dashboard";
import { toast } from "sonner";

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

  const handleExportCsv = async () => {
    try {
      const blob = await dashboardApi.exportCsv(userId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `price-monitor-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV 다운로드 완료");
    } catch {
      toast.error("CSV 다운로드 실패");
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <DashboardSummary />

      {/* 액션 바 */}
      <div className="flex gap-2">
        <button
          onClick={() => crawlAll.mutate(userId)}
          disabled={crawlAll.isPending}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--muted)] transition-colors"
        >
          {crawlAll.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          전체 크롤링
        </button>
        <button
          onClick={handleExportCsv}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--muted)] transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          CSV 내보내기
        </button>
      </div>

      <div>
        <h2 className="text-lg font-bold mb-4">상품 한눈에 보기</h2>
        <ProductList />
      </div>
    </div>
  );
}
