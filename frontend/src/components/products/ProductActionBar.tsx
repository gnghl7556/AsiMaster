"use client";

import {
  RefreshCw,
  Loader2,
  Lock,
  Unlock,
  Trash2,
} from "lucide-react";
import { timeAgo } from "@/lib/utils/format";
import type { ProductDetail } from "@/types";

interface ProductActionBarProps {
  product: ProductDetail;
  onCrawl: () => void;
  isCrawling: boolean;
  onTogglePriceLock: () => void;
  isTogglingLock: boolean;
  onDelete: () => void;
}

export function ProductActionBar({
  product,
  onCrawl,
  isCrawling,
  onTogglePriceLock,
  isTogglingLock,
  onDelete,
}: ProductActionBarProps) {
  return (
    <div className="sticky top-0 z-30 -mx-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-1 py-2 isolate">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onCrawl}
          disabled={isCrawling}
          className="flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-1.5 text-sm text-blue-500 hover:bg-blue-500/10 transition-colors"
        >
          {isCrawling ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          가격 새로고침
        </button>
        <button
          onClick={onTogglePriceLock}
          disabled={isTogglingLock}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--muted)] transition-colors"
        >
          {product.is_price_locked ? (
            <>
              <Unlock className="h-3.5 w-3.5" />
              고정 해제
            </>
          ) : (
            <>
              <Lock className="h-3.5 w-3.5" />
              가격고정
            </>
          )}
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          삭제
        </button>
        {product.last_crawled_at && (
          <span className="flex items-center text-xs text-[var(--muted-foreground)] ml-auto">
            {timeAgo(product.last_crawled_at)}
          </span>
        )}
      </div>
    </div>
  );
}
