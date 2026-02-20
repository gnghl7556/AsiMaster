"use client";

import type { ProductListItem } from "@/types";

interface SummaryBarProps {
  products: ProductListItem[];
}

export function SummaryBar({ products }: SummaryBarProps) {
  const active = products.filter((p) => !p.is_price_locked);
  const locked = products.filter((p) => p.is_price_locked);
  const winning = active.filter((p) => p.status === "winning").length;
  const close = active.filter((p) => p.status === "close").length;
  const losing = active.filter((p) => p.status === "losing").length;

  return (
    <div className="flex items-center gap-3 rounded-lg bg-[var(--muted)] px-4 py-2 text-sm">
      <span>
        관리 중 <strong>{active.length}개</strong>
      </span>
      <span className="text-[var(--muted-foreground)]">(</span>
      <span className="text-red-500">{"\uD83D\uDD34"}{losing}</span>
      <span className="text-amber-500">{"\uD83D\uDFE1"}{close}</span>
      <span className="text-emerald-500">{"\uD83D\uDFE2"}{winning}</span>
      <span className="text-[var(--muted-foreground)]">)</span>
      {locked.length > 0 && (
        <>
          <span className="text-[var(--muted-foreground)]">&middot;</span>
          <span>
            가격고정 <strong>{locked.length}개</strong>
          </span>
        </>
      )}
    </div>
  );
}
