"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { MarginDetail as MarginDetailType } from "@/types";
import { formatPrice, formatPercent } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

interface Props {
  margin: MarginDetailType;
  simulatedMargin?: MarginDetailType | null;
  simPrice: string;
  setSimPrice: (value: string) => void;
  currentSellingPrice: number;
  isSimulating: boolean;
  onSimulate: () => void;
}

export function MarginDetail({
  margin,
  simulatedMargin,
  simPrice,
  setSimPrice,
  currentSellingPrice,
  isSimulating,
  onSimulate,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const marginColor =
    margin.margin_percent < 5
      ? "text-red-500"
      : margin.margin_percent < 10
        ? "text-amber-500"
        : margin.margin_percent < 20
          ? "text-emerald-500"
          : "text-blue-500";

  return (
    <div className="glass-card overflow-hidden">
      {/* 헤더 (항상 표시) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div>
          <h3 className="font-medium">수익성 분석</h3>
          <div className="mt-1 flex items-center gap-3 text-sm">
            <span className="text-[var(--muted-foreground)]">
              순마진 <span className={cn("font-semibold", marginColor)}>{formatPrice(margin.net_margin)}원</span>
            </span>
            <span className={cn("font-semibold", marginColor)}>
              ({formatPercent(margin.margin_percent)})
            </span>
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-[var(--muted-foreground)]" />
        ) : (
          <ChevronDown className="h-5 w-5 text-[var(--muted-foreground)]" />
        )}
      </button>

      {/* 상세 (접힘/펼침) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[var(--border)] px-4 pb-4 pt-3">
              {/* 수식 */}
              <div className="mb-3 flex items-center gap-2 text-sm">
                <span className="rounded bg-[var(--muted)] px-2 py-0.5">판매가</span>
                <span>-</span>
                <span className="rounded bg-[var(--muted)] px-2 py-0.5">매입가</span>
                <span>-</span>
                <span className="rounded bg-[var(--muted)] px-2 py-0.5">비용</span>
                <span>=</span>
                <span className={cn("font-semibold", marginColor)}>순마진</span>
              </div>

              {/* 항목 테이블 */}
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span>판매가</span>
                  <span className="tabular-nums font-medium">{formatPrice(margin.selling_price)}원</span>
                </div>
                <div className="flex justify-between">
                  <span>매입가</span>
                  <span className="tabular-nums font-medium">-{formatPrice(margin.cost_price)}원</span>
                </div>

                {margin.cost_items.map((item, i) => (
                  <div key={i} className="flex justify-between text-[var(--muted-foreground)]">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--muted-foreground)]" />
                      {item.name}
                      {item.type === "percent" && (
                        <span className="text-xs">({item.value}%)</span>
                      )}
                    </span>
                    <span className="tabular-nums">-{formatPrice(item.calculated)}원</span>
                  </div>
                ))}

                <div className="border-t border-[var(--border)] pt-1.5 flex justify-between font-semibold">
                  <span>비용 합계</span>
                  <span className="tabular-nums">-{formatPrice(margin.total_costs)}원</span>
                </div>

                <div className={cn("flex justify-between text-base font-bold pt-1", marginColor)}>
                  <span>순마진</span>
                  <span className="tabular-nums">{formatPrice(margin.net_margin)}원</span>
                </div>
              </div>

              {/* 시뮬레이션 비교 */}
              {simulatedMargin && (
                <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
                  <div className="text-xs font-medium text-blue-500 mb-2">시뮬레이션 비교</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-[var(--muted-foreground)] text-xs">현재</div>
                      <div className="font-medium tabular-nums">{formatPrice(margin.net_margin)}원</div>
                      <div className="text-xs text-[var(--muted-foreground)]">({formatPercent(margin.margin_percent)})</div>
                    </div>
                    <div>
                      <div className="text-xs text-blue-500">변경 시</div>
                      <div className="font-medium tabular-nums text-blue-500">
                        {formatPrice(simulatedMargin.net_margin)}원
                      </div>
                      <div className="text-xs text-blue-400">({formatPercent(simulatedMargin.margin_percent)})</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-[var(--muted-foreground)]">
                    차이: {formatPrice(simulatedMargin.net_margin - margin.net_margin)}원
                    ({simulatedMargin.margin_percent > margin.margin_percent ? "+" : ""}
                    {(simulatedMargin.margin_percent - margin.margin_percent).toFixed(1)}%p)
                  </div>
                </div>
              )}

              {/* 마진 시뮬레이션 */}
              <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-3">
                <h4 className="text-sm font-medium">마진 시뮬레이션</h4>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  판매가를 변경하면 예상 마진을 미리 확인할 수 있습니다
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    type="number"
                    value={simPrice}
                    onChange={(e) => setSimPrice(e.target.value)}
                    placeholder={`현재 ${formatPrice(currentSellingPrice)}원`}
                    className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors tabular-nums"
                  />
                  <button
                    onClick={onSimulate}
                    disabled={!simPrice || isSimulating}
                    className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    {isSimulating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "계산"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
