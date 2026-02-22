"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Lock,
  Unlock,
  RefreshCw,
  Loader2,
  Trash2,
  RotateCcw,
  Ban,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { productsApi } from "@/lib/api/products";
import { costsApi } from "@/lib/api/costs";
import { keywordsApi } from "@/lib/api/keywords";
import { useUserStore } from "@/stores/useUserStore";
import { StatusBadge } from "@/components/products/StatusBadge";
import { PriceGap } from "@/components/products/PriceGap";
import { MarginDetail } from "@/components/products/MarginDetail";
import { KeywordRankingList } from "@/components/products/KeywordRankingList";
import { KeywordManager } from "@/components/products/KeywordManager";
import { SparklineChart } from "@/components/products/SparklineChart";
import { useCrawlProduct } from "@/lib/hooks/useCrawl";
import { formatPrice, timeAgo } from "@/lib/utils/format";
import type { ProductDetail, MarginDetail as MarginDetailType, SearchKeyword, ExcludedProduct } from "@/types";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const productId = Number(id);
  const router = useRouter();
  const userId = useUserStore((s) => s.currentUserId);
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isExcludedOpen, setIsExcludedOpen] = useState(false);
  const [editableName, setEditableName] = useState("");
  const [editableCostPrice, setEditableCostPrice] = useState("");

  // 상품 상세
  const { data: product, isLoading } = useQuery({
    queryKey: ["product-detail", userId, productId],
    queryFn: () => productsApi.getDetail(userId!, productId),
    enabled: !!userId,
  });

  // 키워드 목록
  const { data: keywords = [] } = useQuery({
    queryKey: ["keywords", productId],
    queryFn: () => keywordsApi.getList(productId),
    enabled: !!productId,
  });

  // 제외된 상품 목록
  const { data: excludedProducts = [] } = useQuery({
    queryKey: ["excluded-products", productId],
    queryFn: () => productsApi.getExcluded(productId),
    enabled: !!productId,
  });

  // 제외 복원
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

  // 상품 삭제
  const deleteMutation = useMutation({
    mutationFn: () => productsApi.delete(userId!, productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("상품이 삭제되었습니다");
      router.push("/products");
    },
    onError: () => toast.error("상품 삭제에 실패했습니다"),
  });

  const updateNameMutation = useMutation({
    mutationFn: (name: string) =>
      productsApi.update(userId!, productId, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("상품명이 수정되었습니다");
    },
    onError: () => toast.error("상품명 수정에 실패했습니다"),
  });

  const updateCostPriceMutation = useMutation({
    mutationFn: (cost_price: number) =>
      productsApi.update(userId!, productId, { cost_price }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("매입비용이 수정되었습니다");
    },
    onError: () => toast.error("매입비용 수정에 실패했습니다"),
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

  const handleSaveCostPrice = () => {
    const nextCostPrice = Number(editableCostPrice);
    if (!Number.isFinite(nextCostPrice) || nextCostPrice <= 0) return;
    if (nextCostPrice === product?.cost_price) return;
    updateCostPriceMutation.mutate(nextCostPrice);
  };

  useEffect(() => {
    if (!product) return;
    setEditableName(product.name ?? "");
    setEditableCostPrice(String(product.cost_price ?? ""));
  }, [product]);

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

  const firstRanking = product.keywords?.[0]?.rankings?.[0];
  const naverCategoryPath = [
    firstRanking?.category1,
    firstRanking?.category2,
    firstRanking?.category3,
    firstRanking?.category4,
  ]
    .filter(Boolean)
    .join(" > ");

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
          <div className="flex flex-col">
            {naverCategoryPath ? (
              <span className="text-sm text-[var(--muted-foreground)]">
                {naverCategoryPath}
              </span>
            ) : (
              product.category && (
                <span className="text-sm text-[var(--muted-foreground)]">
                  {product.category}
                </span>
              )
            )}
            {naverCategoryPath && product.category && product.category !== naverCategoryPath && (
              <span className="text-xs text-[var(--muted-foreground)]/80">
                내부 분류: {product.category}
              </span>
            )}
          </div>
        </div>
        <StatusBadge status={product.status} />
      </div>

      {/* 상품 기본 정보 */}
      <div className="glass-card p-4">
        <div className="mb-3">
          <h3 className="font-medium">상품 기본 정보</h3>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            상품명은 여기서 수정하고, 매입비용은 수익성 분석 영역에서 수정할 수 있습니다.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const nextName = editableName.trim();
            if (!nextName || nextName === product.name) return;
            updateNameMutation.mutate(nextName);
          }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <input
            type="text"
            value={editableName}
            onChange={(e) => setEditableName(e.target.value)}
            placeholder="상품명 입력"
            maxLength={200}
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
          />
          <button
            type="submit"
            disabled={
              updateNameMutation.isPending ||
              !editableName.trim() ||
              editableName.trim() === product.name
            }
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {updateNameMutation.isPending ? "저장 중..." : "상품명 저장"}
          </button>
        </form>
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
          {product.lowest_seller && (
            <div className="text-xs text-[var(--muted-foreground)]">
              {product.lowest_seller}
            </div>
          )}
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-sm text-[var(--muted-foreground)]">내 순위</div>
          <div className="text-lg font-bold mt-1 tabular-nums">
            {product.my_rank ? `${product.my_rank}위` : "-"}
          </div>
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
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {deleteMutation.isPending ? (
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

      {/* 수익성 분석 */}
      {product.margin && (
        <MarginDetail
          margin={product.margin}
          simulatedMargin={simulatedMargin}
          costPriceInput={editableCostPrice}
          setCostPriceInput={setEditableCostPrice}
          currentCostPrice={product.cost_price}
          isSavingCostPrice={updateCostPriceMutation.isPending}
          onSaveCostPrice={handleSaveCostPrice}
          simPrice={simPrice}
          setSimPrice={setSimPrice}
          currentSellingPrice={product.selling_price}
          isSimulating={simMutation.isPending}
          onSimulate={handleSimulate}
        />
      )}

      {/* 키워드 관리 */}
      <KeywordManager
        productId={productId}
        keywords={keywords}
      />

      {/* 키워드별 경쟁사 순위 */}
      <div>
        <h2 className="text-lg font-bold mb-3">키워드별 경쟁사 순위</h2>
        <KeywordRankingList
          keywords={product.keywords}
          myPrice={product.selling_price}
          productId={productId}
        />
      </div>

      {/* 제외된 상품 관리 */}
      {excludedProducts.length > 0 && (
        <div>
          <div className="glass-card overflow-hidden">
            <button
              type="button"
              onClick={() => setIsExcludedOpen((prev) => !prev)}
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
                className={`h-4 w-4 text-[var(--muted-foreground)] transition-transform ${isExcludedOpen ? "rotate-180" : ""}`}
              />
            </button>
            {isExcludedOpen && (
              <div className="divide-y divide-[var(--border)]">
                {excludedProducts.map((ep) => (
                  <div key={ep.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        {ep.mall_name && (
                          <span className="inline-flex items-center rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-500">
                            {ep.mall_name}
                          </span>
                        )}
                        <span className="text-[10px] text-[var(--muted-foreground)]">
                          제외 {timeAgo(ep.created_at)}
                        </span>
                      </div>
                      <div className="text-sm font-medium leading-snug break-words">
                        {ep.naver_product_name || "상품명 정보 없음"}
                      </div>
                      <div className="mt-1 text-xs text-[var(--muted-foreground)] font-mono break-all">
                        ID: {ep.naver_product_id}
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
        </div>
      )}
    </div>
  );
}
