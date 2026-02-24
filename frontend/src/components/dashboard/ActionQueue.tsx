"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Equal, RefreshCw } from "lucide-react";
import { useProductList } from "@/lib/hooks/useProducts";
import { formatPrice, timeAgo } from "@/lib/utils/format";
import { PriceGap } from "@/components/products/PriceGap";
import type { ProductListItem } from "@/types";
import { cn } from "@/lib/utils/cn";

type QueueItem = ProductListItem & {
  issueType: "losing" | "same_price";
};

function buildQueue(products: ProductListItem[]): QueueItem[] {
  const active = products.filter((p) => !p.is_price_locked);
  const queue = active
    .filter(
      (p) =>
        p.status === "losing" ||
        (p.price_gap === 0 && p.status !== "winning")
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
  const { data: products = [], isLoading } = useProductList();

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

  const queue = buildQueue(products);

  return (
    <section className="glass-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">지금 조치가 필요한 상품</h2>
          <p className="text-xs text-[var(--muted-foreground)]">
            밀림/동일 총액 상품 우선 표시
          </p>
        </div>
        <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs font-medium">
          {queue.length}개
        </span>
      </div>

      {queue.length === 0 ? (
        <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)]/60 text-center">
          <RefreshCw className="mb-2 h-6 w-6 text-[var(--muted-foreground)]" />
          <p className="text-sm font-medium">조치 필요 상품이 없습니다</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            현재 밀림/동일 총액 상태의 상품이 없습니다
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
        </div>
      )}
    </section>
  );
}
