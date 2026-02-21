"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  CheckSquare,
  Download,
  Loader2,
  Package,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { productsApi } from "@/lib/api/products";
import { useUserStore } from "@/stores/useUserStore";
import { formatPrice } from "@/lib/utils/format";
import type { StoreProduct } from "@/types";
import { cn } from "@/lib/utils/cn";

export default function StoreImportPage() {
  const userId = useUserStore((s) => s.currentUserId);
  const queryClient = useQueryClient();

  const [storeUrl, setStoreUrl] = useState("");
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedKeywords, setSelectedKeywords] = useState<Map<string, Set<string>>>(new Map());
  const [hasPreviewed, setHasPreviewed] = useState(false);

  const selectedCount = selectedIds.size;
  const allSelected =
    storeProducts.length > 0 && selectedCount === storeProducts.length;

  const selectedProducts = useMemo(
    () => storeProducts.filter((p) => selectedIds.has(p.naver_product_id)),
    [storeProducts, selectedIds]
  );

  const previewMutation = useMutation({
    mutationFn: (url: string) => productsApi.previewStoreProducts(userId!, url),
    onSuccess: (data) => {
      setHasPreviewed(true);
      setStoreProducts(data);
      setSelectedIds(new Set(data.map((p) => p.naver_product_id)));
      const kwMap = new Map<string, Set<string>>();
      data.forEach((p) => {
        kwMap.set(p.naver_product_id, new Set(p.suggested_keywords || []));
      });
      setSelectedKeywords(kwMap);
      if (data.length === 0) {
        toast.info("해당 스토어에서 상품을 찾을 수 없습니다");
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || "상품을 불러올 수 없습니다";
      toast.error(msg);
    },
  });

  const importMutation = useMutation({
    mutationFn: () =>
      productsApi.importStoreProducts(
        userId!,
        selectedProducts.map((p) => ({
          name: p.name,
          selling_price: p.price,
          image_url: p.image_url || undefined,
          category: p.category || undefined,
          keywords: Array.from(selectedKeywords.get(p.naver_product_id) || []),
        }))
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(
        `${result.created}개 등록${result.skipped > 0 ? `, ${result.skipped}개 중복 스킵` : ""}`
      );
      setStoreProducts([]);
      setSelectedIds(new Set());
      setSelectedKeywords(new Map());
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || "상품 등록에 실패했습니다";
      toast.error(msg);
    },
  });

  const toggleSelect = (id: string) => {
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
      setSelectedIds(new Set(storeProducts.map((p) => p.naver_product_id)));
    }
  };

  const toggleKeyword = (productId: string, keyword: string) => {
    setSelectedKeywords((prev) => {
      const next = new Map(prev);
      const kwSet = new Set(next.get(productId) || []);
      if (kwSet.has(keyword)) kwSet.delete(keyword);
      else kwSet.add(keyword);
      next.set(productId, kwSet);
      return next;
    });
  };

  const handlePreview = () => {
    if (!userId) {
      toast.error("사업체를 먼저 선택해주세요");
      return;
    }
    const url = storeUrl.trim();
    if (!url) return;
    previewMutation.mutate(url);
  };

  const handleImport = () => {
    if (selectedCount === 0) return;
    importMutation.mutate();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/settings"
          className="rounded-lg p-1.5 hover:bg-[var(--muted)] transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">상품 불러오기</h1>
      </div>

      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Download className="h-5 w-5 text-blue-500" />
          <h2 className="font-medium">스마트스토어 상품 불러오기</h2>
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">
          스토어 URL을 입력하면 판매 중인 상품을 미리보고 선택 등록할 수 있습니다.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            value={storeUrl}
            onChange={(e) => setStoreUrl(e.target.value)}
            placeholder="https://smartstore.naver.com/내스토어"
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
          />
          <button
            type="button"
            onClick={handlePreview}
            disabled={!storeUrl.trim() || previewMutation.isPending}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {previewMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            상품 불러오기
          </button>
        </div>
      </div>

      {storeProducts.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div className="text-sm font-medium">{storeProducts.length}개 상품 발견</div>
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
              전체 선택
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto divide-y divide-[var(--border)]">
            {storeProducts.map((p) => {
              const checked = selectedIds.has(p.naver_product_id);
              return (
                <div
                  key={p.naver_product_id}
                  className="px-4 py-3 hover:bg-[var(--muted)]/40 transition-colors"
                >
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelect(p.naver_product_id)}
                      className="h-4 w-4 rounded border-[var(--border)]"
                    />
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="h-10 w-10 rounded-md object-cover bg-[var(--muted)]"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--muted)]">
                        <Package className="h-4 w-4 text-[var(--muted-foreground)]" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="truncate text-xs text-[var(--muted-foreground)]">
                        {p.category}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-sm font-medium tabular-nums">
                      {formatPrice(p.price)}원
                    </div>
                  </label>

                  {checked && p.suggested_keywords.length > 0 && (
                    <div className="mt-2 ml-7 flex flex-wrap gap-1.5">
                      {p.suggested_keywords.map((kw) => {
                        const kwSelected =
                          selectedKeywords.get(p.naver_product_id)?.has(kw) ?? false;
                        return (
                          <button
                            key={kw}
                            type="button"
                            onClick={() => toggleKeyword(p.naver_product_id, kw)}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                              kwSelected
                                ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                                : "bg-[var(--muted)] text-[var(--muted-foreground)] border border-transparent"
                            )}
                          >
                            {kwSelected ? (
                              <CheckSquare className="h-3 w-3" />
                            ) : (
                              <Square className="h-3 w-3" />
                            )}
                            {kw}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="border-t border-[var(--border)] px-4 py-3">
            <button
              type="button"
              onClick={handleImport}
              disabled={selectedCount === 0 || importMutation.isPending}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              {importMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckSquare className="h-4 w-4" />
              )}
              선택한 {selectedCount}개 상품 등록
            </button>
          </div>
        </div>
      )}

      {hasPreviewed && !previewMutation.isPending && storeProducts.length === 0 && (
        <div className="glass-card p-5 text-center text-sm text-[var(--muted-foreground)]">
          해당 스토어에서 상품을 찾을 수 없습니다
        </div>
      )}
    </div>
  );
}
