"use client";

import { ExternalLink, Crown, Store, Ban, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { KeywordDetail } from "@/types";
import { productsApi } from "@/lib/api/products";
import { formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

interface Props {
  keywords: KeywordDetail[];
  myPrice: number;
  productId: number;
}

export function KeywordRankingList({ keywords, myPrice, productId }: Props) {
  const queryClient = useQueryClient();

  const excludeMutation = useMutation({
    mutationFn: (item: { naver_product_id: string; product_name: string }) =>
      productsApi.excludeProduct(productId, {
        naver_product_id: item.naver_product_id,
        naver_product_name: item.product_name,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      queryClient.invalidateQueries({ queryKey: ["excluded-products", productId] });
      toast.success("경쟁사가 제외되었습니다");
    },
    onError: () => toast.error("제외에 실패했습니다"),
  });
  if (keywords.length === 0) {
    return (
      <div className="glass-card p-8 text-center text-sm text-[var(--muted-foreground)]">
        등록된 키워드가 없습니다
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {keywords.map((kw) => (
        <div key={kw.id} className="glass-card overflow-hidden">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">&ldquo;{kw.keyword}&rdquo;</h3>
              {kw.is_primary && (
                <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-500">
                  기본
                </span>
              )}
            </div>
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded",
                kw.crawl_status === "success"
                  ? "bg-emerald-500/10 text-emerald-500"
                  : kw.crawl_status === "failed"
                  ? "bg-red-500/10 text-red-500"
                  : "bg-gray-500/10 text-gray-500"
              )}
            >
              {kw.crawl_status === "success"
                ? "검색 완료"
                : kw.crawl_status === "failed"
                ? "검색 실패"
                : "대기 중"}
            </span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {kw.rankings.length === 0 ? (
              <div className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                검색 결과가 없습니다. &quot;가격 새로고침&quot;을 눌러 검색하세요.
              </div>
            ) : (
              kw.rankings.map((item) => {
                const diffFromMe = item.price - myPrice;
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3",
                      item.is_my_store && "bg-blue-500/5",
                      !item.is_relevant && "opacity-50"
                    )}
                  >
                    {/* 순위 */}
                    <div
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        item.rank === 1
                          ? "bg-yellow-500 text-white"
                          : item.is_my_store
                          ? "bg-blue-500 text-white"
                          : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                      )}
                    >
                      {item.rank}
                    </div>

                    {/* 판매자 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">
                          {item.mall_name || "알 수 없음"}
                        </span>
                        {item.is_my_store && (
                          <span className="shrink-0 flex items-center gap-0.5 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-500">
                            <Store className="h-2.5 w-2.5" />
                            내 스토어
                          </span>
                        )}
                        {item.rank === 1 && (
                          <Crown className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                        )}
                      </div>
                      <div className="text-xs text-[var(--muted-foreground)] truncate">
                        {item.product_name}
                      </div>
                    </div>

                    {/* 가격 */}
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold tabular-nums">
                        {formatPrice(item.price)}원
                      </div>
                      <div
                        className={cn(
                          "text-xs tabular-nums",
                          diffFromMe < 0
                            ? "text-red-500"
                            : diffFromMe > 0
                            ? "text-emerald-500"
                            : "text-[var(--muted-foreground)]"
                        )}
                      >
                        {diffFromMe === 0
                          ? "동일"
                          : diffFromMe < 0
                          ? `${formatPrice(diffFromMe)}원`
                          : `+${formatPrice(diffFromMe)}원`}
                      </div>
                    </div>

                    {/* 링크 */}
                    {item.product_url && (
                      <a
                        href={item.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}

                    {/* 제외 버튼 */}
                    {!item.is_my_store && item.naver_product_id && (
                      <button
                        onClick={() =>
                          excludeMutation.mutate({
                            naver_product_id: item.naver_product_id!,
                            product_name: item.product_name,
                          })
                        }
                        disabled={excludeMutation.isPending}
                        className="shrink-0 rounded p-1 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-500 transition-colors"
                        title="이 상품 제외"
                      >
                        {excludeMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Ban className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
