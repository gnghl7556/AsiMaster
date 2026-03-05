"use client";

import { Fragment, type ReactNode, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  ChevronDown,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { productsApi } from "@/lib/api/products";
import { cn } from "@/lib/utils/cn";
import { timeAgo } from "@/lib/utils/format";
import type { ExcludedProduct } from "@/types";

interface ExcludedProductsSectionProps {
  productId: number;
}

export function ExcludedProductsSection({ productId }: ExcludedProductsSectionProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingRestoreGroupName, setPendingRestoreGroupName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<"recent" | "name" | "count">("recent");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const { data: excludedProducts = [] } = useQuery({
    queryKey: ["excluded-products", productId],
    queryFn: () => productsApi.getExcluded(productId),
    enabled: !!productId,
  });

  const restoreMutation = useMutation({
    mutationFn: (naverProductId: string) =>
      productsApi.unexcludeProduct(productId, naverProductId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["excluded-products", productId] });
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      toast.success("제외가 해제되었습니다");
    },
    onError: () => toast.error("제외 해제에 실패했습니다"),
  });

  const restoreSellerGroupMutation = useMutation({
    mutationFn: async (params: { mallName: string; naverProductIds: string[] }) => {
      const uniqueIds = Array.from(new Set(params.naverProductIds));
      const results = await Promise.allSettled(
        uniqueIds.map((id) => productsApi.unexcludeProduct(productId, id))
      );
      const restored = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - restored;
      return { ...params, restored, failed, total: results.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["excluded-products", productId] });
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      if (result.failed === 0) {
        toast.success(`${result.mallName} 판매자 제외 ${result.restored}개를 복원했습니다`);
      } else {
        toast.success(
          `${result.mallName} 판매자 제외 복원: ${result.restored}개 성공, ${result.failed}개 실패`
        );
      }
    },
    onError: () => toast.error("판매자 단위 복원에 실패했습니다"),
    onSettled: () => setPendingRestoreGroupName(null),
  });

  // Group excluded products by mall name
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const excludedGroupBase = Object.values(
    excludedProducts.reduce<Record<string, { mallName: string; items: ExcludedProduct[] }>>(
      (acc, ep) => {
        const mallName = ep.mall_name?.trim() || "판매자 정보 없음";
        if (!acc[mallName]) {
          acc[mallName] = { mallName, items: [] };
        }
        acc[mallName].items.push(ep);
        return acc;
      },
      {}
    )
  ).map((group) => ({
    ...group,
    items: [...group.items].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    latestCreatedAt: [...group.items]
      .map((item) => item.created_at)
      .sort()
      .pop() ?? null,
  }));

  const excludedProductGroups = [...excludedGroupBase]
    .filter((group) => {
      if (!normalizedQuery) return true;
      if (group.mallName.toLowerCase().includes(normalizedQuery)) return true;
      return group.items.some((item) => {
        const name = item.naver_product_name?.toLowerCase() ?? "";
        return (
          name.includes(normalizedQuery) ||
          item.naver_product_id.toLowerCase().includes(normalizedQuery)
        );
      });
    })
    .sort((a, b) => {
      if (sortMode === "name") return a.mallName.localeCompare(b.mallName);
      if (sortMode === "count") {
        if (b.items.length !== a.items.length) return b.items.length - a.items.length;
        return a.mallName.localeCompare(b.mallName);
      }
      return (b.latestCreatedAt ?? "").localeCompare(a.latestCreatedAt ?? "");
    });

  const excludedVisibleCount = excludedProductGroups.reduce((sum, group) => sum + group.items.length, 0);

  const renderSearchHighlight = (text: string) => {
    if (!normalizedQuery) return text;
    const source = text ?? "";
    const lower = source.toLowerCase();
    if (!normalizedQuery || !lower.includes(normalizedQuery)) return source;

    const nodes: ReactNode[] = [];
    let start = 0;
    let key = 0;

    while (start < source.length) {
      const idx = lower.indexOf(normalizedQuery, start);
      if (idx === -1) {
        nodes.push(<Fragment key={`t-${key++}`}>{source.slice(start)}</Fragment>);
        break;
      }
      if (idx > start) {
        nodes.push(<Fragment key={`t-${key++}`}>{source.slice(start, idx)}</Fragment>);
      }
      nodes.push(
        <mark
          key={`m-${key++}`}
          className="rounded bg-amber-500/20 px-0.5 text-inherit dark:bg-amber-400/20"
        >
          {source.slice(idx, idx + normalizedQuery.length)}
        </mark>
      );
      start = idx + normalizedQuery.length;
    }

    return nodes;
  };

  const toggleGroupCollapsed = (mallName: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(mallName)) next.delete(mallName);
      else next.add(mallName);
      return next;
    });
  };

  return (
    <div>
      <div className="glass-card overflow-hidden">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="w-full px-4 py-3 flex items-center justify-between text-left"
        >
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Ban className="h-4 w-4" />
            제외된 상품
            <span className="text-sm font-normal text-[var(--muted-foreground)]">
              ({excludedProducts.length}개)
            </span>
          </h2>
          <ChevronDown
            className={`h-4 w-4 text-[var(--muted-foreground)] transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
        {isOpen && (
          <div className="divide-y divide-[var(--border)]">
            <div className="px-4 py-3 space-y-2">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]/50 px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
                이 영역은 <span className="font-medium text-[var(--foreground)]">수동 Ban(블랙리스트)</span>만 표시합니다.
                가격 범위/모델코드/규격 키워드로 자동 제외된 항목은 아래 &quot;키워드별 경쟁사 순위&quot;에서 흐리게 표시됩니다.
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="판매자명 / 상품명 / 상품코드 검색"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors sm:max-w-sm"
                />
                <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--muted)] p-0.5">
                  {(
                    [
                      { key: "recent", label: "최근 제외순" },
                      { key: "count", label: "개수순" },
                      { key: "name", label: "판매자명순" },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setSortMode(option.key)}
                      className={cn(
                        "rounded-md px-2 py-1 text-xs transition-colors",
                        sortMode === option.key
                          ? "bg-[var(--card)] text-blue-500 shadow-sm"
                          : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-[11px] text-[var(--muted-foreground)]">
                {excludedProductGroups.length}개 판매자 그룹 / {excludedVisibleCount}개 제외 상품 표시
              </div>
              {excludedProductGroups.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCollapsedGroups(new Set(excludedProductGroups.map((g) => g.mallName)))}
                    className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[11px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                  >
                    전체 접기
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollapsedGroups(new Set())}
                    className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[11px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                  >
                    전체 펼치기
                  </button>
                </div>
              )}
            </div>
            {excludedProductGroups.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
                검색 조건에 맞는 제외 상품이 없습니다
              </div>
            )}
            {excludedProductGroups.map((group) => (
              <div key={group.mallName} className="px-4 py-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleGroupCollapsed(group.mallName)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)] transition-transform",
                        collapsedGroups.has(group.mallName) && "-rotate-90"
                      )}
                    />
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-500">
                        {renderSearchHighlight(group.mallName)}
                      </span>
                      <span className="text-[11px] text-[var(--muted-foreground)]">
                        {group.items.length}개
                      </span>
                    </div>
                  </button>
                  {group.latestCreatedAt && (
                    <span className="text-[10px] text-[var(--muted-foreground)] shrink-0">
                      최근 제외 {timeAgo(group.latestCreatedAt)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setPendingRestoreGroupName(group.mallName);
                      restoreSellerGroupMutation.mutate({
                        mallName: group.mallName,
                        naverProductIds: group.items.map((item) => item.naver_product_id),
                      });
                    }}
                    disabled={restoreSellerGroupMutation.isPending || restoreMutation.isPending}
                    className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-[11px] hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
                  >
                    {restoreSellerGroupMutation.isPending &&
                    pendingRestoreGroupName === group.mallName ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3 w-3" />
                    )}
                    모두 복원
                  </button>
                </div>
                {!collapsedGroups.has(group.mallName) && (
                  <div className="space-y-2">
                    {group.items.map((ep) => (
                      <div
                        key={ep.id}
                        className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)]/50 px-3 py-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className="text-[10px] text-[var(--muted-foreground)]">
                              제외 {timeAgo(ep.created_at)}
                            </span>
                          </div>
                          <div className="text-sm font-medium leading-snug break-words">
                            {ep.naver_product_name
                              ? renderSearchHighlight(ep.naver_product_name)
                              : "상품명 정보 없음"}
                          </div>
                          <div className="mt-1 text-xs text-[var(--muted-foreground)] font-mono break-all">
                            ID: {renderSearchHighlight(ep.naver_product_id)}
                          </div>
                        </div>
                        <button
                          onClick={() => restoreMutation.mutate(ep.naver_product_id)}
                          disabled={restoreMutation.isPending}
                          className="mt-0.5 flex items-center gap-1 shrink-0 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs hover:bg-[var(--muted)] transition-colors"
                        >
                          {restoreMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3 w-3" />
                          )}
                          복원
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
