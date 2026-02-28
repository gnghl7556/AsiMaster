"use client";

import {
  Lock,
  Unlock,
  RefreshCw,
  Loader2,
  Trash2,
} from "lucide-react";
import { timeAgo } from "@/lib/utils/format";
import type { ProductDetail } from "@/types";

interface ProductActionBarProps {
  product: ProductDetail;
  onCrawl: () => void;
  isCrawling: boolean;
  onToggleLock: () => void;
  isLocking: boolean;
  onDelete: () => void;
  isDeleting: boolean;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (show: boolean) => void;
}

export function ProductActionBar({
  product,
  onCrawl,
  isCrawling,
  onToggleLock,
  isLocking,
  onDelete,
  isDeleting,
  showDeleteConfirm,
  setShowDeleteConfirm,
}: ProductActionBarProps) {
  return (
    <>
      {/* 액션 바 */}
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
            onClick={onToggleLock}
            disabled={isLocking}
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
            onClick={() => setShowDeleteConfirm(true)}
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

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-card mx-4 w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-bold">상품 삭제</h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              <strong>{product.name}</strong>을(를) 삭제하시겠습니까?
              <br />
              등록된 키워드와 순위 데이터가 모두 삭제됩니다.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
              >
                취소
              </button>
              <button
                onClick={onDelete}
                disabled={isDeleting}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 가격고정 알림 */}
      {product.is_price_locked && (
        <div className="rounded-lg border border-gray-500/20 bg-gray-500/5 p-3 flex items-center gap-2">
          <Lock className="h-4 w-4 text-gray-500 shrink-0" />
          <div>
            <span className="text-sm font-medium">가격고정 중</span>
            {product.price_lock_reason && (
              <span className="text-sm text-[var(--muted-foreground)]">
                {" "}
                — {product.price_lock_reason}
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
