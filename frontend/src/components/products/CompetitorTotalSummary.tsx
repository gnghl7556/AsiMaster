"use client";

import { Crown, Store } from "lucide-react";
import { formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { CompetitorSummary } from "@/types";

interface Props {
  competitors: CompetitorSummary[];
}

export function CompetitorTotalSummary({ competitors }: Props) {
  if (!competitors.length) return null;

  const byTotal = [...competitors]
    .map((c) => ({
      ...c,
      total_price: c.price + (c.shipping_fee || 0),
    }))
    .sort((a, b) => a.total_price - b.total_price || a.rank - b.rank)
    .slice(0, 5);

  return (
    <div className="glass-card p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">가격 기준 경쟁 요약</h3>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          배송비 포함 총액 기준입니다. 노출 순위와 다를 수 있습니다.
        </p>
      </div>
      <div className="space-y-2">
        {byTotal.map((item, idx) => (
          <div
            key={`${item.mall_name}-${item.naver_product_id ?? item.rank}-${idx}`}
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)]/60 px-3 py-2",
              item.is_my_store && "border-blue-500/30 bg-blue-500/5"
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--muted)] px-1 text-[10px] font-bold">
                  {idx + 1}
                </span>
                <span className="truncate text-sm font-medium">
                  {item.mall_name || "알 수 없음"}
                </span>
                {item.is_my_store && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-500">
                    <Store className="h-2.5 w-2.5" />
                    내 스토어
                  </span>
                )}
                {idx === 0 && <Crown className="h-3.5 w-3.5 text-yellow-500" />}
              </div>
              <div className="truncate text-xs text-[var(--muted-foreground)]">
                노출 {item.rank}위 · {item.product_name}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold tabular-nums">
                {formatPrice(item.total_price)}원
              </div>
              <div className="text-[10px] text-[var(--muted-foreground)] tabular-nums">
                상품가 {formatPrice(item.price)}원
                {item.shipping_fee > 0
                  ? ` + 배송비 ${formatPrice(item.shipping_fee)}원`
                  : " · 무료배송"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
