"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { KeywordDetail } from "@/types";
import {
  type RankingSortMode,
  type RankingVisibilityMode,
  isMyExactProduct,
  sortRankings,
  filterByVisibility,
  MOBILE_ACTION_SLOT_WIDTH,
} from "./rankingUtils";
import { useSwipeGesture } from "./useSwipeGesture";
import { useRankingActions } from "./useRankingActions";
import { RankingFilterBar } from "./RankingFilterBar";
import { RankingListItem } from "./RankingListItem";
import { ExcludeConfirmModal } from "./ExcludeConfirmModal";
import { ShippingOverrideModal } from "./ShippingOverrideModal";

interface Props {
  keywords: KeywordDetail[];
  myPrice: number;
  productId: number;
  myProductNaverId?: string | null;
  productModelCode?: string | null;
  productSpecKeywords?: string[] | null;
  priceFilterMinPct?: number | null;
  priceFilterMaxPct?: number | null;
}

export function KeywordRankingList({
  keywords,
  myPrice,
  productId,
  myProductNaverId = null,
  productModelCode = null,
  productSpecKeywords = null,
  priceFilterMinPct = null,
  priceFilterMaxPct = null,
}: Props) {
  const [openKeywordId, setOpenKeywordId] = useState<number | null>(null);
  const [showTopTenByKeyword, setShowTopTenByKeyword] = useState<
    Record<number, boolean>
  >({});
  const [sortModeByKeyword, setSortModeByKeyword] = useState<
    Record<number, RankingSortMode>
  >({});
  const [visibilityModeByKeyword, setVisibilityModeByKeyword] = useState<
    Record<number, RankingVisibilityMode>
  >({});

  const swipe = useSwipeGesture();
  const actions = useRankingActions(productId);

  if (keywords.length === 0) {
    return (
      <div className="glass-card p-8 text-center text-sm text-[var(--muted-foreground)]">
        등록된 키워드가 없습니다
      </div>
    );
  }

  useEffect(() => {
    if (keywords.length === 0) return;
    setOpenKeywordId((prev) => prev ?? keywords[0].id);
  }, [keywords]);

  return (
    <div className="space-y-4">
      {keywords.map((kw) => {
        const isExpanded = openKeywordId === kw.id;
        const showTopTen = showTopTenByKeyword[kw.id] ?? false;
        const sortMode = sortModeByKeyword[kw.id] ?? "exposure";
        const visibilityMode = visibilityModeByKeyword[kw.id] ?? "all";
        const sortedRankings = sortRankings(kw.rankings, sortMode);
        const visibilityFilteredRankings = filterByVisibility(
          sortedRankings,
          visibilityMode
        );
        const visibleRankings = showTopTen
          ? visibilityFilteredRankings.slice(0, 10)
          : visibilityFilteredRankings.slice(0, 3);

        return (
          <div key={kw.id} className="glass-card overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setOpenKeywordId((prev) =>
                  prev === kw.id ? null : kw.id
                );
                if (!isExpanded) {
                  setShowTopTenByKeyword((prev) => ({
                    ...prev,
                    [kw.id]: false,
                  }));
                }
              }}
              className="w-full px-4 py-3 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="font-medium truncate">
                  &ldquo;{kw.keyword}&rdquo;
                </h3>
                {kw.is_primary && (
                  <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-500">
                    기본
                  </span>
                )}
                {kw.sort_type === "asc" && (
                  <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
                    가격순
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded",
                    kw.crawl_status === "success"
                      ? "bg-emerald-500/10 text-emerald-500"
                      : kw.crawl_status === "failed"
                      ? "bg-red-500/10 text-red-500"
                      : "bg-gray-500/10 text-gray-500"
                  )}
                >
                  {kw.crawl_status === "success"
                    ? "검색 완료"
                    : kw.crawl_status === "failed"
                    ? "검색 실패"
                    : "대기 중"}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-[var(--muted-foreground)] transition-transform",
                    isExpanded && "rotate-180"
                  )}
                />
              </div>
            </button>
            {isExpanded && (
              <div className="divide-y divide-[var(--border)]">
                <RankingFilterBar
                  sortMode={sortMode}
                  visibilityMode={visibilityMode}
                  totalCount={kw.rankings.length}
                  relevantCount={
                    kw.rankings.filter((r) => r.is_relevant).length
                  }
                  filteredCount={
                    kw.rankings.filter((r) => !r.is_relevant).length
                  }
                  hasFilteredItems={kw.rankings.some(
                    (r) => !r.is_relevant
                  )}
                  onSortModeChange={(mode) =>
                    setSortModeByKeyword((prev) => ({
                      ...prev,
                      [kw.id]: mode,
                    }))
                  }
                  onVisibilityModeChange={(mode) =>
                    setVisibilityModeByKeyword((prev) => ({
                      ...prev,
                      [kw.id]: mode,
                    }))
                  }
                />
                {kw.rankings.length === 0 ? (
                  <div className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                    검색 결과가 없습니다. &quot;가격 새로고침&quot;을 눌러
                    검색하세요.
                  </div>
                ) : visibilityFilteredRankings.length === 0 ? (
                  <div className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                    선택한 필터 조건에 맞는 항목이 없습니다.
                  </div>
                ) : (
                  visibleRankings.map((item, index) => {
                    const displayRank = index + 1;
                    const itemKey = swipe.getItemKey(kw.id, item.id);
                    const canOpenLink = Boolean(item.product_url);
                    const canBan =
                      !isMyExactProduct(item, myProductNaverId) &&
                      Boolean(item.naver_product_id);
                    const actionCount =
                      Number(canOpenLink) + Number(canBan);
                    const actionWidth =
                      actionCount * MOBILE_ACTION_SLOT_WIDTH;
                    const hasActions = actionCount > 0;
                    const currentOffset = swipe.getCurrentOffset(
                      itemKey,
                      actionWidth,
                      hasActions
                    );

                    return (
                      <RankingListItem
                        key={item.id}
                        item={item}
                        displayRank={displayRank}
                        myPrice={myPrice}
                        myProductNaverId={myProductNaverId}
                        productModelCode={productModelCode}
                        productSpecKeywords={productSpecKeywords}
                        priceFilterMinPct={priceFilterMinPct}
                        priceFilterMaxPct={priceFilterMaxPct}
                        itemKey={itemKey}
                        currentOffset={currentOffset}
                        hasActions={hasActions}
                        actionWidth={actionWidth}
                        canBan={canBan}
                        canOpenLink={canOpenLink}
                        excludeIsPending={
                          actions.excludeMutation.isPending
                        }
                        includeActionPending={
                          actions.addIncludedOverrideMutation
                            .isPending ||
                          actions.removeIncludedOverrideMutation
                            .isPending
                        }
                        onTouchStart={swipe.handleTouchStart}
                        onTouchMove={swipe.handleTouchMove}
                        onTouchEnd={swipe.handleTouchEnd}
                        onRequestExclude={actions.requestExclude}
                        onAddIncludedOverride={
                          actions.handleAddIncludedOverride
                        }
                        onRemoveIncludedOverride={(naverProductId) =>
                          actions.removeIncludedOverrideMutation.mutate(
                            naverProductId
                          )
                        }
                        onShippingClick={actions.handleShippingClick}
                      />
                    );
                  })
                )}
                {visibilityFilteredRankings.length > 3 && (
                  <div className="px-4 py-2 flex items-center justify-center">
                    {!showTopTen ? (
                      <button
                        type="button"
                        onClick={() =>
                          setShowTopTenByKeyword((prev) => ({
                            ...prev,
                            [kw.id]: true,
                          }))
                        }
                        className="text-xs font-medium text-blue-500 hover:text-blue-600 transition-colors"
                      >
                        더보기(10개)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setShowTopTenByKeyword((prev) => ({
                            ...prev,
                            [kw.id]: false,
                          }))
                        }
                        className="text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                      >
                        접기
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {actions.excludeTarget && (
        <ExcludeConfirmModal
          excludeTarget={actions.excludeTarget}
          keywords={keywords}
          myProductNaverId={myProductNaverId}
          isPending={actions.excludeMutation.isPending}
          onConfirm={() =>
            actions.excludeMutation.mutate(actions.excludeTarget!)
          }
          onCancel={() => actions.setExcludeTarget(null)}
        />
      )}
      {actions.shippingTarget && (
        <ShippingOverrideModal
          shippingTarget={actions.shippingTarget}
          shippingFeeInput={actions.shippingFeeInput}
          onShippingFeeInputChange={actions.setShippingFeeInput}
          onCancel={() => actions.setShippingTarget(null)}
          onAdd={(data) => actions.addShippingOverrideMutation.mutate(data)}
          onUpdate={(data) =>
            actions.updateShippingOverrideMutation.mutate(data)
          }
          onRemove={(id) =>
            actions.removeShippingOverrideMutation.mutate(id)
          }
          isAddPending={actions.addShippingOverrideMutation.isPending}
          isUpdatePending={
            actions.updateShippingOverrideMutation.isPending
          }
          isRemovePending={
            actions.removeShippingOverrideMutation.isPending
          }
        />
      )}
    </div>
  );
}
