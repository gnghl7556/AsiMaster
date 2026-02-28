"use client";

import { formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

interface ProductMetricsCardsProps {
  sellingPrice: number;
  lowestPrice: number | null;
  lowestSeller: string | null;
  myRank: number | null;
  rankChange: number | null;
  status: string;
}

export function ProductMetricsCards({
  sellingPrice,
  lowestPrice,
  lowestSeller,
  myRank,
  rankChange,
  status,
}: ProductMetricsCardsProps) {
  const isExposureTopButPriceLosing = myRank === 1 && status === "losing";

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="glass-card p-4 text-center">
        <div className="text-sm text-[var(--muted-foreground)]">내 가격</div>
        <div className="text-lg font-bold mt-1 tabular-nums">
          {formatPrice(sellingPrice)}
        </div>
      </div>
      <div className="glass-card p-4 text-center">
        <div className="text-sm text-[var(--muted-foreground)]">최저 총액</div>
        <div className="text-lg font-bold mt-1 tabular-nums">
          {formatPrice(lowestPrice)}
        </div>
        <div className="text-[10px] text-[var(--muted-foreground)]">
          배송비 포함
        </div>
        {lowestSeller && (
          <div className="text-xs text-[var(--muted-foreground)]">
            {lowestSeller}
          </div>
        )}
      </div>
      <div className="glass-card p-4 text-center">
        <div className="text-sm text-[var(--muted-foreground)]">노출 순위</div>
        <div className="text-lg font-bold mt-1 tabular-nums">
          {myRank ? `노출 ${myRank}위` : "-"}
        </div>
        {rankChange != null && (
          <div
            className={cn(
              "mt-1 text-xs",
              rankChange > 0
                ? "text-red-500"
                : rankChange < 0
                ? "text-emerald-500"
                : "text-[var(--muted-foreground)]"
            )}
          >
            {rankChange > 0
              ? `노출 하락 ${rankChange}`
              : rankChange < 0
              ? `노출 상승 ${Math.abs(rankChange)}`
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
