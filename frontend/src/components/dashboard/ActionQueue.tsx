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

type QueueSeverity = "critical" | "high" | "medium" | "watch";

const ACTION_QUEUE_MODE_KEY = "asimaster:dashboard-action-queue-mode";
const ACTION_QUEUE_SORT_KEY = "asimaster:dashboard-action-queue-sort";
const DASHBOARD_SCAN_LIMIT = 500;

type QueueSortMode = "gap" | "stale";

function buildQueue(
  products: ProductListItem[],
  options: { includeSameTotal: boolean; sortMode: QueueSortMode }
): QueueItem[] {
  const active = products.filter((p) => !p.is_price_locked);
  const isPriceLosing = (p: ProductListItem) =>
    p.price_gap != null ? p.price_gap > 0 : p.status === "losing";
  const queue = active
    .filter(
      (p) =>
        isPriceLosing(p) ||
        (options.includeSameTotal && p.price_gap === 0)
    )
    .map((p): QueueItem => ({
      ...p,
      issueType: isPriceLosing(p) ? "losing" : "same_price",
    }));

  return queue.sort((a, b) => {
    const aPriority = a.issueType === "losing" ? 0 : 1;
    const bPriority = b.issueType === "losing" ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    if (options.sortMode === "stale") {
      const aFreshness = getCrawlFreshness(a.last_crawled_at);
      const bFreshness = getCrawlFreshness(b.last_crawled_at);
      const rank = { old: 0, stale: 1, fresh: 2 } as const;
      if (rank[aFreshness] !== rank[bFreshness]) return rank[aFreshness] - rank[bFreshness];
    }
    const aGap = Math.abs(a.price_gap ?? 0);
    const bGap = Math.abs(b.price_gap ?? 0);
    if (aGap !== bGap) return bGap - aGap;
    return (a.my_rank ?? 999) - (b.my_rank ?? 999);
  });
}

function getQueueSeverity(item: QueueItem): QueueSeverity {
  if (item.issueType === "same_price") return "watch";
  const gapPct = Math.abs(item.price_gap_percent ?? 0);
  if (gapPct >= 10) return "critical";
  if (gapPct >= 5) return "high";
  if (gapPct >= 2) return "medium";
  return "watch";
}

function getCrawlFreshness(lastCrawledAt: string | null): "fresh" | "stale" | "old" {
  if (!lastCrawledAt) return "old";
  const parsed = new Date(lastCrawledAt.endsWith("Z") ? lastCrawledAt : `${lastCrawledAt}Z`);
  const diffMs = Date.now() - parsed.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return "fresh";
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours >= 24) return "old";
  if (diffHours >= 6) return "stale";
  return "fresh";
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
  const [queueSortMode, setQueueSortMode] = useState<QueueSortMode>("gap");
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
    const savedSort = window.localStorage.getItem(ACTION_QUEUE_SORT_KEY);
    if (savedSort === "gap" || savedSort === "stale") setQueueSortMode(savedSort);
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

  const handleSetSortMode = (nextSortMode: QueueSortMode) => {
    setQueueSortMode(nextSortMode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACTION_QUEUE_SORT_KEY, nextSortMode);
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

  const queue = buildQueue(products, { includeSameTotal, sortMode: queueSortMode });
  const lockedProducts = [...products]
    .filter((p) => p.is_price_locked)
    .sort((a, b) => {
      const aFresh = getCrawlFreshness(a.last_crawled_at);
      const bFresh = getCrawlFreshness(b.last_crawled_at);
      const rank = { old: 0, stale: 1, fresh: 2 } as const;
      if (rank[aFresh] !== rank[bFresh]) return rank[aFresh] - rank[bFresh];
      const aGap = Math.abs(a.price_gap ?? 0);
      const bGap = Math.abs(b.price_gap ?? 0);
      if (aGap !== bGap) return bGap - aGap;
      return (a.my_rank ?? 999) - (b.my_rank ?? 999);
    });
  const mayBeTruncated = products.length >= DASHBOARD_SCAN_LIMIT;
  const queueLosingCount = queue.filter((p) => p.issueType === "losing").length;
  const queueSameTotalCount = queue.length - queueLosingCount;

  return (
    <section className="glass-card p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold">지금 조치가 필요한 상품</h2>
          <p className="text-xs text-[var(--muted-foreground)]">
            {includeSameTotal ? "밀림/동일 총액 상품 우선 표시" : "밀림 상품만 표시"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-500">
            밀림 {queueLosingCount}
          </span>
          {includeSameTotal && (
            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-500">
              동일총액 {queueSameTotalCount}
            </span>
          )}
          <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs font-medium">
            {queue.length}개
          </span>
        </div>
      </div>
      <div className="mb-3 inline-flex max-w-full flex-wrap rounded-lg border border-[var(--border)] bg-[var(--muted)] p-0.5">
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
      <div className="mb-3 inline-flex max-w-full flex-wrap rounded-lg border border-[var(--border)] bg-[var(--muted)] p-0.5">
        <button
          type="button"
          onClick={() => handleSetSortMode("gap")}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            queueSortMode === "gap"
              ? "bg-[var(--card)] text-blue-500 shadow-sm"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          )}
        >
          가격차 우선
        </button>
        <button
          type="button"
          onClick={() => handleSetSortMode("stale")}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            queueSortMode === "stale"
              ? "bg-[var(--card)] text-amber-500 shadow-sm"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          )}
        >
          수집 오래됨 우선
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
              className={cn(
                "group block rounded-xl border bg-[var(--card)]/70 p-3 transition-colors hover:bg-[var(--card)]",
                getQueueSeverity(product) === "critical"
                  ? "border-red-500/25"
                  : getQueueSeverity(product) === "high"
                  ? "border-orange-500/20"
                  : "border-[var(--border)]"
              )}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div
                  className={cn(
                    "mt-0.5 h-12 w-1 shrink-0 rounded-full",
                    getQueueSeverity(product) === "critical"
                      ? "bg-red-500/80"
                      : getQueueSeverity(product) === "high"
                      ? "bg-orange-500/70"
                      : getQueueSeverity(product) === "medium"
                      ? "bg-amber-500/70"
                      : "bg-[var(--border)]"
                  )}
                />
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
                    {product.issueType === "losing" && (
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-medium",
                          getQueueSeverity(product) === "critical"
                            ? "bg-red-500/10 text-red-500"
                            : getQueueSeverity(product) === "high"
                            ? "bg-orange-500/10 text-orange-500"
                            : getQueueSeverity(product) === "medium"
                            ? "bg-amber-500/10 text-amber-500"
                            : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                        )}
                      >
                        {getQueueSeverity(product) === "critical"
                          ? "심각"
                          : getQueueSeverity(product) === "high"
                          ? "높음"
                          : getQueueSeverity(product) === "medium"
                          ? "주의"
                          : "관찰"}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-sm font-medium">{product.name}</div>
                  {product.price_gap != null && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                          product.issueType === "losing"
                            ? "bg-red-500/10 text-red-500"
                            : "bg-amber-500/10 text-amber-500"
                        )}
                      >
                        가격차 {product.price_gap > 0 ? "+" : ""}
                        {formatPrice(product.price_gap)}원
                      </span>
                      {product.price_gap_percent != null && (
                        <span className="text-[11px] text-[var(--muted-foreground)] tabular-nums">
                          {product.price_gap_percent > 0 ? "+" : ""}
                          {product.price_gap_percent.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  )}
                  <div className="mt-1 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
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
                    <div className="col-span-2 flex items-end justify-end sm:col-span-1">
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
                <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:flex-col sm:items-end sm:justify-between">
                  <div className="flex min-w-0 items-center gap-2 sm:hidden">
                    <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-0.5" />
                    <span className="truncate text-[11px] text-[var(--muted-foreground)]">
                      {product.last_crawled_at ? timeAgo(product.last_crawled_at) : "-"}
                    </span>
                  </div>
                  <ArrowRight className="hidden h-4 w-4 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-0.5 sm:block" />
                  <div className="ml-auto flex flex-col items-end gap-1 sm:ml-0">
                    <span className="hidden text-[11px] text-[var(--muted-foreground)] sm:block">
                      {product.last_crawled_at ? timeAgo(product.last_crawled_at) : "-"}
                    </span>
                    {getCrawlFreshness(product.last_crawled_at) !== "fresh" && (
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-medium",
                          getCrawlFreshness(product.last_crawled_at) === "old"
                            ? "bg-rose-500/10 text-rose-500"
                            : "bg-amber-500/10 text-amber-500"
                        )}
                      >
                        {getCrawlFreshness(product.last_crawled_at) === "old"
                          ? "수집 오래됨"
                          : "수집 지연"}
                      </span>
                    )}
                  </div>
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

      <div className="mt-4 border-t border-[var(--border)] pt-4">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">가격고정 상품</h3>
            <p className="text-[11px] text-[var(--muted-foreground)]">
              조치 큐에서는 제외되며, 필요 시 여기서 해제할 수 있습니다
            </p>
          </div>
          <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[11px] font-medium">
            {lockedProducts.length}개
          </span>
        </div>

        {lockedProducts.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/50 px-3 py-4 text-center text-xs text-[var(--muted-foreground)]">
            가격고정 상품이 없습니다
          </div>
        ) : (
          <div className="space-y-2">
            {lockedProducts.slice(0, 8).map((product) => (
              <Link
                key={`locked-${product.id}`}
                href={`/products/${product.id}`}
                className="group block rounded-xl border border-[var(--border)] bg-[var(--card)]/60 p-3 transition-colors hover:bg-[var(--card)]"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-500/10 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                        <Lock className="h-3 w-3" />
                        가격고정
                      </span>
                      {product.my_rank && (
                        <span className="text-[11px] text-[var(--muted-foreground)]">
                          노출 {product.my_rank}위
                        </span>
                      )}
                      {product.price_gap != null && (
                        <span className="text-[11px] text-[var(--muted-foreground)] tabular-nums">
                          가격차 {product.price_gap > 0 ? "+" : ""}
                          {formatPrice(product.price_gap)}원
                        </span>
                      )}
                    </div>
                    <div className="truncate text-sm font-medium">{product.name}</div>
                    {product.price_lock_reason && (
                      <div className="mt-1 truncate text-[11px] text-[var(--muted-foreground)]">
                        사유: {product.price_lock_reason}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!userId) return;
                          setPendingLockProductId(product.id);
                          toggleLockMutation.mutate({
                            productId: product.id,
                            nextLocked: false,
                          });
                        }}
                        disabled={toggleLockMutation.isPending || !userId}
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[11px] text-[var(--muted-foreground)] transition-colors hover:text-amber-500 disabled:opacity-50"
                      >
                        {toggleLockMutation.isPending && pendingLockProductId === product.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Unlock className="h-3 w-3" />
                        )}
                        고정해제
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
                    <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-0.5" />
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[11px] text-[var(--muted-foreground)]">
                        {product.last_crawled_at ? timeAgo(product.last_crawled_at) : "-"}
                      </span>
                      {getCrawlFreshness(product.last_crawled_at) !== "fresh" && (
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-medium",
                            getCrawlFreshness(product.last_crawled_at) === "old"
                              ? "bg-rose-500/10 text-rose-500"
                              : "bg-amber-500/10 text-amber-500"
                          )}
                        >
                          {getCrawlFreshness(product.last_crawled_at) === "old"
                            ? "수집 오래됨"
                            : "수집 지연"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
            {lockedProducts.length > 8 && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/50 px-3 py-2 text-xs text-[var(--muted-foreground)]">
                가격고정 상품 {lockedProducts.length - 8}개가 더 있습니다. 상품 메뉴에서 전체 확인하세요.
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
