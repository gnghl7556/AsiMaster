import type { KeywordDetail } from "@/types";
import { formatPrice } from "@/lib/utils/format";

export type RankingSortMode = "exposure" | "price";
export type RankingVisibilityMode = "all" | "relevant" | "filtered";

export type RankingItemType = KeywordDetail["rankings"][number];

export const MOBILE_ACTION_SLOT_WIDTH = 64;

export function isMyExactProduct(
  item: RankingItemType,
  myProductNaverId: string | null
): boolean {
  return (
    item.is_my_store &&
    Boolean(myProductNaverId) &&
    item.naver_product_id === myProductNaverId
  );
}

export function inferFilterReasons(
  item: RankingItemType,
  opts: {
    myProductNaverId: string | null;
    myPrice: number;
    priceFilterMinPct: number | null;
    priceFilterMaxPct: number | null;
    productModelCode: string | null;
    productSpecKeywords: string[] | null;
  }
): string[] {
  if (isMyExactProduct(item, opts.myProductNaverId) || item.is_relevant)
    return [];
  if (item.is_my_store && !item.is_relevant) {
    if (item.relevance_reason === "manual_blacklist") return ["수동 제외"];
    if (item.relevance_reason === "my_product")
      return ["내 스토어 (다른 상품)"];
    return [];
  }
  const reasons: string[] = [];
  const totalPrice = item.price + (item.shipping_fee || 0);

  if (opts.priceFilterMinPct != null && opts.myPrice > 0) {
    const minPrice = (opts.myPrice * opts.priceFilterMinPct) / 100;
    if (totalPrice < minPrice) reasons.push("가격범위(최소)");
  }
  if (opts.priceFilterMaxPct != null && opts.myPrice > 0) {
    const maxPrice = (opts.myPrice * opts.priceFilterMaxPct) / 100;
    if (totalPrice > maxPrice) reasons.push("가격범위(최대)");
  }

  const titleLower = item.product_name.toLowerCase();
  if (opts.productModelCode?.trim()) {
    if (
      !titleLower.includes(opts.productModelCode.trim().toLowerCase())
    ) {
      reasons.push("모델코드");
    } else if ((opts.productSpecKeywords ?? []).length > 0) {
      const missingSpec = (opts.productSpecKeywords ?? []).some(
        (spec) =>
          spec.trim() && !titleLower.includes(spec.trim().toLowerCase())
      );
      if (missingSpec) reasons.push("규격키워드");
    }
  }

  return reasons.length ? reasons : ["자동필터/제외"];
}

export function getRelevanceReasonLabels(
  item: RankingItemType,
  opts: {
    myProductNaverId: string | null;
    myPrice: number;
    priceFilterMinPct: number | null;
    priceFilterMaxPct: number | null;
    productModelCode: string | null;
    productSpecKeywords: string[] | null;
  }
): string[] {
  if (isMyExactProduct(item, opts.myProductNaverId)) return [];
  if (
    item.is_my_store &&
    !item.is_relevant &&
    item.relevance_reason === "manual_blacklist"
  )
    return ["수동 제외"];
  if (
    item.is_my_store &&
    !item.is_relevant &&
    item.relevance_reason === "my_product"
  )
    return ["내 스토어 (다른 상품)"];
  if (item.is_included_override) return ["수동 포함 예외"];
  if (item.is_relevant) return [];
  const reasonMap: Record<string, string> = {
    price_filter_min: "가격범위(최소)",
    price_filter_max: "가격범위(최대)",
    model_code: "모델코드",
    spec_keywords: "규격키워드",
    manual_blacklist: "수동 제외",
    included_override: "수동 포함 예외",
  };
  if (item.relevance_reason && reasonMap[item.relevance_reason]) {
    return [reasonMap[item.relevance_reason]];
  }
  return inferFilterReasons(item, opts);
}

export function getShippingBreakdownText(
  shippingFee: number,
  shippingFeeType?: string,
  isShippingOverride?: boolean
): string {
  const suffix = isShippingOverride ? "(수동)" : "";
  if (shippingFee > 0)
    return ` + 배송비 ${formatPrice(shippingFee)}원${suffix}`;
  if (isShippingOverride) return ` · 무료배송${suffix}`;
  if (shippingFeeType === "free") return " · 무료배송";
  if (shippingFeeType === "error" || shippingFeeType === "unknown")
    return " · 배송비 미확인";
  return " · 무료배송";
}

export function canShowShippingButton(
  item: RankingItemType,
  myProductNaverId: string | null
): boolean {
  return (
    !isMyExactProduct(item, myProductNaverId) &&
    Boolean(item.naver_product_id) &&
    (item.is_shipping_override ||
      item.shipping_fee_type === "unknown" ||
      item.shipping_fee_type === "error")
  );
}

export function sortRankings(
  rankings: RankingItemType[],
  sortMode: RankingSortMode
): RankingItemType[] {
  return [...rankings].sort((a, b) => {
    if (sortMode === "price") {
      const aTotal = a.price + (a.shipping_fee || 0);
      const bTotal = b.price + (b.shipping_fee || 0);
      if (aTotal !== bTotal) return aTotal - bTotal;
      if (a.price !== b.price) return a.price - b.price;
      return a.rank - b.rank;
    }
    return a.rank - b.rank;
  });
}

export function filterByVisibility(
  rankings: RankingItemType[],
  visibilityMode: RankingVisibilityMode
): RankingItemType[] {
  if (visibilityMode === "all") return rankings;
  if (visibilityMode === "relevant")
    return rankings.filter((item) => item.is_relevant);
  return rankings.filter((item) => !item.is_relevant);
}
