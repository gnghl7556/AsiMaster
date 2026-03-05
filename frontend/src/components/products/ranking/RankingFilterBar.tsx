"use client";

import { TrendingUp, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { RankingSortMode, RankingVisibilityMode } from "./rankingUtils";

interface Props {
  sortMode: RankingSortMode;
  visibilityMode: RankingVisibilityMode;
  totalCount: number;
  relevantCount: number;
  filteredCount: number;
  hasFilteredItems: boolean;
  onSortModeChange: (mode: RankingSortMode) => void;
  onVisibilityModeChange: (mode: RankingVisibilityMode) => void;
}

export function RankingFilterBar({
  sortMode,
  visibilityMode,
  totalCount,
  relevantCount,
  filteredCount,
  hasFilteredItems,
  onSortModeChange,
  onVisibilityModeChange,
}: Props) {
  return (
    <div className="px-4 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--muted)] p-0.5">
          <button
            type="button"
            onClick={() => onSortModeChange("exposure")}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
              sortMode === "exposure"
                ? "bg-[var(--card)] text-blue-500 shadow-sm"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            노출
          </button>
          <button
            type="button"
            onClick={() => onSortModeChange("price")}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
              sortMode === "price"
                ? "bg-[var(--card)] text-amber-500 shadow-sm"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
          >
            <DollarSign className="h-3.5 w-3.5" />
            총액
          </button>
        </div>
        <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--muted)] p-0.5">
          {(
            [
              { key: "all", label: "전체" },
              { key: "relevant", label: "관련만" },
              { key: "filtered", label: "제외됨만" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => onVisibilityModeChange(opt.key)}
              className={cn(
                "rounded-md px-2 py-1 text-xs transition-colors",
                visibilityMode === opt.key
                  ? "bg-[var(--card)] text-blue-500 shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1 text-[11px] text-[var(--muted-foreground)]">
        전체 {totalCount}개 · 관련 {relevantCount}개 · 제외/필터{" "}
        {filteredCount}개
      </div>
      {hasFilteredItems && (
        <div className="mt-1 text-[11px] text-[var(--muted-foreground)]">
          자동필터 제외 항목은 현재 최저총액/경쟁요약 계산에서 제외됩니다.
        </div>
      )}
      {sortMode === "price" && (
        <div className="mt-1 text-[11px] text-[var(--muted-foreground)]">
          배송비 포함 총액 기준으로 정렬합니다.
        </div>
      )}
    </div>
  );
}
