"use client";

import { STATUS_CONFIG } from "@/lib/utils/constants";
import type { ProductStatus } from "@/types";
import { cn } from "@/lib/utils/cn";

interface StatusBadgeProps {
  status: ProductStatus;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const neonClass = status === "winning" ? "neon-green" : status === "close" ? "neon-yellow" : "neon-red";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-semibold",
        config.bg,
        config.color,
        neonClass,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
      )}
    >
      <span>{config.emoji}</span>
      <span>{config.label}</span>
    </span>
  );
}
