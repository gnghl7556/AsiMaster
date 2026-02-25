"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Crown, Store, Ban, Loader2, ChevronDown, TrendingUp, DollarSign } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { KeywordDetail } from "@/types";
import { productsApi } from "@/lib/api/products";
import { formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

interface Props {
  keywords: KeywordDetail[];
  myPrice: number;
  productId: number;
}

const MOBILE_ACTION_SLOT_WIDTH = 64;
type RankingSortMode = "exposure" | "price";

export function KeywordRankingList({ keywords, myPrice, productId }: Props) {
  const queryClient = useQueryClient();
  const [openItemKey, setOpenItemKey] = useState<string | null>(null);
  const [swipeOffsets, setSwipeOffsets] = useState<Record<string, number>>({});
  const [openKeywordId, setOpenKeywordId] = useState<number | null>(null);
  const [showTopTenByKeyword, setShowTopTenByKeyword] = useState<Record<number, boolean>>({});
  const [sortModeByKeyword, setSortModeByKeyword] = useState<Record<number, RankingSortMode>>({});
  const [excludeTarget, setExcludeTarget] = useState<{
    naver_product_id: string;
    product_name: string;
    mall_name: string;
  } | null>(null);
  const swipeRef = useRef<{
    key: string | null;
    startX: number;
    startY: number;
    baseOffset: number;
    isHorizontal: boolean;
  }>({
    key: null,
    startX: 0,
    startY: 0,
    baseOffset: 0,
    isHorizontal: false,
  });

  const excludeMutation = useMutation({
    mutationFn: (item: { naver_product_id: string; product_name: string; mall_name: string }) =>
      productsApi.excludeProduct(productId, {
        naver_product_id: item.naver_product_id,
        naver_product_name: item.product_name,
        mall_name: item.mall_name,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      queryClient.invalidateQueries({ queryKey: ["excluded-products", productId] });
      setExcludeTarget(null);
      toast.success("판매자 기준으로 경쟁사가 제외되었습니다");
    },
    onError: () => toast.error("제외에 실패했습니다"),
  });
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

  const getItemKey = (keywordId: number, itemId: number) => `${keywordId}-${itemId}`;

  const handleTouchStart = (
    key: string,
    e: React.TouchEvent<HTMLDivElement>
  ) => {
    const touch = e.touches[0];
    if (openItemKey && openItemKey !== key) {
      setSwipeOffsets((prev) => ({ ...prev, [openItemKey]: 0 }));
      setOpenItemKey(null);
    }
    swipeRef.current = {
      key,
      startX: touch.clientX,
      startY: touch.clientY,
      baseOffset: swipeOffsets[key] ?? (openItemKey === key ? 56 : 0),
      isHorizontal: false,
    };
  };

  const handleTouchMove = (
    key: string,
    actionWidth: number,
    e: React.TouchEvent<HTMLDivElement>
  ) => {
    if (swipeRef.current.key !== key) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - swipeRef.current.startX;
    const deltaY = touch.clientY - swipeRef.current.startY;

    if (!swipeRef.current.isHorizontal) {
      if (Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY)) {
        swipeRef.current.isHorizontal = true;
      } else {
        return;
      }
    }

    const nextOffset = Math.max(
      0,
      Math.min(actionWidth, swipeRef.current.baseOffset - deltaX)
    );
    setSwipeOffsets((prev) => ({ ...prev, [key]: nextOffset }));
  };

  const handleTouchEnd = (key: string, actionWidth: number) => {
    if (swipeRef.current.key !== key) return;
    const current = swipeOffsets[key] ?? 0;
    const shouldOpen = current >= actionWidth * 0.45;
    const nextOffset = shouldOpen ? actionWidth : 0;
    setSwipeOffsets((prev) => ({ ...prev, [key]: nextOffset }));
    setOpenItemKey(shouldOpen ? key : null);
    swipeRef.current.key = null;
  };

  const renderBrandMaker = (brand: string | null, maker: string | null) => {
    if (!brand && !maker) return null;
    return (
      <div className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]">
        {brand && (
          <span className="inline-flex items-center rounded-full bg-purple-500/10 px-1.5 py-0.5 font-medium text-purple-500">
            {brand}
          </span>
        )}
        {maker && (
          <span className="truncate">
            {brand && "· "}{maker}
          </span>
        )}
      </div>
    );
  };

  const getShippingBreakdownText = (shippingFee: number, shippingFeeType?: string) => {
    if (shippingFee > 0) return ` + 배송비 ${formatPrice(shippingFee)}원`;
    if (shippingFeeType === "free") return " · 무료배송";
    if (shippingFeeType === "error" || shippingFeeType === "unknown") return " · 배송비 미확인";
    return " · 무료배송";
  };

  const requestExclude = (item: {
    naver_product_id: string;
    product_name: string;
    mall_name: string;
  }) => {
    setExcludeTarget(item);
  };

  const excludeImpactPreview = excludeTarget
    ? (() => {
        const targetMall = excludeTarget.mall_name.trim().toLowerCase();
        const matches = keywords.flatMap((kw) =>
          kw.rankings
            .filter(
              (item) =>
                !item.is_my_store &&
                (item.mall_name || "").trim().toLowerCase() === targetMall
            )
            .map((item) => ({ item, keywordId: kw.id }))
        );
        const keywordCount = new Set(matches.map((match) => match.keywordId)).size;
        const uniqueProductCount = new Set(
          matches.map((match) => match.item.naver_product_id || `${match.item.mall_name}:${match.item.product_name}`)
        ).size;
        return {
          rowCount: matches.length,
          uniqueProductCount,
          keywordCount,
        };
      })()
    : null;

  return (
    <div className="space-y-4">
      {keywords.map((kw) => (
        <div key={kw.id} className="glass-card overflow-hidden">
          {(() => {
            const isExpanded = openKeywordId === kw.id;
            const showTopTen = showTopTenByKeyword[kw.id] ?? false;
            const sortMode = sortModeByKeyword[kw.id] ?? "exposure";
            const sortedRankings = [...kw.rankings].sort((a, b) => {
              if (sortMode === "price") {
                const aTotal = a.price + (a.shipping_fee || 0);
                const bTotal = b.price + (b.shipping_fee || 0);
                if (aTotal !== bTotal) return aTotal - bTotal;
                if (a.price !== b.price) return a.price - b.price;
                return a.rank - b.rank;
              }
              return a.rank - b.rank;
            });
            const visibleRankings = showTopTen
              ? sortedRankings.slice(0, 10)
              : sortedRankings.slice(0, 3);

            return (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setOpenKeywordId((prev) => (prev === kw.id ? null : kw.id));
                    if (!isExpanded) {
                      setShowTopTenByKeyword((prev) => ({ ...prev, [kw.id]: false }));
                    }
                  }}
                  className="w-full px-4 py-3 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-medium truncate">&ldquo;{kw.keyword}&rdquo;</h3>
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
                    <div className="px-4 py-2">
                      <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--muted)] p-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            setSortModeByKeyword((prev) => ({ ...prev, [kw.id]: "exposure" }))
                          }
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
                          onClick={() =>
                            setSortModeByKeyword((prev) => ({ ...prev, [kw.id]: "price" }))
                          }
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
                      {sortMode === "price" && (
                        <div className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                          배송비 포함 총액 기준으로 정렬합니다.
                        </div>
                      )}
                    </div>
                    {kw.rankings.length === 0 ? (
                      <div className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                        검색 결과가 없습니다. &quot;가격 새로고침&quot;을 눌러 검색하세요.
                      </div>
                    ) : (
                      visibleRankings.map((item, index) => {
                const displayRank = index + 1;
                const totalPrice = item.price + (item.shipping_fee || 0);
                const diffFromMe = totalPrice - myPrice;
                const itemKey = getItemKey(kw.id, item.id);
                const canOpenLink = Boolean(item.product_url);
                const canBan = !item.is_my_store && Boolean(item.naver_product_id);
                const actionCount = Number(canOpenLink) + Number(canBan);
                const actionWidth = actionCount * MOBILE_ACTION_SLOT_WIDTH;
                const hasActions = actionCount > 0;
                const currentOffset = hasActions
                  ? swipeOffsets[itemKey] ?? (openItemKey === itemKey ? actionWidth : 0)
                  : 0;

                return (
                  <div key={item.id}>
                    {/* Mobile: swipe card */}
                    <div className="relative overflow-hidden md:hidden">
                      {hasActions && (
                        <div
                          className="absolute inset-y-0 right-0 flex items-center justify-end"
                          style={{ width: `${actionWidth}px` }}
                        >
                          {canOpenLink && (
                            <a
                              href={item.product_url!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mx-1.5 flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] transition-colors hover:text-blue-500"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-5 w-5" />
                            </a>
                          )}
                          {canBan && (
                            <button
                              onClick={() =>
                                requestExclude({
                                  naver_product_id: item.naver_product_id!,
                                  product_name: item.product_name,
                                  mall_name: item.mall_name,
                                })
                              }
                              disabled={excludeMutation.isPending}
                              className="mx-1.5 flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 transition-colors hover:bg-red-500/15 disabled:opacity-60"
                              title="판매자 제외"
                            >
                              {excludeMutation.isPending ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                              ) : (
                                <Ban className="h-5 w-5" />
                              )}
                            </button>
                          )}
                        </div>
                      )}
                      <div
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 transition-transform duration-200 ease-out bg-[var(--card)]",
                          item.is_my_store && "ring-1 ring-inset ring-blue-500/20",
                          !item.is_relevant && "opacity-50"
                        )}
                        style={{
                          transform: hasActions
                            ? `translateX(-${currentOffset}px)`
                            : "translateX(0px)",
                        }}
                        onTouchStart={(e) => hasActions && handleTouchStart(itemKey, e)}
                        onTouchMove={(e) => hasActions && handleTouchMove(itemKey, actionWidth, e)}
                        onTouchEnd={() => hasActions && handleTouchEnd(itemKey, actionWidth)}
                        onTouchCancel={() => hasActions && handleTouchEnd(itemKey, actionWidth)}
                      >
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                            displayRank === 1
                              ? "bg-yellow-500 text-white"
                              : item.is_my_store
                              ? "bg-blue-500 text-white"
                              : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                          )}
                        >
                          {displayRank}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-base font-semibold">
                              {item.mall_name || "알 수 없음"}
                            </span>
                            {item.is_my_store && (
                              <span className="shrink-0 flex items-center gap-0.5 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-500">
                                <Store className="h-2.5 w-2.5" />
                                내 스토어
                              </span>
                            )}
                            {displayRank === 1 && (
                              <Crown className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                            )}
                          </div>
                          <div className="truncate text-sm text-[var(--muted-foreground)]">
                            {item.product_name}
                          </div>
                          {renderBrandMaker(item.brand, item.maker)}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-base font-bold tabular-nums">
                            {formatPrice(totalPrice)}원
                          </div>
                          <div className="text-[10px] text-[var(--muted-foreground)] tabular-nums">
                            상품가 {formatPrice(item.price)}원
                            {getShippingBreakdownText(
                              item.shipping_fee,
                              item.shipping_fee_type
                            )}
                          </div>
                          <div
                            className={cn(
                              "text-xs tabular-nums",
                              diffFromMe < 0
                                ? "text-red-500"
                                : diffFromMe > 0
                                ? "text-emerald-500"
                                : "text-[var(--muted-foreground)]"
                            )}
                          >
                            {diffFromMe === 0
                              ? "동일총액"
                              : diffFromMe < 0
                              ? `${formatPrice(diffFromMe)}원`
                              : `+${formatPrice(diffFromMe)}원`}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Desktop: existing layout */}
                    <div
                      className={cn(
                        "hidden md:flex items-center gap-3 px-4 py-3",
                        item.is_my_store && "bg-blue-500/5",
                        !item.is_relevant && "opacity-50"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                          displayRank === 1
                            ? "bg-yellow-500 text-white"
                            : item.is_my_store
                            ? "bg-blue-500 text-white"
                            : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                        )}
                      >
                        {displayRank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium">
                            {item.mall_name || "알 수 없음"}
                          </span>
                          {item.is_my_store && (
                            <span className="shrink-0 flex items-center gap-0.5 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-500">
                              <Store className="h-2.5 w-2.5" />
                              내 스토어
                            </span>
                          )}
                          {displayRank === 1 && (
                            <Crown className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                          )}
                        </div>
                        <div className="text-xs text-[var(--muted-foreground)] truncate">
                          {item.product_name}
                        </div>
                        {renderBrandMaker(item.brand, item.maker)}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold tabular-nums">
                          {formatPrice(totalPrice)}원
                        </div>
                        <div className="text-[10px] text-[var(--muted-foreground)] tabular-nums">
                          상품가 {formatPrice(item.price)}원
                          {getShippingBreakdownText(
                            item.shipping_fee,
                            item.shipping_fee_type
                          )}
                        </div>
                        <div
                          className={cn(
                            "text-xs tabular-nums",
                            diffFromMe < 0
                              ? "text-red-500"
                              : diffFromMe > 0
                              ? "text-emerald-500"
                              : "text-[var(--muted-foreground)]"
                          )}
                        >
                          {diffFromMe === 0
                            ? "동일총액"
                            : diffFromMe < 0
                            ? `${formatPrice(diffFromMe)}원`
                            : `+${formatPrice(diffFromMe)}원`}
                        </div>
                      </div>
                      {item.product_url && (
                        <a
                          href={item.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {!item.is_my_store && item.naver_product_id && (
                        <button
                          onClick={() =>
                            requestExclude({
                              naver_product_id: item.naver_product_id!,
                              product_name: item.product_name,
                              mall_name: item.mall_name,
                            })
                          }
                          disabled={excludeMutation.isPending}
                          className="shrink-0 rounded p-1 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-500 transition-colors"
                          title="판매자 제외"
                        >
                          {excludeMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Ban className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
                    {kw.rankings.length > 3 && (
                      <div className="px-4 py-2 flex items-center justify-center">
                        {!showTopTen ? (
                          <button
                            type="button"
                            onClick={() =>
                              setShowTopTenByKeyword((prev) => ({ ...prev, [kw.id]: true }))
                            }
                            className="text-xs font-medium text-blue-500 hover:text-blue-600 transition-colors"
                          >
                            더보기(10개)
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setShowTopTenByKeyword((prev) => ({ ...prev, [kw.id]: false }))
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
              </>
            );
          })()}
        </div>
      ))}
      {excludeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-card mx-4 w-full max-w-sm p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold">판매자 제외 확인</h3>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                같은 판매자명으로 노출된 항목도 함께 제외될 수 있습니다.
              </p>
              {excludeImpactPreview && (
                <p className="mt-1 text-xs text-amber-500">
                  현재 로드된 결과 기준 {excludeImpactPreview.rowCount}개 노출행
                  {excludeImpactPreview.uniqueProductCount > 0 &&
                    ` · 상품 ${excludeImpactPreview.uniqueProductCount}개`}
                  {excludeImpactPreview.keywordCount > 1
                    ? ` (키워드 ${excludeImpactPreview.keywordCount}개)`
                    : ""}{" "}
                  이 영향을 받을 수 있습니다.
                </p>
              )}
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-3">
              <div className="text-xs text-[var(--muted-foreground)]">판매자</div>
              <div className="truncate text-sm font-medium">{excludeTarget.mall_name}</div>
              <div className="mt-2 text-xs text-[var(--muted-foreground)]">선택 상품</div>
              <div className="line-clamp-2 text-sm">{excludeTarget.product_name}</div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setExcludeTarget(null)}
                disabled={excludeMutation.isPending}
                className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-sm font-medium hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => excludeMutation.mutate(excludeTarget)}
                disabled={excludeMutation.isPending}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {excludeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Ban className="h-4 w-4" />
                )}
                제외
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
