"use client";

import { formatGap, formatPercent } from "@/lib/utils/format";
import type { ProductStatus } from "@/types";
import { cn } from "@/lib/utils/cn";
import { STATUS_CONFIG } from "@/lib/utils/constants";

interface PriceGapProps {
  gap: number | null;
  gapPercent: number | null;
  status: ProductStatus;
  size?: "sm" | "lg";
}

export function PriceGap({ gap, gapPercent, status, size = "lg" }: PriceGapProps) {
  const config = STATUS_CONFIG[status];

  if (gap == null || gap === 0) {
    return (
      <div className={cn("font-bold", config.color, size === "lg" ? "text-2xl" : "text-base")}>
        -
      </div>
    );
  }

  // 동적 타이포그래피: 차이가 클수록 폰트 크기 증가
  const absGap = Math.abs(gap);
  const dynamicSize =
    size === "lg"
      ? absGap > 50000
        ? "text-3xl"
        : absGap > 10000
        ? "text-2xl"
        : "text-xl"
      : "text-base";

  return (
    <div className="flex flex-col items-end">
      <span className={cn("font-bold tabular-nums", config.color, dynamicSize)}>
        {formatGap(gap)}
      </span>
      {gapPercent != null && (
        <span className={cn("text-xs tabular-nums", config.color)}>
          {gap > 0 ? "\u25B2" : "\u25BC"} {formatPercent(Math.abs(gapPercent))}
        </span>
      )}
    </div>
  );
}
