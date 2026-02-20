"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Lock,
  Unlock,
  RefreshCw,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { productsApi } from "@/lib/api/products";
import { costsApi } from "@/lib/api/costs";
import { useUserStore } from "@/stores/useUserStore";
import { StatusBadge } from "@/components/products/StatusBadge";
import { PriceGap } from "@/components/products/PriceGap";
import { MarginDetail } from "@/components/products/MarginDetail";
import { CompetitorRanking } from "@/components/products/CompetitorRanking";
import { SparklineChart } from "@/components/products/SparklineChart";
import { useCrawlProduct } from "@/lib/hooks/useCrawl";
import { formatPrice, timeAgo } from "@/lib/utils/format";
import type { ProductDetail, MarginDetail as MarginDetailType } from "@/types";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const productId = Number(id);
  const userId = useUserStore((s) => s.currentUserId);
  const queryClient = useQueryClient();

  // 상품 상세
  const { data: product, isLoading } = useQuery({
    queryKey: ["product-detail", userId, productId],
    queryFn: () => productsApi.getDetail(userId!, productId),
    enabled: !!userId,
  });

  // 크롤링
  const crawlMutation = useCrawlProduct();

  // 가격고정 토글
  const lockMutation = useMutation({
    mutationFn: () =>
      productsApi.togglePriceLock(userId!, productId, !product?.is_price_locked),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(product?.is_price_locked ? "가격고정 해제" : "가격고정 설정");
    },
  });

  // 마진 시뮬레이션
  const [simPrice, setSimPrice] = useState("");
  const [simulatedMargin, setSimulatedMargin] = useState<MarginDetailType | null>(null);

  const simMutation = useMutation({
    mutationFn: (price: number) => costsApi.simulateMargin(productId, price),
    onSuccess: (data) => setSimulatedMargin(data),
  });

  const handleSimulate = () => {
    const price = Number(simPrice);
    if (price > 0) simMutation.mutate(price);
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="skeleton h-10 w-48" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
        <div className="skeleton h-40" />
        <div className="skeleton h-60" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--muted-foreground)]">
        <p>상품을 찾을 수 없습니다</p>
        <Link href="/products" className="mt-2 text-blue-500 text-sm">
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link
          href="/products"
          className="rounded-lg p-1.5 hover:bg-[var(--muted)] transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{product.name}</h1>
          {product.category && (
            <span className="text-sm text-[var(--muted-foreground)]">
              {product.category}
            </span>
          )}
        </div>
        <StatusBadge status={product.status} />
      </div>

      {/* 핵심 지표 카드 3개 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-4 text-center">
          <div className="text-sm text-[var(--muted-foreground)]">내 가격</div>
          <div className="text-lg font-bold mt-1 tabular-nums">
            {formatPrice(product.selling_price)}
          </div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-sm text-[var(--muted-foreground)]">최저가</div>
          <div className="text-lg font-bold mt-1 tabular-nums">
            {formatPrice(product.lowest_price)}
          </div>
          {product.lowest_platform && (
            <div className="text-xs text-[var(--muted-foreground)]">
              {product.lowest_platform}
            </div>
          )}
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-sm text-[var(--muted-foreground)]">차이</div>
          <PriceGap
            gap={product.price_gap}
            gapPercent={product.price_gap_percent}
            status={product.status}
          />
        </div>
      </div>

      {/* 액션 바 */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => crawlMutation.mutate(productId)}
          disabled={crawlMutation.isPending}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--muted)] transition-colors"
        >
          {crawlMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          가격 새로고침
        </button>
        <button
          onClick={() => lockMutation.mutate()}
          disabled={lockMutation.isPending}
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
        {product.last_crawled_at && (
          <span className="flex items-center text-xs text-[var(--muted-foreground)] ml-auto">
            {timeAgo(product.last_crawled_at)}
          </span>
        )}
      </div>

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

      {/* 수익성 분석 */}
      {product.margin && (
        <MarginDetail
          margin={product.margin}
          simulatedMargin={simulatedMargin}
        />
      )}

      {/* 마진 시뮬레이션 */}
      <div className="glass-card p-4">
        <h3 className="font-medium mb-3">마진 시뮬레이션</h3>
        <p className="text-sm text-[var(--muted-foreground)] mb-3">
          판매가를 변경하면 예상 마진을 미리 확인할 수 있습니다
        </p>
        <div className="flex gap-2">
          <input
            type="number"
            value={simPrice}
            onChange={(e) => setSimPrice(e.target.value)}
            placeholder={`현재 ${formatPrice(product.selling_price)}원`}
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors tabular-nums"
          />
          <button
            onClick={handleSimulate}
            disabled={!simPrice || simMutation.isPending}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {simMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "계산"
            )}
          </button>
        </div>
      </div>

      {/* 경쟁사 순위 */}
      <CompetitorRanking
        competitors={product.competitors}
        myPrice={product.selling_price}
      />

      {/* 네이버 모니터링 안내 */}
      <div className="glass-card p-4">
        <h3 className="font-medium mb-2">네이버 최저가 모니터링</h3>
        <p className="text-sm text-[var(--muted-foreground)]">
          상품명으로 네이버 쇼핑 최저가를 자동 검색합니다. &quot;가격 새로고침&quot; 버튼을 눌러 최신 가격을 확인하세요.
        </p>
      </div>
    </div>
  );
}
