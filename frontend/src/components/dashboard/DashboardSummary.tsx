"use client";

import { TrendingDown, Minus, RefreshCw, Loader2, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { useDashboard } from "@/lib/hooks/useDashboard";
import { useProductList } from "@/lib/hooks/useProducts";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { timeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

interface SummaryCard {
  label: string;
  value: number | null;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

interface Props {
  onRefresh: () => void;
  isRefreshing: boolean;
}

const DASHBOARD_SCAN_LIMIT = 500;

export function DashboardSummary({ onRefresh, isRefreshing }: Props) {
  const { data, isLoading } = useDashboard();
  const { data: products = [] } = useProductList({
    page: 1,
    limit: DASHBOARD_SCAN_LIMIT,
    ignoreStoreFilters: true,
  });

  if (isLoading) {
    return (
      <div className="flex gap-2">
        <div className="grid grid-cols-3 gap-2 flex-1">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
        <div className="skeleton h-24 w-12 shrink-0" />
      </div>
    );
  }

  if (!data) return null;

  const activeProducts = products.filter((p) => !p.is_price_locked);
  const isPriceLosing = (p: (typeof activeProducts)[number]) =>
    p.price_gap != null ? p.price_gap > 0 : p.status === "losing";
  const normalProductsCount = activeProducts.filter((p) => !isPriceLosing(p)).length;
  const samePriceCount = products.filter(
    (p) => !p.is_price_locked && p.price_gap === 0
  ).length;
  const losingProducts = products.filter(
    (p) => !p.is_price_locked && (p.price_gap != null ? p.price_gap > 0 : p.status === "losing")
  );
  const cards: SummaryCard[] = [
    {
      label: "정상",
      value: normalProductsCount,
      icon: ShieldCheck,
      color: "text-emerald-500",
    },
    {
      label: "밀림",
      value: losingProducts.length,
      icon: TrendingDown,
      color: "text-red-500",
    },
    {
      label: "동일총액",
      value: samePriceCount,
      icon: Minus,
      color: "text-amber-500",
    },
  ];

  return (
    <div>
      <div className="flex gap-2">
        <div className="grid grid-cols-3 gap-2 flex-1">
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
            </motion.div>
          ))}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="glass-card w-12 shrink-0 flex items-center justify-center hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
          aria-label="전체 크롤링"
          title="전체 크롤링"
        >
          {isRefreshing ? (
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          ) : (
            <RefreshCw className="h-5 w-5 text-blue-500" />
          )}
        </button>
      </div>
      {data.last_crawled_at && (
        <div className="mt-2 text-right text-xs text-[var(--muted-foreground)]">
          {timeAgo(data.last_crawled_at)}
        </div>
      )}
    </div>
  );
}
