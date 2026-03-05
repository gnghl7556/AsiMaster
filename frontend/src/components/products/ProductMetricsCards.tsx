"use client";

import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/format";
import type { ProductDetail } from "@/types";

interface ProductMetricsCardsProps {
  product: ProductDetail;
}

export function ProductMetricsCards({ product }: ProductMetricsCardsProps) {
  const isExposureTopButPriceLosing = product.my_rank === 1 && product.status === "losing";

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="glass-card p-4 text-center">
        <div className="text-sm text-[var(--muted-foreground)]">내 가격</div>
        <div className="text-lg font-bold mt-1 tabular-nums">
          {formatPrice(product.selling_price)}
        </div>
      </div>
      <div className="glass-card p-4 text-center">
        <div className="text-sm text-[var(--muted-foreground)]">최저 총액</div>
        <div className="text-lg font-bold mt-1 tabular-nums">
          {formatPrice(product.lowest_price)}
        </div>
        <div className="text-[10px] text-[var(--muted-foreground)]">
          배송비 포함
        </div>
        {product.lowest_seller && (
          <div className="text-xs text-[var(--muted-foreground)]">
            {product.lowest_seller}
          </div>
        )}
      </div>
      <div className="glass-card p-4 text-center">
        <div className="text-sm text-[var(--muted-foreground)]">노출 순위</div>
        <div className="text-lg font-bold mt-1 tabular-nums">
          {product.my_rank ? `노출 ${product.my_rank}위` : "-"}
        </div>
        {product.rank_change != null && (
          <div
            className={cn(
              "mt-1 text-xs",
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
          </div>
        )}
        {isExposureTopButPriceLosing && (
          <div className="mt-1 text-[11px] text-amber-500">
            노출 상단이지만 가격 기준으로는 밀림
          </div>
        )}
      </div>
    </div>
  );
}
