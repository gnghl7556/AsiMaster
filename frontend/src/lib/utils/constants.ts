import type { ProductStatus } from "@/types";

export const STATUS_CONFIG: Record<
  ProductStatus,
  { label: string; emoji: string; color: string; glow: string; bg: string }
> = {
  winning: {
    label: "최저총액",
    emoji: "\uD83D\uDFE2",
    color: "text-emerald-500 dark:text-emerald-400",
    glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)] border-emerald-500/40 dark:shadow-[0_0_20px_rgba(52,211,153,0.25)] dark:border-emerald-400/40",
    bg: "bg-emerald-500/10 dark:bg-emerald-400/10",
  },
  close: {
    label: "근접총액",
    emoji: "\uD83D\uDFE1",
    color: "text-amber-500 dark:text-amber-400",
    glow: "shadow-[0_0_20px_rgba(245,158,11,0.15)] border-amber-500/40 dark:shadow-[0_0_20px_rgba(251,191,36,0.25)] dark:border-amber-400/40",
    bg: "bg-amber-500/10 dark:bg-amber-400/10",
  },
  losing: {
    label: "밀림",
    emoji: "\uD83D\uDD34",
    color: "text-red-500 dark:text-red-400",
    glow: "shadow-[0_0_20px_rgba(239,68,68,0.15)] border-red-500/40 dark:shadow-[0_0_20px_rgba(248,113,113,0.25)] dark:border-red-400/40",
    bg: "bg-red-500/10 dark:bg-red-400/10",
  },
};

export function getDisplayStatus(
  status: ProductStatus,
  priceGap?: number | null
): ProductStatus {
  // 사용자 행동 기준: 1원이라도 비싸면 사실상 '밀림'으로 간주
  if (status === "close" && priceGap != null && priceGap > 0) {
    return "losing";
  }
  return status;
}

export const SORT_OPTIONS = [
  { value: "urgency" as const, label: "긴급도 우선" },
  { value: "margin" as const, label: "마진 위험순" },
  { value: "rank_drop" as const, label: "순위 하락순" },
  { value: "category" as const, label: "카테고리별" },
];
