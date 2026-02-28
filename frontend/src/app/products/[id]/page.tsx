"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { productsApi } from "@/lib/api/products";
import { costsApi } from "@/lib/api/costs";
import { keywordsApi } from "@/lib/api/keywords";
import { useUserStore } from "@/stores/useUserStore";
import { StatusBadge } from "@/components/products/StatusBadge";
import { MarginDetail } from "@/components/products/MarginDetail";
import { KeywordRankingList } from "@/components/products/KeywordRankingList";
import { KeywordManager } from "@/components/products/KeywordManager";
import { CompetitorTotalSummary } from "@/components/products/CompetitorTotalSummary";
import { useCrawlProduct } from "@/lib/hooks/useCrawl";
import { cn } from "@/lib/utils/cn";
import { parseSpecKeywordsInput } from "@/lib/utils/productMatching";
import { BasicInfoSection } from "@/components/products/detail/BasicInfoSection";
import { ProductMetricsCards } from "@/components/products/detail/ProductMetricsCards";
import { ProductActionBar } from "@/components/products/detail/ProductActionBar";
import { IncludedOverridesSection } from "@/components/products/detail/IncludedOverridesSection";
import { ExcludedProductsSection } from "@/components/products/detail/ExcludedProductsSection";
import type { CostItemInput, ProductCostItem } from "@/lib/api/costs";
import type {
  MarginDetail as MarginDetailType,
} from "@/types";

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
  const [editableCategory, setEditableCategory] = useState("");
  const [editableModelCode, setEditableModelCode] = useState("");
  const [editableSpecKeywords, setEditableSpecKeywords] = useState("");
  const [editableCostPrice, setEditableCostPrice] = useState("");
  const [editableCostItems, setEditableCostItems] = useState<CostItemInput[]>([
    { name: "", type: "percent", value: 0 },
  ]);
  const [selectedCostPresetId, setSelectedCostPresetId] = useState<number | null>(null);
  const [pendingRestoreGroupName, setPendingRestoreGroupName] = useState<string | null>(null);
  const [highlightedAnchor, setHighlightedAnchor] = useState<"basic-info" | "profitability" | null>(
    null
  );

  // 마진 시뮬레이션
  const [simPrice, setSimPrice] = useState("");
  const [simulatedMargin, setSimulatedMargin] = useState<MarginDetailType | null>(null);

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
  const { data: includedOverrides = [] } = useQuery({
    queryKey: ["included-overrides", productId],
    queryFn: () => productsApi.getIncludedOverrides(productId),
    enabled: !!productId,
  });

  const { data: costPresets = [] } = useQuery({
    queryKey: ["cost-presets", userId],
    queryFn: () => costsApi.getPresets(userId!),
    enabled: !!userId,
  });

  const { data: costItems = [] } = useQuery({
    queryKey: ["product-cost-items", productId],
    queryFn: () => costsApi.getItems(userId!, productId),
    enabled: !!userId && !!productId,
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
  const removeIncludedOverrideMutation = useMutation({
    mutationFn: (naverProductId: string) => productsApi.removeIncludedOverride(productId, naverProductId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["included-overrides", productId] });
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      toast.success("수동 포함 예외를 해제했습니다");
    },
    onError: () => toast.error("수동 포함 예외 해제에 실패했습니다"),
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

  const saveCostItemsMutation = useMutation({
    mutationFn: (items: CostItemInput[]) => costsApi.saveItems(userId!, productId, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-cost-items", productId] });
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      toast.success("비용 항목이 저장되었습니다");
    },
    onError: () => toast.error("비용 항목 저장에 실패했습니다"),
  });
  const applyCostPresetMutation = useMutation({
    mutationFn: (presetId: number) => costsApi.applyPreset(presetId, [productId]),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["product-cost-items", productId] });
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setSelectedCostPresetId(null);
      toast.success(
        result.applied > 0
          ? `프리셋 적용 완료${result.skipped > 0 ? ` (${result.skipped}개 스킵${result.skipped_reason ? `: ${result.skipped_reason}` : ""})` : ""}`
          : `적용되지 않았습니다${result.skipped_reason ? `: ${result.skipped_reason}` : ""}`
      );
    },
    onError: () => toast.error("프리셋 적용에 실패했습니다"),
  });
  const detachCostPresetMutation = useMutation({
    mutationFn: (presetId: number) => costsApi.detachPreset(presetId, [productId]),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["product-cost-items", productId] });
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(result.detached > 0 ? "프리셋을 해제했습니다" : "해제할 프리셋 항목이 없습니다");
    },
    onError: () => toast.error("프리셋 해제에 실패했습니다"),
  });

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

  // Sync cost price from product
  useEffect(() => {
    if (!product) return;
    setEditableCostPrice(String(product.cost_price ?? ""));
  }, [product]);

  useEffect(() => {
    const mapped: CostItemInput[] = costItems
      .filter((item) => item.source_preset_id == null)
      .map((item) => ({
        name: item.name ?? "",
        type: (item.type === "fixed" ? "fixed" : "percent") as "fixed" | "percent",
        value: Number(item.value ?? 0),
      }));
    setEditableCostItems(mapped.length > 0 ? mapped : [{ name: "", type: "percent", value: 0 }]);
  }, [costItems]);

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

  const normalizedFetchedCostItems = costItems
    .filter((item) => item.source_preset_id == null)
    .map((item) => ({
      name: item.name.trim(),
      type: item.type === "fixed" ? "fixed" : "percent",
      value: Number(item.value ?? 0),
    }));
  const normalizedEditableCostItems = editableCostItems
    .map((item) => ({
      name: item.name.trim(),
      type: item.type,
      value: Number(item.value ?? 0),
    }))
    .filter((item) => item.name.length > 0);
  const costItemsDirty =
    JSON.stringify(normalizedEditableCostItems) !== JSON.stringify(normalizedFetchedCostItems);

  const currentCostPresetNames = (product.cost_preset_ids ?? [])
    .map((id) => costPresets.find((preset) => preset.id === id)?.name)
    .filter(Boolean) as string[];
  const presetCostItems = costItems.filter(
    (item) => item.source_preset_id != null
  ) as ProductCostItem[];

  const handleApplyCostPreset = () => {
    if (!selectedCostPresetId) return;
    if ((product.cost_preset_ids ?? []).includes(selectedCostPresetId)) {
      toast.info("이미 적용된 프리셋입니다");
      return;
    }
    applyCostPresetMutation.mutate(selectedCostPresetId);
  };

  const handleSaveCostItems = () => {
    if (!normalizedEditableCostItems.length) {
      toast.error("최소 1개 이상의 비용 항목을 입력해주세요");
      return;
    }
    saveCostItemsMutation.mutate(normalizedEditableCostItems);
  };

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
      <BasicInfoSection
        product={product}
        productId={productId}
        highlightedAnchor={highlightedAnchor}
        editableCategory={editableCategory}
        setEditableCategory={setEditableCategory}
        editableModelCode={editableModelCode}
        setEditableModelCode={setEditableModelCode}
        editableSpecKeywords={editableSpecKeywords}
        setEditableSpecKeywords={setEditableSpecKeywords}
      />

      {/* 핵심 지표 카드 3개 */}
      <ProductMetricsCards
        sellingPrice={product.selling_price}
        lowestPrice={product.lowest_price}
        lowestSeller={product.lowest_seller}
        myRank={product.my_rank}
        rankChange={product.rank_change}
        status={product.status}
      />

      {/* 액션 바 + 삭제 모달 + 가격고정 알림 */}
      <ProductActionBar
        product={product}
        onCrawl={() => crawlMutation.mutate(productId)}
        isCrawling={crawlMutation.isPending}
        onToggleLock={() => lockMutation.mutate()}
        isLocking={lockMutation.isPending}
        onDelete={() => deleteMutation.mutate()}
        isDeleting={deleteMutation.isPending}
        showDeleteConfirm={showDeleteConfirm}
        setShowDeleteConfirm={setShowDeleteConfirm}
      />

      {/* 수익성 분석 */}
      {product.margin && (
        <div
          id="profitability"
          className={cn(
            "scroll-mt-24 rounded-2xl transition-shadow",
            highlightedAnchor === "profitability" &&
              "ring-2 ring-emerald-500/30 shadow-[0_0_0_4px_rgba(16,185,129,0.07)]"
          )}
        >
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
            costItemsEditor={editableCostItems}
            onChangeCostItem={(index, updated) =>
              setEditableCostItems((prev) => prev.map((item, i) => (i === index ? updated : item)))
            }
            onAddCostItem={() =>
              setEditableCostItems((prev) => [...prev, { name: "", type: "percent", value: 0 }])
            }
            onRemoveCostItem={(index) =>
              setEditableCostItems((prev) =>
                prev.length > 1 ? prev.filter((_, i) => i !== index) : prev
              )
            }
            onSaveCostItems={handleSaveCostItems}
            isSavingCostItems={saveCostItemsMutation.isPending}
            costItemsDirty={costItemsDirty}
            costPresets={costPresets}
            selectedCostPresetId={selectedCostPresetId}
            setSelectedCostPresetId={setSelectedCostPresetId}
            onApplyCostPreset={handleApplyCostPreset}
            isApplyingCostPreset={applyCostPresetMutation.isPending}
            appliedCostPresetIds={product.cost_preset_ids ?? []}
            currentCostPresetNames={currentCostPresetNames}
            presetCostItems={presetCostItems}
            onDetachCostPreset={(presetId) => detachCostPresetMutation.mutate(presetId)}
            detachingPresetId={detachCostPresetMutation.isPending ? (detachCostPresetMutation.variables ?? null) : null}
          />
        </div>
      )}

      {/* 키워드 관리 */}
      <KeywordManager
        productId={productId}
        keywords={keywords}
        productName={product.name}
        categoryHint={product.category}
        onApplySuggestedCategory={(category) => setEditableCategory(category)}
        onApplySuggestedModelCode={(modelCode) => setEditableModelCode(modelCode)}
        onApplySuggestedSpecKeywords={(nextKeywords) => {
          setEditableSpecKeywords((prev) => {
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
          productModelCode={product.model_code}
          productSpecKeywords={product.spec_keywords}
          priceFilterMinPct={product.price_filter_min_pct}
          priceFilterMaxPct={product.price_filter_max_pct}
        />
      </div>

      {/* 수동 포함 예외 */}
      <IncludedOverridesSection
        includedOverrides={includedOverrides}
        onRemove={(naverProductId) => removeIncludedOverrideMutation.mutate(naverProductId)}
        isRemoving={removeIncludedOverrideMutation.isPending}
      />

      {/* 제외된 상품 관리 (수동 블랙리스트) */}
      <ExcludedProductsSection
        excludedProducts={excludedProducts}
        productId={productId}
        onRestore={(naverProductId) => restoreMutation.mutate(naverProductId)}
        isRestoring={restoreMutation.isPending}
        onRestoreGroup={(mallName, naverProductIds) =>
          restoreSellerGroupMutation.mutate({ mallName, naverProductIds })
        }
        isRestoringGroup={restoreSellerGroupMutation.isPending}
        pendingGroupName={pendingRestoreGroupName}
        setPendingGroupName={setPendingRestoreGroupName}
      />
    </div>
  );
}
