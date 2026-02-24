"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckSquare, Square, Trash2, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useProductList } from "@/lib/hooks/useProducts";
import { productsApi } from "@/lib/api/products";
import { useUserStore } from "@/stores/useUserStore";
import { useProductStore } from "@/stores/useProductStore";
import { SortDropdown } from "./SortDropdown";
import { SummaryBar } from "./SummaryBar";
import { ProductCard } from "./ProductCard";
import { PriceLockSection } from "./PriceLockSection";

interface Props {
  hideMeta?: boolean;
}

export function ProductList({ hideMeta = false }: Props) {
  const userId = useUserStore((s) => s.currentUserId);
  const sortBy = useProductStore((s) => s.sortBy);
  const category = useProductStore((s) => s.category);
  const search = useProductStore((s) => s.search);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const { data: products, isLoading, isFetching } = useProductList(
    hideMeta ? undefined : { page, limit: pageSize }
  );
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (hideMeta) return;
    setPage(1);
    setSelectedIds(new Set());
    setIsSelectMode(false);
  }, [hideMeta, sortBy, category, search]);

  const bulkDeleteMutation = useMutation({
    mutationFn: (productIds: number[]) => productsApi.bulkDelete(userId!, productIds),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(`${result.deleted}개 상품이 삭제되었습니다`);
      setSelectedIds(new Set());
      setIsSelectMode(false);
      setShowDeleteConfirm(false);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || "삭제에 실패했습니다";
      toast.error(msg);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--muted-foreground)]">
        <p className="text-lg font-medium">등록된 상품이 없습니다</p>
        <p className="text-sm mt-1">상품을 등록하고 경쟁사 가격을 모니터링하세요</p>
      </div>
    );
  }

  const activeProducts = products.filter((p) => !p.is_price_locked);
  const lockedProducts = products.filter((p) => p.is_price_locked);
  const hasNextPage = !hideMeta && products.length === pageSize;
  const allSelected =
    activeProducts.length > 0 && selectedIds.size === activeProducts.length;

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeProducts.map((p) => p.id)));
    }
  };

  const handleToggleMode = () => {
    setIsSelectMode((prev) => {
      const next = !prev;
      if (!next) setSelectedIds(new Set());
      return next;
    });
  };

  return (
    <div>
      {!hideMeta && (
        <>
          {/* 상단: 정렬 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <SortDropdown />
              <button
                type="button"
                onClick={handleToggleMode}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--muted)] transition-colors"
              >
                <CheckSquare className="h-4 w-4" />
                선택 삭제
              </button>
            </div>
          </div>
          {isSelectMode && (
            <div className="mb-3 flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
              <button
                type="button"
                onClick={toggleAll}
                className="inline-flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                >
                  {allSelected ? (
                    <CheckSquare className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                현재 페이지 전체 선택
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--muted-foreground)]">
                  {selectedIds.size}개 선택됨
                </span>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={selectedIds.size === 0 || bulkDeleteMutation.isPending}
                  className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {bulkDeleteMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  {selectedIds.size}개 삭제
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {!hideMeta && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card)]/60 px-3 py-2 text-xs">
          <div className="text-[var(--muted-foreground)]">
            페이지 {page}
            {isFetching && !isLoading ? " · 갱신 중" : ""}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 disabled:opacity-50 hover:bg-[var(--muted)] transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              이전
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNextPage}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 disabled:opacity-50 hover:bg-[var(--muted)] transition-colors"
            >
              다음
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {activeProducts.map((product) => (
            <div key={product.id} className={isSelectMode ? "relative pl-8" : ""}>
              {isSelectMode && (
                <button
                  type="button"
                  onClick={() => toggleSelect(product.id)}
                  className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-md p-1 hover:bg-[var(--muted)]"
                >
                  {selectedIds.has(product.id) ? (
                    <CheckSquare className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Square className="h-5 w-5 text-[var(--muted-foreground)]" />
                  )}
                </button>
              )}
              <ProductCard product={product} />
            </div>
          ))}
        </AnimatePresence>
      </div>

      {/* 가격고정 섹션 */}
      <PriceLockSection products={lockedProducts} />

      {/* 요약바 */}
      <div className="mt-4">
        <SummaryBar
          products={products}
          scopeLabel={hideMeta ? "관리 중" : "현재 페이지"}
        />
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-card mx-4 w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-bold">상품 복수 삭제</h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              선택한 <strong>{selectedIds.size}개</strong> 상품을 삭제하시겠습니까?
              <br />
              이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
                disabled={bulkDeleteMutation.isPending || selectedIds.size === 0}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {bulkDeleteMutation.isPending ? (
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
    </div>
  );
}
