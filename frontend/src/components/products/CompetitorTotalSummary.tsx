"use client";

import { Crown, Store } from "lucide-react";
import { formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { CompetitorSummary, KeywordDetail } from "@/types";

interface Props {
  competitors: CompetitorSummary[];
  keywords?: KeywordDetail[];
  myProductNaverId?: string | null;
}

export function CompetitorTotalSummary({
  competitors,
  keywords = [],
  myProductNaverId = null,
}: Props) {
  const allMyRows = keywords.flatMap((kw) => kw.rankings).filter((r) => {
    if (myProductNaverId) return r.naver_product_id === myProductNaverId;
    return r.is_my_store;
  });

  const myBestRow = allMyRows.sort((a, b) => {
    const aTotal = a.price + (a.shipping_fee || 0);
    const bTotal = b.price + (b.shipping_fee || 0);
    if (aTotal !== bTotal) return aTotal - bTotal;
    return a.rank - b.rank;
  })[0];

  const mySummaryRow: CompetitorSummary | null = myBestRow
    ? {
        rank: myBestRow.rank,
        product_name: myBestRow.product_name,
        price: myBestRow.price,
        mall_name: myBestRow.mall_name,
        is_my_store: true,
        naver_product_id: myBestRow.naver_product_id,
        is_relevant: myBestRow.is_relevant,
        hprice: myBestRow.hprice,
        brand: myBestRow.brand,
        maker: myBestRow.maker,
        shipping_fee: myBestRow.shipping_fee,
        shipping_fee_type: myBestRow.shipping_fee_type,
        is_shipping_override: myBestRow.is_shipping_override ?? false,
      }
    : null;

  const getShippingBreakdownText = (shippingFee: number, shippingFeeType?: string) => {
    if (shippingFee > 0) return ` + 배송비 ${formatPrice(shippingFee)}원`;
    if (shippingFeeType === "free") return " · 무료배송";
    if (shippingFeeType === "error" || shippingFeeType === "unknown") return " · 배송비 미확인";
    return " · 무료배송";
  };

  const merged = mySummaryRow
    ? [
        ...competitors.filter((c) =>
          mySummaryRow.naver_product_id
            ? c.naver_product_id !== mySummaryRow.naver_product_id
            : !c.is_my_store
        ),
        mySummaryRow,
      ]
    : competitors;

  if (!merged.length) return null;

  const sortedWithRank = [...merged]
    .map((c) => ({
      ...c,
      total_price: c.price + (c.shipping_fee || 0),
    }))
    .sort((a, b) => a.total_price - b.total_price || a.rank - b.rank)
    .map((c, index) => ({ ...c, total_rank: index + 1 }));

  const myTotalRank = sortedWithRank.find((c) => c.is_my_store)?.total_rank ?? null;
  const visible = sortedWithRank.slice(0, 5);
  const myVisible = visible.some((c) => c.is_my_store);
  const visibleRows =
    !myVisible && myTotalRank
      ? [...visible, ...(sortedWithRank.filter((c) => c.is_my_store).slice(0, 1))]
      : visible;

  return (
    <div className="glass-card p-4">
      <div className="mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">가격 기준 경쟁 요약</h3>
          {myTotalRank && (
            <span className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-500">
              내 업체 총액 {myTotalRank}위
            </span>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {visibleRows.map((item, idx) => (
          <div
            key={`${item.mall_name}-${item.naver_product_id ?? item.rank}-${idx}`}
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)]/60 px-3 py-2",
              item.is_my_store &&
                "border-blue-500/40 bg-blue-500/10 ring-1 ring-inset ring-blue-500/20 shadow-[0_0_0_2px_rgba(59,130,246,0.06)]"
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--muted)] px-1 text-[10px] font-bold">
                  {item.total_rank}
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
                {item.total_rank === 1 && <Crown className="h-3.5 w-3.5 text-yellow-500" />}
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
                {getShippingBreakdownText(item.shipping_fee, item.shipping_fee_type)}
              </div>
            </div>
          </div>
        ))}
      </div>
      {!myVisible && myTotalRank && myTotalRank > 5 && (
        <div className="mt-2 text-[11px] text-[var(--muted-foreground)]">
          상위 5개 외에 내 업체 행을 함께 표시했습니다.
        </div>
      )}
    </div>
  );
}
