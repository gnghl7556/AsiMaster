"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { MarginDetail as MarginDetailType } from "@/types";
import { formatPrice, formatPercent } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { CostItemInput, CostPreset } from "@/lib/api/costs";
import { CostItemEditor } from "@/components/settings/CostItemEditor";

interface Props {
  margin: MarginDetailType;
  simulatedMargin?: MarginDetailType | null;
  costPriceInput: string;
  setCostPriceInput: (value: string) => void;
  currentCostPrice: number;
  isSavingCostPrice: boolean;
  onSaveCostPrice: () => void;
  simPrice: string;
  setSimPrice: (value: string) => void;
  currentSellingPrice: number;
  isSimulating: boolean;
  onSimulate: () => void;
  costItemsEditor: CostItemInput[];
  onChangeCostItem: (index: number, item: CostItemInput) => void;
  onAddCostItem: () => void;
  onRemoveCostItem: (index: number) => void;
  onSaveCostItems: () => void;
  isSavingCostItems: boolean;
  costItemsDirty: boolean;
  costPresets: CostPreset[];
  selectedCostPresetId: number | null;
  setSelectedCostPresetId: (value: number | null) => void;
  onApplyCostPreset: () => void;
  isApplyingCostPreset: boolean;
}

export function MarginDetail({
  margin,
  simulatedMargin,
  costPriceInput,
  setCostPriceInput,
  currentCostPrice,
  isSavingCostPrice,
  onSaveCostPrice,
  simPrice,
  setSimPrice,
  currentSellingPrice,
  isSimulating,
  onSimulate,
  costItemsEditor,
  onChangeCostItem,
  onAddCostItem,
  onRemoveCostItem,
  onSaveCostItems,
  isSavingCostItems,
  costItemsDirty,
  costPresets,
  selectedCostPresetId,
  setSelectedCostPresetId,
  onApplyCostPreset,
  isApplyingCostPreset,
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
              {/* 기준값 설정 */}
              <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-3">
                <h4 className="text-sm font-medium">기준값 설정</h4>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  수익성 계산에 사용하는 매입비용을 수정할 수 있습니다
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    type="number"
                    value={costPriceInput}
                    onChange={(e) => setCostPriceInput(e.target.value)}
                    placeholder={`현재 ${formatPrice(currentCostPrice)}원`}
                    min={1}
                    className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={onSaveCostPrice}
                    disabled={
                      isSavingCostPrice ||
                      !costPriceInput.trim() ||
                      Number(costPriceInput) <= 0 ||
                      Number(costPriceInput) === currentCostPrice
                    }
                    className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
                  >
                    {isSavingCostPrice ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "매입비용 저장"
                    )}
                  </button>
                </div>
              </div>

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

              {/* 비용 프리셋 / 비용 항목 편집 */}
              <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-medium">비용 프리셋 / 비용 항목</h4>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      설정에서 만든 프리셋을 적용하거나, 상품별 비용 항목을 직접 수정할 수 있습니다
                    </p>
                  </div>
                  {costItemsDirty && (
                    <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500">
                      저장 필요
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <select
                    value={selectedCostPresetId ?? ""}
                    onChange={(e) =>
                      setSelectedCostPresetId(e.target.value ? Number(e.target.value) : null)
                    }
                    className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none"
                  >
                    <option value="">비용 프리셋 선택</option>
                    {costPresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={onApplyCostPreset}
                    disabled={!selectedCostPresetId || isApplyingCostPreset}
                    className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-500 hover:bg-blue-500/15 transition-colors disabled:opacity-50"
                  >
                    {isApplyingCostPreset ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "프리셋 적용"
                    )}
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {costItemsEditor.map((item, i) => (
                    <div key={`${item.name}-${i}`} className="flex items-center gap-2">
                      <CostItemEditor item={item} onChange={(updated) => onChangeCostItem(i, updated)} />
                      {costItemsEditor.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onRemoveCostItem(i)}
                          className="shrink-0 rounded p-1 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-500"
                          title="항목 삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={onAddCostItem}
                      className="inline-flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      비용 항목 추가
                    </button>
                    <button
                      type="button"
                      onClick={onSaveCostItems}
                      disabled={isSavingCostItems || !costItemsDirty}
                      className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
                    >
                      {isSavingCostItems ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "비용 항목 저장"
                      )}
                    </button>
                  </div>
                </div>
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
