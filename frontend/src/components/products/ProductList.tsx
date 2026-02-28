"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckSquare, Square, Trash2, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useProductList } from "@/lib/hooks/useProducts";
import { productsApi } from "@/lib/api/products";
import { costsApi } from "@/lib/api/costs";
import { useUserStore } from "@/stores/useUserStore";
import { SortDropdown } from "./SortDropdown";
import type { SortOption } from "@/types";
import { SummaryBar } from "./SummaryBar";
import { ProductCard } from "./ProductCard";
import { PriceLockSection } from "./PriceLockSection";

interface Props {
  hideMeta?: boolean;
}

const PAGE_SIZE_STORAGE_KEY = "asimaster:products-page-size";
const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

export function ProductList({ hideMeta = false }: Props) {
  const userId = useUserStore((s) => s.currentUserId);
  const [sortBy, setSortBy] = useState<SortOption>("urgency");
  const [category] = useState<string | null>(null);
  const [search] = useState("");
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const { data: products, isLoading, isFetching } = useProductList(
    hideMeta ? undefined : { page, limit: pageSize, sortBy, category, search }
  );
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPresetApplyModal, setShowPresetApplyModal] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const { data: costPresets = [] } = useQuery({
    queryKey: ["cost-presets", userId],
    queryFn: () => costsApi.getPresets(userId!),
    enabled: !!userId,
  });

  useEffect(() => {
    if (hideMeta) return;
    if (typeof window === "undefined") return;
    const saved = Number(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY));
    if (PAGE_SIZE_OPTIONS.includes(saved as (typeof PAGE_SIZE_OPTIONS)[number])) {
      setPageSize(saved);
    }
  }, [hideMeta]);

  useEffect(() => {
    if (hideMeta) return;
    setPage(1);
    setSelectedIds(new Set());
    setIsSelectMode(false);
  }, [hideMeta, sortBy, category, search, pageSize]);

  useEffect(() => {
    if (hideMeta) return;
    if (isLoading) return;
    if (!products || products.length > 0) return;
    if (page <= 1) return;

    // After deletions or filter changes, step back from an empty page automatically.
    setPage((prev) => Math.max(1, prev - 1));
    setSelectedIds(new Set());
    setShowDeleteConfirm(false);
  }, [hideMeta, isLoading, page, products]);

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
  const applyPresetMutation = useMutation({
    mutationFn: (params: { presetId: number; productIds: number[] }) =>
      costsApi.applyPreset(params.presetId, params.productIds),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      toast.success(
        `${result.applied}개 상품에 프리셋 적용 완료${
          result.skipped > 0
            ? ` (${result.skipped}개 스킵${result.skipped_reason ? `: ${result.skipped_reason}` : ""})`
            : ""
        }`
      );
      setShowPresetApplyModal(false);
      setSelectedPresetId(null);
    },
    onError: () => toast.error("비용 프리셋 적용에 실패했습니다"),
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
    if (!hideMeta && page > 1) {
      return (
        <div className="flex items-center justify-center py-16 text-sm text-[var(--muted-foreground)]">
          이전 페이지로 이동 중...
        </div>
      );
    }
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
      if (!next) {
        setSelectedIds(new Set());
        setShowDeleteConfirm(false);
        setShowPresetApplyModal(false);
        setSelectedPresetId(null);
      }
      return next;
    });
  };

  const handleChangePageSize = (nextSize: number) => {
    if (nextSize === pageSize) return;
    setPageSize(nextSize);
    setPage(1);
    setSelectedIds(new Set());
    setShowDeleteConfirm(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(nextSize));
    }
  };

  return (
    <div>
      {!hideMeta && (
        <>
          {/* 상단: 정렬 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <SortDropdown sortBy={sortBy} setSortBy={setSortBy} />
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
                <button
                  type="button"
                  onClick={() => setShowPresetApplyModal(true)}
                  disabled={selectedIds.size === 0}
                  className="inline-flex items-center gap-1 rounded-lg border border-blue-500/20 bg-blue-500/10 px-2.5 py-1.5 text-xs font-medium text-blue-500 hover:bg-blue-500/15 transition-colors disabled:opacity-50"
                >
                  비용 프리셋 적용
                </button>
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
          <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
            <span>
              페이지 {page}
              {isFetching && !isLoading ? " · 갱신 중" : ""}
            </span>
            <div className="inline-flex items-center gap-1">
              <span>표시</span>
              <select
                value={pageSize}
                onChange={(e) => handleChangePageSize(Number(e.target.value))}
                className="rounded-md border border-[var(--border)] bg-[var(--card)] px-1.5 py-0.5 text-[11px] text-[var(--foreground)] outline-none"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}개
                  </option>
                ))}
              </select>
            </div>
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

      {showPresetApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-card mx-4 w-full max-w-sm p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold">비용 프리셋 적용</h3>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                선택한 <strong>{selectedIds.size}개</strong> 상품에 적용할 프리셋을 선택하세요.
              </p>
            </div>
            <select
              value={selectedPresetId ?? ""}
              onChange={(e) => setSelectedPresetId(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none"
            >
              <option value="">프리셋 선택</option>
              {costPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowPresetApplyModal(false);
                  setSelectedPresetId(null);
                }}
                disabled={applyPresetMutation.isPending}
                className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-sm font-medium hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() =>
                  applyPresetMutation.mutate({
                    presetId: selectedPresetId!,
                    productIds: Array.from(selectedIds),
                  })
                }
                disabled={applyPresetMutation.isPending || !selectedPresetId || selectedIds.size === 0}
                className="flex-1 rounded-xl bg-blue-500 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {applyPresetMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                적용
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
