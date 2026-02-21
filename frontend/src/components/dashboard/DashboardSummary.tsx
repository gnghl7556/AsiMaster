"use client";

import { Package, TrendingDown, Minus, Bell } from "lucide-react";
import { motion } from "framer-motion";
import { useDashboard } from "@/lib/hooks/useDashboard";
import { useProductList } from "@/lib/hooks/useProducts";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { formatPercent, timeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

interface SummaryCard {
  label: string;
  value: number | null;
  isNumber: boolean;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  suffix?: string;
  decimals?: number;
}

export function DashboardSummary() {
  const { data, isLoading } = useDashboard();
  const { data: products = [] } = useProductList();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton h-24" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const samePriceCount = products.filter(
    (p) => !p.is_price_locked && p.price_gap === 0
  ).length;

  const cards: SummaryCard[] = [
    {
      label: "관리 중",
      value: data.active_products,
      isNumber: true,
      sub: `총 ${data.total_products}개`,
      icon: Package,
      color: "text-blue-500",
    },
    {
      label: "밀림",
      value: data.status_counts.losing,
      isNumber: true,
      sub: "조치 필요",
      icon: TrendingDown,
      color: "text-red-500",
    },
    {
      label: "동일가",
      value: samePriceCount,
      isNumber: true,
      sub: "우리 상품과 동일 가격",
      icon: Minus,
      color: "text-amber-500",
    },
    {
      label: "미확인 알림",
      value: data.unread_alerts,
      isNumber: true,
      sub:
        data.crawl_success_rate != null
          ? `크롤링 ${formatPercent(data.crawl_success_rate)}`
          : "",
      icon: Bell,
      color: "text-blue-500",
    },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((card, idx) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            className="glass-card p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--muted-foreground)]">
                {card.label}
              </span>
              <card.icon className={cn("h-5 w-5", card.color)} />
            </div>
            <div className="mt-2 text-2xl font-bold">
              {card.value != null ? (
                <AnimatedNumber
                  value={card.value as number}
                  suffix={card.suffix}
                  decimals={card.decimals}
                />
              ) : (
                "-"
              )}
            </div>
            <div className="text-xs text-[var(--muted-foreground)]">
              {card.sub}
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
