"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Equal, Lock, Loader2, RefreshCw, Unlock } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useProductList } from "@/lib/hooks/useProducts";
import { useCrawlProduct } from "@/lib/hooks/useCrawl";
import { productsApi } from "@/lib/api/products";
import { useUserStore } from "@/stores/useUserStore";
import { formatPrice, timeAgo } from "@/lib/utils/format";
import { PriceGap } from "@/components/products/PriceGap";
import type { ProductListItem } from "@/types";
import { cn } from "@/lib/utils/cn";

type QueueItem = ProductListItem & {
  issueType: "losing" | "same_price";
};

const ACTION_QUEUE_MODE_KEY = "asimaster:dashboard-action-queue-mode";
const DASHBOARD_SCAN_LIMIT = 500;

function buildQueue(
  products: ProductListItem[],
  options: { includeSameTotal: boolean }
): QueueItem[] {
  const active = products.filter((p) => !p.is_price_locked);
  const queue = active
    .filter(
      (p) =>
        p.status === "losing" ||
        (options.includeSameTotal && p.price_gap === 0 && p.status !== "winning")
    )
    .map((p): QueueItem => ({
      ...p,
      issueType: p.status === "losing" ? "losing" : "same_price",
    }));

  return queue.sort((a, b) => {
    const aPriority = a.issueType === "losing" ? 0 : 1;
    const bPriority = b.issueType === "losing" ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    const aGap = Math.abs(a.price_gap ?? 0);
    const bGap = Math.abs(b.price_gap ?? 0);
    if (aGap !== bGap) return bGap - aGap;
    return (a.my_rank ?? 999) - (b.my_rank ?? 999);
  });
}

export function ActionQueue() {
  const userId = useUserStore((s) => s.currentUserId);
  const queryClient = useQueryClient();
  const { data: products = [], isLoading } = useProductList({
    page: 1,
    limit: DASHBOARD_SCAN_LIMIT,
    ignoreStoreFilters: true,
  });
  const [includeSameTotal, setIncludeSameTotal] = useState(true);
  const [pendingCrawlProductId, setPendingCrawlProductId] = useState<number | null>(null);
  const [pendingLockProductId, setPendingLockProductId] = useState<number | null>(null);
  const crawlProductMutation = useCrawlProduct();
  const toggleLockMutation = useMutation({
    mutationFn: (params: { productId: number; nextLocked: boolean }) =>
      productsApi.togglePriceLock(userId!, params.productId, params.nextLocked),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(variables.nextLocked ? "가격고정 설정" : "가격고정 해제");
    },
    onError: () => toast.error("가격고정 변경에 실패했습니다"),
    onSettled: () => setPendingLockProductId(null),
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(ACTION_QUEUE_MODE_KEY);
    if (saved === "losing_only") setIncludeSameTotal(false);
    if (saved === "including_same_total") setIncludeSameTotal(true);
  }, []);

  const handleSetMode = (nextIncludeSameTotal: boolean) => {
    setIncludeSameTotal(nextIncludeSameTotal);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        ACTION_QUEUE_MODE_KEY,
        nextIncludeSameTotal ? "including_same_total" : "losing_only"
      );
    }
  };

  if (isLoading) {
    return (
      <div className="glass-card p-4">
        <div className="mb-3 skeleton h-6 w-40" />
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const queue = buildQueue(products, { includeSameTotal });
  const mayBeTruncated = products.length >= DASHBOARD_SCAN_LIMIT;

  return (
    <section className="glass-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">지금 조치가 필요한 상품</h2>
          <p className="text-xs text-[var(--muted-foreground)]">
            {includeSameTotal ? "밀림/동일 총액 상품 우선 표시" : "밀림 상품만 표시"}
          </p>
        </div>
        <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs font-medium">
          {queue.length}개
        </span>
      </div>
      <div className="mb-3 inline-flex rounded-lg border border-[var(--border)] bg-[var(--muted)] p-0.5">
        <button
          type="button"
          onClick={() => handleSetMode(false)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            !includeSameTotal
              ? "bg-[var(--card)] text-red-500 shadow-sm"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          )}
        >
          밀림만
        </button>
        <button
          type="button"
          onClick={() => handleSetMode(true)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            includeSameTotal
              ? "bg-[var(--card)] text-amber-500 shadow-sm"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          )}
        >
          동일총액 포함
        </button>
      </div>
      {mayBeTruncated && (
        <div className="mb-3 text-[11px] text-amber-500">
          조치 큐는 현재 최대 {DASHBOARD_SCAN_LIMIT}개 상품 기준으로 계산됩니다.
        </div>
      )}

      {queue.length === 0 ? (
        <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)]/60 text-center">
          <RefreshCw className="mb-2 h-6 w-6 text-[var(--muted-foreground)]" />
          <p className="text-sm font-medium">조치 필요 상품이 없습니다</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            {includeSameTotal
              ? "현재 밀림/동일 총액 상태의 상품이 없습니다"
              : "현재 밀림 상태의 상품이 없습니다"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {queue.slice(0, 12).map((product) => (
            <Link
              key={product.id}
              href={`/products/${product.id}`}
              className="group block rounded-xl border border-[var(--border)] bg-[var(--card)]/70 p-3 transition-colors hover:bg-[var(--card)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        product.issueType === "losing"
                          ? "bg-red-500/10 text-red-500"
                          : "bg-amber-500/10 text-amber-500"
                      )}
                    >
                      {product.issueType === "losing" ? (
                        <AlertTriangle className="h-3 w-3" />
                      ) : (
                        <Equal className="h-3 w-3" />
                      )}
                      {product.issueType === "losing" ? "밀림" : "동일총액"}
                    </span>
                    {product.my_rank && (
                      <span className="text-[11px] text-[var(--muted-foreground)]">
                        노출 {product.my_rank}위
                      </span>
                    )}
                    {product.rank_change != null && (
                      <span
                        className={cn(
                          "text-[11px]",
                          product.rank_change > 0
                            ? "text-red-500"
                            : product.rank_change < 0
                            ? "text-emerald-500"
                            : "text-[var(--muted-foreground)]"
                        )}
                      >
                        {product.rank_change > 0
                          ? `노출 하락 ${product.rank_change}`
                          : product.rank_change < 0
                          ? `노출 상승 ${Math.abs(product.rank_change)}`
                          : "노출 변동 없음"}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-sm font-medium">{product.name}</div>
                  <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-[var(--muted-foreground)]">내 가격</div>
                      <div className="tabular-nums font-semibold">
                        {formatPrice(product.selling_price)}원
                      </div>
                    </div>
                    <div>
                      <div className="text-[var(--muted-foreground)]">최저 총액</div>
                      <div className="tabular-nums font-semibold">
                        {formatPrice(product.lowest_price)}원
                      </div>
                    </div>
                    <div className="flex items-end justify-end">
                      <PriceGap
                        gap={product.price_gap}
                        gapPercent={product.price_gap_percent}
                        status={product.status}
                        size="sm"
                      />
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setPendingCrawlProductId(product.id);
                        crawlProductMutation.mutate(product.id, {
                          onSettled: () => setPendingCrawlProductId(null),
                        });
                      }}
                      disabled={crawlProductMutation.isPending}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[11px] text-[var(--muted-foreground)] transition-colors hover:text-blue-500 disabled:opacity-50"
                    >
                      {crawlProductMutation.isPending && pendingCrawlProductId === product.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      새로고침
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!userId) return;
                        setPendingLockProductId(product.id);
                        toggleLockMutation.mutate({
                          productId: product.id,
                          nextLocked: !product.is_price_locked,
                        });
                      }}
                      disabled={toggleLockMutation.isPending || !userId}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[11px] text-[var(--muted-foreground)] transition-colors hover:text-amber-500 disabled:opacity-50"
                    >
                      {toggleLockMutation.isPending && pendingLockProductId === product.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : product.is_price_locked ? (
                        <Unlock className="h-3 w-3" />
                      ) : (
                        <Lock className="h-3 w-3" />
                      )}
                      {product.is_price_locked ? "고정해제" : "가격고정"}
                    </button>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end justify-between gap-2">
                  <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-0.5" />
                  <span className="text-[11px] text-[var(--muted-foreground)]">
                    {timeAgo(product.last_crawled_at)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
          {queue.length > 12 && (
            <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)]/50 px-3 py-2">
              <span className="text-xs text-[var(--muted-foreground)]">
                나머지 {queue.length - 12}개 조치 항목은 상품 메뉴에서 확인하세요
              </span>
              <Link
                href="/products"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-600"
              >
                상품으로 이동
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
