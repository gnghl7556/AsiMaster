"use client";

import { useProductList } from "@/lib/hooks/useProducts";
import { formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { STATUS_CONFIG } from "@/lib/utils/constants";

export function PriceCompareTable() {
  const { data: products = [], isLoading } = useProductList();

  const activeProducts = products.filter((p) => !p.is_price_locked).slice(0, 10);

  if (isLoading) return <div className="skeleton h-64" />;
  if (activeProducts.length === 0) return null;

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <h3 className="font-medium">가격 비교</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
              <th className="px-4 py-2 text-left font-medium">상품명</th>
              <th className="px-4 py-2 text-right font-medium">내 가격</th>
              <th className="px-4 py-2 text-right font-medium">최저 총액</th>
              <th className="px-4 py-2 text-right font-medium">차이</th>
              <th className="px-4 py-2 text-center font-medium">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {activeProducts.map((p) => {
              const config = STATUS_CONFIG[p.status];
              return (
                <tr key={p.id} className="hover:bg-[var(--muted)]/50 transition-colors">
                  <td className="px-4 py-2.5 font-medium truncate max-w-[200px]">
                    {p.name}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatPrice(p.selling_price)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {p.lowest_price ? formatPrice(p.lowest_price) : "-"}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2.5 text-right tabular-nums font-medium",
                      p.status === "winning"
                        ? "text-emerald-500"
                        : p.status === "losing"
                          ? "text-red-500"
                          : "text-amber-500"
                    )}
                  >
                    {p.price_gap != null
                      ? `${p.price_gap > 0 ? "+" : ""}${formatPrice(p.price_gap)}`
                      : "-"}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="text-xs">{config.emoji}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
