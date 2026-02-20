"use client";

import { ExternalLink, Trash2 } from "lucide-react";
import type { CompetitorDetail } from "@/types";
import { formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

interface Props {
  competitors: CompetitorDetail[];
  myPrice: number;
  onDelete?: (competitorId: number) => void;
}

export function CompetitorRanking({ competitors, myPrice, onDelete }: Props) {
  const sorted = [...competitors].sort((a, b) => a.total_price - b.total_price);

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <h3 className="font-medium">경쟁사 순위</h3>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {sorted.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">
            등록된 경쟁사가 없습니다
          </div>
        ) : (
          sorted.map((comp, idx) => {
            const isLowest = idx === 0;
            const diffFromMe = comp.total_price - myPrice;

            return (
              <div
                key={comp.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3",
                  isLowest && "bg-blue-500/5"
                )}
              >
                {/* 순위 */}
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    isLowest
                      ? "bg-blue-500 text-white"
                      : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                  )}
                >
                  {idx + 1}
                </div>

                {/* 판매자 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">
                      {comp.seller_name || "알 수 없음"}
                    </span>
                    <span className="shrink-0 rounded bg-[var(--muted)] px-1.5 py-0.5 text-[10px]">
                      {comp.platform}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    {formatPrice(comp.price)}원
                    {comp.shipping_fee > 0 && ` + 배송 ${formatPrice(comp.shipping_fee)}원`}
                    {comp.shipping_fee === 0 && " · 무료배송"}
                  </div>
                </div>

                {/* 가격 (총합) */}
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold tabular-nums">
                    {formatPrice(comp.total_price)}원
                  </div>
                  <div
                    className={cn(
                      "text-xs tabular-nums",
                      diffFromMe < 0 ? "text-red-500" : diffFromMe > 0 ? "text-emerald-500" : "text-[var(--muted-foreground)]"
                    )}
                  >
                    {diffFromMe === 0 ? "동일" : diffFromMe < 0 ? `${formatPrice(diffFromMe)}원` : `+${formatPrice(diffFromMe)}원`}
                  </div>
                </div>

                {/* 삭제 */}
                {onDelete && (
                  <button
                    onClick={() => onDelete(comp.id)}
                    className="shrink-0 rounded p-1 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
