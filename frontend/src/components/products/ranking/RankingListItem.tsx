"use client";

import {
  ExternalLink,
  Crown,
  Store,
  Ban,
  Loader2,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/format";
import type { RankingItemType } from "./rankingUtils";
import {
  isMyExactProduct,
  getRelevanceReasonLabels,
  getShippingBreakdownText,
  canShowShippingButton,
  MOBILE_ACTION_SLOT_WIDTH,
} from "./rankingUtils";

interface Props {
  item: RankingItemType;
  displayRank: number;
  myPrice: number;
  myProductNaverId: string | null;
  productModelCode: string | null;
  productSpecKeywords: string[] | null;
  priceFilterMinPct: number | null;
  priceFilterMaxPct: number | null;
  itemKey: string;
  currentOffset: number;
  hasActions: boolean;
  actionWidth: number;
  canBan: boolean;
  canOpenLink: boolean;
  excludeIsPending: boolean;
  includeActionPending: boolean;
  onTouchStart: (key: string, e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchMove: (
    key: string,
    actionWidth: number,
    e: React.TouchEvent<HTMLDivElement>
  ) => void;
  onTouchEnd: (key: string, actionWidth: number) => void;
  onRequestExclude: (item: {
    naver_product_id: string;
    product_name: string;
    mall_name: string;
  }) => void;
  onAddIncludedOverride: (item: {
    naver_product_id: string | null;
    product_name: string;
    mall_name: string;
  }) => void;
  onRemoveIncludedOverride: (naverProductId: string) => void;
  onShippingClick: (item: RankingItemType) => void;
}

function BrandMaker({
  brand,
  maker,
}: {
  brand: string | null;
  maker: string | null;
}) {
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
          {brand && "· "}
          {maker}
        </span>
      )}
    </div>
  );
}

function StoreBadge() {
  return (
    <span className="shrink-0 flex items-center gap-0.5 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-500">
      <Store className="h-2.5 w-2.5" />내 스토어
    </span>
  );
}

function IncludedOverrideBadge() {
  return (
    <span className="shrink-0 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-500">
      수동 포함 예외
    </span>
  );
}

function IncludeControls({
  item,
  relevanceReasonLabels,
  includeActionPending,
  onAddIncludedOverride,
  onRemoveIncludedOverride,
}: {
  item: RankingItemType;
  relevanceReasonLabels: string[];
  includeActionPending: boolean;
  onAddIncludedOverride: (item: {
    naver_product_id: string | null;
    product_name: string;
    mall_name: string;
  }) => void;
  onRemoveIncludedOverride: (naverProductId: string) => void;
}) {
  return (
    <div className="mt-1 space-y-1">
      {!item.is_relevant && relevanceReasonLabels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {relevanceReasonLabels.map((reason) => (
            <span
              key={`${item.id}-${reason}`}
              className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-500"
              title="자동필터/제외 사유"
            >
              {reason}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        <a
          href="#basic-info"
          className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[10px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          정확도 설정 조정
        </a>
        <button
          type="button"
          onClick={() => {
            if (item.is_included_override && item.naver_product_id) {
              onRemoveIncludedOverride(item.naver_product_id);
              return;
            }
            onAddIncludedOverride({
              naver_product_id: item.naver_product_id,
              product_name: item.product_name,
              mall_name: item.mall_name,
            });
          }}
          disabled={includeActionPending}
          className="inline-flex items-center rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[10px] font-medium text-blue-500 hover:bg-blue-500/15"
          title={
            item.is_included_override
              ? "수동 포함 예외 해제"
              : "자동필터 예외로 다시 포함"
          }
        >
          {includeActionPending
            ? "처리 중..."
            : item.is_included_override
            ? "예외 해제"
            : "다시 포함"}
        </button>
      </div>
    </div>
  );
}

function PriceInfo({
  totalPrice,
  diffFromMe,
  item,
  myProductNaverId,
  onShippingClick,
}: {
  totalPrice: number;
  diffFromMe: number;
  item: RankingItemType;
  myProductNaverId: string | null;
  onShippingClick: (item: RankingItemType) => void;
}) {
  return (
    <>
      <div className="text-sm font-bold tabular-nums md:text-base">
        {formatPrice(totalPrice)}원
      </div>
      <div className="text-[10px] text-[var(--muted-foreground)] tabular-nums">
        상품가 {formatPrice(item.price)}원
        {getShippingBreakdownText(
          item.shipping_fee,
          item.shipping_fee_type,
          item.is_shipping_override
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
      {canShowShippingButton(item, myProductNaverId) && (
        <button
          type="button"
          onClick={() => onShippingClick(item)}
          className="mt-0.5 inline-flex items-center gap-0.5 rounded border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-medium text-cyan-500 hover:bg-cyan-500/15"
        >
          <Truck className="h-2.5 w-2.5" />
          {item.is_shipping_override ? "배송비 수정" : "배송비 입력"}
        </button>
      )}
    </>
  );
}

function RankBadge({
  displayRank,
  isMyStore,
  className,
}: {
  displayRank: number;
  isMyStore: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold",
        displayRank === 1
          ? "bg-yellow-500 text-white"
          : isMyStore
          ? "bg-blue-500 text-white"
          : "bg-[var(--muted)] text-[var(--muted-foreground)]",
        className
      )}
    >
      {displayRank}
    </div>
  );
}

export function RankingListItem({
  item,
  displayRank,
  myPrice,
  myProductNaverId,
  productModelCode,
  productSpecKeywords,
  priceFilterMinPct,
  priceFilterMaxPct,
  itemKey,
  currentOffset,
  hasActions,
  actionWidth,
  canBan,
  canOpenLink,
  excludeIsPending,
  includeActionPending,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onRequestExclude,
  onAddIncludedOverride,
  onRemoveIncludedOverride,
  onShippingClick,
}: Props) {
  const totalPrice = item.price + (item.shipping_fee || 0);
  const diffFromMe = totalPrice - myPrice;
  const isExact = isMyExactProduct(item, myProductNaverId);

  const filterOpts = {
    myProductNaverId,
    myPrice,
    priceFilterMinPct,
    priceFilterMaxPct,
    productModelCode,
    productSpecKeywords,
  };

  const relevanceReasonLabels = getRelevanceReasonLabels(item, filterOpts);
  const showIncludeControls =
    !isExact &&
    Boolean(item.naver_product_id) &&
    (!item.is_relevant || item.is_included_override);

  return (
    <div>
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
                  onRequestExclude({
                    naver_product_id: item.naver_product_id!,
                    product_name: item.product_name,
                    mall_name: item.mall_name,
                  })
                }
                disabled={excludeIsPending}
                className="mx-1.5 flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 transition-colors hover:bg-red-500/15 disabled:opacity-60"
                title="상품 제외"
              >
                {excludeIsPending ? (
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
            !item.is_relevant &&
              (showIncludeControls
                ? "ring-1 ring-inset ring-amber-500/10"
                : "text-[var(--muted-foreground)]")
          )}
          style={{
            transform: hasActions
              ? `translateX(-${currentOffset}px)`
              : "translateX(0px)",
          }}
          onTouchStart={(e) => hasActions && onTouchStart(itemKey, e)}
          onTouchMove={(e) =>
            hasActions && onTouchMove(itemKey, actionWidth, e)
          }
          onTouchEnd={() => hasActions && onTouchEnd(itemKey, actionWidth)}
          onTouchCancel={() => hasActions && onTouchEnd(itemKey, actionWidth)}
        >
          <RankBadge
            displayRank={displayRank}
            isMyStore={item.is_my_store}
            className="h-8 w-8 text-sm"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-base font-semibold">
                {item.mall_name || "알 수 없음"}
              </span>
              {item.is_my_store && <StoreBadge />}
              {item.is_included_override && <IncludedOverrideBadge />}
              {displayRank === 1 && (
                <Crown className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
              )}
            </div>
            <div className="truncate text-sm text-[var(--muted-foreground)]">
              {item.product_name}
            </div>
            <BrandMaker brand={item.brand} maker={item.maker} />
            {showIncludeControls && (
              <IncludeControls
                item={item}
                relevanceReasonLabels={relevanceReasonLabels}
                includeActionPending={includeActionPending}
                onAddIncludedOverride={onAddIncludedOverride}
                onRemoveIncludedOverride={onRemoveIncludedOverride}
              />
            )}
          </div>
          <div className="shrink-0 text-right">
            <div className="text-base font-bold tabular-nums">
              {formatPrice(totalPrice)}원
            </div>
            <div className="text-[10px] text-[var(--muted-foreground)] tabular-nums">
              상품가 {formatPrice(item.price)}원
              {getShippingBreakdownText(
                item.shipping_fee,
                item.shipping_fee_type,
                item.is_shipping_override
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
            {canShowShippingButton(item, myProductNaverId) && (
              <button
                type="button"
                onClick={() => onShippingClick(item)}
                className="mt-0.5 inline-flex items-center gap-0.5 rounded border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-medium text-cyan-500 hover:bg-cyan-500/15"
              >
                <Truck className="h-2.5 w-2.5" />
                {item.is_shipping_override ? "배송비 수정" : "배송비 입력"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Desktop layout */}
      <div
        className={cn(
          "hidden md:flex items-center gap-3 px-4 py-3",
          item.is_my_store && "bg-blue-500/5",
          !item.is_relevant &&
            (showIncludeControls
              ? "bg-amber-500/5 ring-1 ring-inset ring-amber-500/10"
              : "opacity-50")
        )}
      >
        <RankBadge
          displayRank={displayRank}
          isMyStore={item.is_my_store}
          className="h-7 w-7 text-xs"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">
              {item.mall_name || "알 수 없음"}
            </span>
            {item.is_my_store && <StoreBadge />}
            {item.is_included_override && <IncludedOverrideBadge />}
            {displayRank === 1 && (
              <Crown className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
            )}
          </div>
          <div className="text-xs text-[var(--muted-foreground)] truncate">
            {item.product_name}
          </div>
          <BrandMaker brand={item.brand} maker={item.maker} />
          {showIncludeControls && (
            <IncludeControls
              item={item}
              relevanceReasonLabels={relevanceReasonLabels}
              includeActionPending={includeActionPending}
              onAddIncludedOverride={onAddIncludedOverride}
              onRemoveIncludedOverride={onRemoveIncludedOverride}
            />
          )}
        </div>
        <div className="text-right shrink-0">
          <PriceInfo
            totalPrice={totalPrice}
            diffFromMe={diffFromMe}
            item={item}
            myProductNaverId={myProductNaverId}
            onShippingClick={onShippingClick}
          />
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
        {!isExact && item.naver_product_id && (
          <button
            onClick={() =>
              onRequestExclude({
                naver_product_id: item.naver_product_id!,
                product_name: item.product_name,
                mall_name: item.mall_name,
              })
            }
            disabled={excludeIsPending}
            className="shrink-0 rounded p-1 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-500 transition-colors"
            title="상품 제외"
          >
            {excludeIsPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Ban className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
