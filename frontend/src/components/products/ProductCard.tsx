"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatPrice, timeAgo } from "@/lib/utils/format";
import { STATUS_CONFIG } from "@/lib/utils/constants";
import { StatusBadge } from "./StatusBadge";
import { PriceGap } from "./PriceGap";
import { MarginBar } from "./MarginBar";
import { SparklineChart } from "./SparklineChart";
import type { ProductListItem } from "@/types";

interface ProductCardProps {
  product: ProductListItem;
}

export function ProductCard({ product }: ProductCardProps) {
  const config = STATUS_CONFIG[product.status];

  if (product.is_price_locked) {
    return (
      <motion.div layout layoutId={`product-${product.id}`}>
        <Link
          href={`/products/${product.id}`}
          className={cn(
            "glass-card block p-4 border border-gray-500/20 transition-all hover:border-gray-500/40"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-gray-500" />
              <span className="font-medium">{product.name}</span>
            </div>
            <div className="flex items-center gap-4">
              <PriceGap gap={product.price_gap} gapPercent={product.price_gap_percent} status={product.status} size="sm" />
              <MarginBar percent={product.margin_percent} compact />
            </div>
          </div>
          {product.price_lock_reason && (
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              사유: {product.price_lock_reason}
            </p>
          )}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div layout layoutId={`product-${product.id}`}>
      <Link
        href={`/products/${product.id}`}
        className={cn("glass-card block p-4 transition-all hover:scale-[1.01]", config.glow)}
      >
        {/* Mobile/Tablet layout */}
        <div className="flex items-center justify-between gap-3 lg:hidden">
          {/* 좌: 상태 + 상품명 */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <StatusBadge status={product.status} />
            <div className="min-w-0">
              <h3 className="font-medium truncate">{product.name}</h3>
              {product.category && (
                <span className="text-xs text-[var(--muted-foreground)]">{product.category}</span>
              )}
            </div>
          </div>
        </div>

        {/* Desktop layout with fixed columns */}
        <div className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_120px_140px_130px_130px_150px] lg:items-center lg:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <StatusBadge status={product.status} />
            <div className="min-w-0">
              <h3 className="font-medium truncate">{product.name}</h3>
              {product.category && (
                <span className="text-xs text-[var(--muted-foreground)]">{product.category}</span>
              )}
            </div>
          </div>

          <div className="text-right">
            <div className="text-[11px] text-[var(--muted-foreground)]">내 가격</div>
            <div className="font-semibold tabular-nums">{formatPrice(product.selling_price)}</div>
          </div>

          <div className="text-right">
            <div className="text-[11px] text-[var(--muted-foreground)]">최저 총액</div>
            <div className="font-semibold tabular-nums">{formatPrice(product.lowest_price)}</div>
            {product.lowest_seller && (
              <div className="truncate text-[11px] text-[var(--muted-foreground)]">
                {product.lowest_seller}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <PriceGap
              gap={product.price_gap}
              gapPercent={product.price_gap_percent}
              status={product.status}
            />
          </div>

          <div className="flex justify-end border-l border-[var(--border)]/60 pl-3">
            <div className="flex flex-col items-end gap-1">
              <MarginBar percent={product.margin_percent} />
              <span className="text-[11px] text-[var(--muted-foreground)] tabular-nums">
                순수익 {formatPrice(product.margin_amount)}원
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-0.5">
            {product.my_rank && (
              <span className="text-xs text-[var(--muted-foreground)]">
                내 순위: {product.my_rank}위
              </span>
            )}
            <SparklineChart data={product.sparkline} />
          </div>
        </div>

        {/* 모바일: 추가 정보 */}
        <div className="mt-2 flex items-center justify-between sm:hidden">
          <MarginBar percent={product.margin_percent} />
          <span className="text-xs text-[var(--muted-foreground)]">
            {timeAgo(product.last_crawled_at)}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
