"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  Loader2,
  Plus,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { productsApi } from "@/lib/api/products";
import { timeAgo } from "@/lib/utils/format";
import type { IncludedOverride } from "@/types";

interface IncludedOverridesSectionProps {
  productId: number;
}

export function IncludedOverridesSection({ productId }: IncludedOverridesSectionProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const { data: includedOverrides = [] } = useQuery({
    queryKey: ["included-overrides", productId],
    queryFn: () => productsApi.getIncludedOverrides(productId),
    enabled: !!productId,
  });

  const removeIncludedOverrideMutation = useMutation({
    mutationFn: (naverProductId: string) =>
      productsApi.removeIncludedOverride(productId, naverProductId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["included-overrides", productId] });
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      toast.success("수동 포함 예외를 해제했습니다");
    },
    onError: () => toast.error("수동 포함 예외 해제에 실패했습니다"),
  });

  return (
    <div>
      <div className="glass-card overflow-hidden">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="w-full px-4 py-3 flex items-center justify-between text-left"
        >
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Plus className="h-4 w-4" />
            수동 포함 예외
            <span className="text-sm font-normal text-[var(--muted-foreground)]">
              ({includedOverrides.length}개)
            </span>
          </h2>
          <ChevronDown
            className={`h-4 w-4 text-[var(--muted-foreground)] transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
        {isOpen && (
          <div className="divide-y divide-[var(--border)]">
            <div className="px-4 py-3">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]/50 px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
                자동 필터(가격 범위/모델코드/규격키워드)에서 제외된 항목을 예외적으로 다시 포함시킨 목록입니다.
                수동 블랙리스트(제외)보다 우선순위는 낮습니다.
              </div>
            </div>
            {includedOverrides.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
                등록된 수동 포함 예외가 없습니다
              </div>
            ) : (
              <div className="px-4 py-3 space-y-2">
                {includedOverrides.map((item: IncludedOverride) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 rounded-xl border border-blue-500/15 bg-blue-500/5 px-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        {item.mall_name && (
                          <span className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-500">
                            {item.mall_name}
                          </span>
                        )}
                        <span className="text-[10px] text-[var(--muted-foreground)]">
                          추가 {timeAgo(item.created_at)}
                        </span>
                      </div>
                      <div className="text-sm font-medium leading-snug break-words">
                        {item.naver_product_name || "상품명 정보 없음"}
                      </div>
                      <div className="mt-1 text-xs text-[var(--muted-foreground)] font-mono break-all">
                        ID: {item.naver_product_id}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeIncludedOverrideMutation.mutate(item.naver_product_id)}
                      disabled={removeIncludedOverrideMutation.isPending}
                      className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs transition-colors hover:bg-[var(--muted)] disabled:opacity-50"
                    >
                      {removeIncludedOverrideMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                      예외 해제
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
