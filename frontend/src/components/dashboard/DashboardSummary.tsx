"use client";

import { TrendingDown, Minus, Bell } from "lucide-react";
import { motion } from "framer-motion";
import { useDashboard } from "@/lib/hooks/useDashboard";
import { useProductList } from "@/lib/hooks/useProducts";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { timeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

interface SummaryCard {
  label: string;
  value: number | null;
  time: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

export function DashboardSummary() {
  const { data, isLoading } = useDashboard();
  const { data: products = [] } = useProductList();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton h-24" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const activeProducts = products.filter((p) => !p.is_price_locked);
  const samePriceCount = products.filter(
    (p) => !p.is_price_locked && p.price_gap === 0
  ).length;
  const losingProducts = products.filter(
    (p) => !p.is_price_locked && p.status === "losing"
  );
  const samePriceProducts = activeProducts.filter((p) => p.price_gap === 0);

  const latestDetectedAt = (items: typeof activeProducts) => {
    const latest = items
      .map((item) => item.last_crawled_at)
      .filter(Boolean)
      .sort()
      .pop();
    return latest ? timeAgo(latest) : "기록 없음";
  };

  const cards: SummaryCard[] = [
    {
      label: "밀림",
      value: data.status_counts.losing,
      time: latestDetectedAt(losingProducts),
      icon: TrendingDown,
      color: "text-red-500",
    },
    {
      label: "동일가",
      value: samePriceCount,
      time: latestDetectedAt(samePriceProducts),
      icon: Minus,
      color: "text-amber-500",
    },
    {
      label: "미확인 알림",
      value: data.unread_alerts,
      time: "현재 기준",
      icon: Bell,
      color: "text-blue-500",
    },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cards.map((card, idx) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            className="glass-card px-3 py-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-medium text-[var(--muted-foreground)]">
                {card.label}
              </div>
              <div className={cn("rounded-md p-1.5 bg-[var(--muted)]", card.color)}>
                <card.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-1 text-3xl font-bold leading-none tabular-nums">
              {card.value != null ? (
                <AnimatedNumber value={card.value as number} />
              ) : (
                "-"
              )}
            </div>
            <div className="mt-2 text-[11px] text-[var(--muted-foreground)]">
              {card.time}
            </div>
          </motion.div>
        ))}
      </div>
      {data.last_crawled_at && (
        <div className="mt-2 text-right text-xs text-[var(--muted-foreground)]">
          {timeAgo(data.last_crawled_at)}
        </div>
      )}
    </div>
  );
}
