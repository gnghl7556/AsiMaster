"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Lock, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { productsApi } from "@/lib/api/products";
import { keywordsApi } from "@/lib/api/keywords";
import { useUserStore } from "@/stores/useUserStore";
import { StatusBadge } from "@/components/products/StatusBadge";
import { KeywordRankingList } from "@/components/products/KeywordRankingList";
import { KeywordManager } from "@/components/products/KeywordManager";
import { CompetitorTotalSummary } from "@/components/products/CompetitorTotalSummary";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ProductBasicInfoSection, type BasicInfoSectionHandle } from "@/components/products/ProductBasicInfoSection";
import { ProductMetricsCards } from "@/components/products/ProductMetricsCards";
import { ProductActionBar } from "@/components/products/ProductActionBar";
import { ProductProfitabilitySection } from "@/components/products/ProductProfitabilitySection";
import { IncludedOverridesSection } from "@/components/products/IncludedOverridesSection";
import { ExcludedProductsSection } from "@/components/products/ExcludedProductsSection";
import { useCrawlProduct } from "@/lib/hooks/useCrawl";
import { parseSpecKeywordsInput } from "@/lib/utils/productMatching";

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
  const [highlightedAnchor, setHighlightedAnchor] = useState<"basic-info" | "profitability" | null>(
    null
  );

  // Ref to imperatively control BasicInfoSection from KeywordManager callbacks
  const basicInfoRef = useRef<BasicInfoSectionHandle>(null);

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

  // Hash anchor highlight
  useEffect(() => {
    if (typeof window === "undefined") return;
    let clearTimer: number | null = null;

    const syncHashHighlight = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash !== "basic-info" && hash !== "profitability") return;
      setHighlightedAnchor(hash);
      if (clearTimer) window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(() => {
        setHighlightedAnchor((prev) => (prev === hash ? null : prev));
      }, 1800);
    };

    syncHashHighlight();
    window.addEventListener("hashchange", syncHashHighlight);

    return () => {
      if (clearTimer) window.clearTimeout(clearTimer);
      window.removeEventListener("hashchange", syncHashHighlight);
    };
  }, []);

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
    <div className="max-w-4xl mx-auto space-y-6 isolate">
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
        <StatusBadge status={product.status} priceGap={product.price_gap} />
      </div>

      {/* 상품 기본 정보 */}
      <ProductBasicInfoSection
        ref={basicInfoRef}
        product={product}
        userId={userId!}
        productId={productId}
        highlightedAnchor={highlightedAnchor}
      />

      {/* 핵심 지표 카드 3개 */}
      <ProductMetricsCards product={product} />

      {/* 액션 바 */}
      <ProductActionBar
        product={product}
        onCrawl={() => crawlMutation.mutate(productId)}
        isCrawling={crawlMutation.isPending}
        onTogglePriceLock={() => lockMutation.mutate()}
        isTogglingLock={lockMutation.isPending}
        onDelete={() => setShowDeleteConfirm(true)}
      />

      {/* 삭제 확인 모달 */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setShowDeleteConfirm(false)}
        title="상품 삭제"
        message={
          <>
            <strong>{product.name}</strong>을(를) 삭제하시겠습니까?
            <br />
            등록된 키워드와 순위 데이터가 모두 삭제됩니다.
          </>
        }
        confirmText="삭제"
        variant="danger"
        isPending={deleteMutation.isPending}
        confirmIcon={<Trash2 className="h-4 w-4" />}
      />

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
      <ProductProfitabilitySection
        product={product}
        userId={userId!}
        productId={productId}
        highlightedAnchor={highlightedAnchor}
      />

      {/* 키워드 관리 */}
      <KeywordManager
        productId={productId}
        keywords={keywords}
        productName={product.name}
        categoryHint={product.category}
        onApplySuggestedCategory={(category) => {
          basicInfoRef.current?.setCategory(category);
        }}
        onApplySuggestedModelCode={(modelCode) => {
          basicInfoRef.current?.setModelCode(modelCode);
        }}
        onApplySuggestedSpecKeywords={(nextKeywords) => {
          basicInfoRef.current?.setSpecKeywords((prev) => {
            const merged = parseSpecKeywordsInput(
              [...parseSpecKeywordsInput(prev), ...nextKeywords].join(", ")
            );
            return merged.join(", ");
          });
        }}
      />

      {/* 가격 기준 경쟁 요약 (배송비 포함) */}
      <CompetitorTotalSummary
        competitors={product.competitors ?? []}
        keywords={product.keywords ?? []}
        myProductNaverId={product.naver_product_id}
      />

      {/* 키워드별 경쟁사 순위 */}
      <div className="relative z-0">
        <h2 className="text-lg font-bold mb-3">키워드별 경쟁사 순위</h2>
        <KeywordRankingList
          keywords={product.keywords}
          myPrice={product.selling_price}
          productId={productId}
          myProductNaverId={product.naver_product_id}
          productModelCode={product.model_code}
          productSpecKeywords={product.spec_keywords}
          priceFilterMinPct={product.price_filter_min_pct}
          priceFilterMaxPct={product.price_filter_max_pct}
        />
      </div>

      {/* 수동 포함 예외 */}
      <IncludedOverridesSection productId={productId} />

      {/* 제외된 상품 관리 (수동 블랙리스트) */}
      <ExcludedProductsSection productId={productId} />
    </div>
  );
}
