"use client";

import { cn } from "@/lib/utils/cn";
import { formatPercent } from "@/lib/utils/format";

interface MarginBarProps {
  percent: number | null;
  compact?: boolean;
}

export function MarginBar({ percent, compact = false }: MarginBarProps) {
  if (percent == null) return <span className="text-xs text-[var(--muted-foreground)]">-</span>;

  const width = Math.min(Math.max(percent, 0), 100);
  const color =
    percent < 5
      ? "bg-red-500"
      : percent < 10
      ? "bg-amber-500"
      : percent < 20
      ? "bg-emerald-500"
      : "bg-blue-500";

  if (compact) {
    return (
      <span className="text-xs tabular-nums text-[var(--muted-foreground)]">
        {formatPercent(percent)}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-[var(--muted)]">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${width}%` }} />
      </div>
      <span className="text-xs tabular-nums font-medium">{formatPercent(percent)}</span>
    </div>
  );
}
