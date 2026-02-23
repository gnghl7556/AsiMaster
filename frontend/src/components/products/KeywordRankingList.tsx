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
      toast.success("경쟁사가 제외되었습니다");
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
                          노출 순위
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
                          가격 순위
                        </button>
                      </div>
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
                                excludeMutation.mutate({
                                  naver_product_id: item.naver_product_id!,
                                  product_name: item.product_name,
                                  mall_name: item.mall_name,
                                })
                              }
                              disabled={excludeMutation.isPending}
                              className="mx-1.5 flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 transition-colors hover:bg-red-500/15 disabled:opacity-60"
                              title="이 상품 제외"
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
                          {item.shipping_fee > 0 && (
                            <div className="text-[10px] text-[var(--muted-foreground)]">
                              배송비 +{formatPrice(item.shipping_fee)}원
                            </div>
                          )}
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
                              ? "동일"
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
                        {item.shipping_fee > 0 && (
                          <div className="text-[10px] text-[var(--muted-foreground)]">
                            배송비 +{formatPrice(item.shipping_fee)}원
                          </div>
                        )}
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
                            ? "동일"
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
                            excludeMutation.mutate({
                              naver_product_id: item.naver_product_id!,
                              product_name: item.product_name,
                              mall_name: item.mall_name,
                            })
                          }
                          disabled={excludeMutation.isPending}
                          className="shrink-0 rounded p-1 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-500 transition-colors"
                          title="이 상품 제외"
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
    </div>
  );
}
