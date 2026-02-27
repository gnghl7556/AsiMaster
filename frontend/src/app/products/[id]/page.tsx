"use client";

import { Fragment, type ReactNode, use, useEffect, useState } from "react";
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
    Plus,
    Hash,
    Tag,
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
import { NaverCategoryCascader } from "@/components/products/NaverCategoryCascader";
import { CompetitorTotalSummary } from "@/components/products/CompetitorTotalSummary";
import { useCrawlProduct } from "@/lib/hooks/useCrawl";
import { formatPrice, timeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { parseSpecKeywordsInput } from "@/lib/utils/productMatching";
import type { CostItemInput, ProductCostItem } from "@/lib/api/costs";
import type {
  ProductDetail,
  MarginDetail as MarginDetailType,
  SearchKeyword,
  ExcludedProduct,
  IncludedOverride,
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
  const [isExcludedOpen, setIsExcludedOpen] = useState(false);
  const [isIncludedOverridesOpen, setIsIncludedOverridesOpen] = useState(false);
  const [isBasicInfoOpen, setIsBasicInfoOpen] = useState(false);
  const [isProductAttributesOpen, setIsProductAttributesOpen] = useState(false);
  const [isTrackingSettingsOpen, setIsTrackingSettingsOpen] = useState(false);
  const [editableName, setEditableName] = useState("");
  const [editableCategory, setEditableCategory] = useState("");
  const [editableBrand, setEditableBrand] = useState("");
  const [editableMaker, setEditableMaker] = useState("");
  const [editableSeries, setEditableSeries] = useState("");
  const [editableCapacity, setEditableCapacity] = useState("");
  const [editableColor, setEditableColor] = useState("");
  const [editableMaterial, setEditableMaterial] = useState("");
  const [editableProductAttributes, setEditableProductAttributes] = useState<
    Array<{ key: string; value: string }>
  >([{ key: "", value: "" }]);
  const [editableCostPrice, setEditableCostPrice] = useState("");
  const [editableNaverProductId, setEditableNaverProductId] = useState("");
  const [editableModelCode, setEditableModelCode] = useState("");
  const [editableSpecKeywords, setEditableSpecKeywords] = useState("");
  const [editablePriceFilterMinPct, setEditablePriceFilterMinPct] = useState("");
  const [editablePriceFilterMaxPct, setEditablePriceFilterMaxPct] = useState("");
  const [editableCostItems, setEditableCostItems] = useState<CostItemInput[]>([
    { name: "", type: "percent", value: 0 },
  ]);
  const [selectedCostPresetId, setSelectedCostPresetId] = useState<number | null>(null);
  const [pendingRestoreGroupName, setPendingRestoreGroupName] = useState<string | null>(null);
  const [excludedGroupQuery, setExcludedGroupQuery] = useState("");
  const [excludedGroupSort, setExcludedGroupSort] = useState<"recent" | "name" | "count">(
    "recent"
  );
  const [collapsedExcludedGroups, setCollapsedExcludedGroups] = useState<Set<string>>(new Set());
  const [highlightedAnchor, setHighlightedAnchor] = useState<"basic-info" | "profitability" | null>(
    null
  );

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

  const updateBasicInfoMutation = useMutation({
    mutationFn: (data: {
      name: string;
      category: string | null;
      brand: string | null;
      maker: string | null;
      series: string | null;
      capacity: string | null;
      color: string | null;
      material: string | null;
      product_attributes: Record<string, string> | null;
    }) =>
      productsApi.update(userId!, productId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("상품 기본 정보가 수정되었습니다");
    },
    onError: () => toast.error("상품 기본 정보 수정에 실패했습니다"),
  });

  const updateTrackingFieldsMutation = useMutation({
    mutationFn: (data: {
      naver_product_id: string | null;
      model_code: string | null;
      spec_keywords: string[] | null;
      price_filter_min_pct: number | null;
      price_filter_max_pct: number | null;
    }) => productsApi.update(userId!, productId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("정확도 설정이 저장되었습니다");
    },
    onError: () => toast.error("정확도 설정 저장에 실패했습니다"),
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

  const handleSaveTrackingFields = () => {
    const normalizedNaverProductId = editableNaverProductId.trim() || null;
    const normalizedModelCode = editableModelCode.trim() || null;
    const normalizedSpecKeywords = parseSpecKeywordsInput(editableSpecKeywords);
    const normalizedMinPct = editablePriceFilterMinPct.trim()
      ? Number(editablePriceFilterMinPct)
      : null;
    const normalizedMaxPct = editablePriceFilterMaxPct.trim()
      ? Number(editablePriceFilterMaxPct)
      : null;

    if (normalizedMinPct != null) {
      if (!Number.isFinite(normalizedMinPct) || normalizedMinPct < 0 || normalizedMinPct > 100) {
        toast.error("최소 비율은 0~100 사이로 입력해주세요");
        return;
      }
    }
    if (normalizedMaxPct != null) {
      if (!Number.isFinite(normalizedMaxPct) || normalizedMaxPct < 100) {
        toast.error("최대 비율은 100 이상으로 입력해주세요");
        return;
      }
    }
    if (
      normalizedMinPct != null &&
      normalizedMaxPct != null &&
      normalizedMinPct > normalizedMaxPct
    ) {
      toast.error("최소 비율은 최대 비율보다 클 수 없습니다");
      return;
    }

    updateTrackingFieldsMutation.mutate({
      naver_product_id: normalizedNaverProductId,
      model_code: normalizedModelCode,
      spec_keywords: normalizedSpecKeywords.length > 0 ? normalizedSpecKeywords : null,
      price_filter_min_pct: normalizedMinPct,
      price_filter_max_pct: normalizedMaxPct,
    });
  };

  useEffect(() => {
    if (!product) return;
    setEditableName(product.name ?? "");
    setEditableCategory(product.category ?? "");
    setEditableBrand(product.brand ?? "");
    setEditableMaker(product.maker ?? "");
    setEditableSeries(product.series ?? "");
    setEditableCapacity(product.capacity ?? "");
    setEditableColor(product.color ?? "");
    setEditableMaterial(product.material ?? "");
    const nextAttrs = Object.entries(product.product_attributes ?? {}).map(([key, value]) => ({
      key,
      value,
    }));
    setEditableProductAttributes(nextAttrs.length > 0 ? nextAttrs : [{ key: "", value: "" }]);
    setEditableCostPrice(String(product.cost_price ?? ""));
    setEditableNaverProductId(product.naver_product_id ?? "");
    setEditableModelCode(product.model_code ?? "");
    setEditableSpecKeywords((product.spec_keywords ?? []).join(", "));
    setEditablePriceFilterMinPct(
      product.price_filter_min_pct == null ? "" : String(product.price_filter_min_pct)
    );
    setEditablePriceFilterMaxPct(
      product.price_filter_max_pct == null ? "" : String(product.price_filter_max_pct)
    );
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

  useEffect(() => {
    if (highlightedAnchor === "basic-info") {
      setIsBasicInfoOpen(true);
    }
  }, [highlightedAnchor]);

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
  const currentSpecKeywordsString = (product.spec_keywords ?? []).join(", ");
  const parsedEditedSpecKeywords = parseSpecKeywordsInput(editableSpecKeywords);
  const normalizedEditedSpecKeywordsString = parsedEditedSpecKeywords.join(", ");
  const normalizedEditedProductAttributesEntries = editableProductAttributes
    .map((row) => ({ key: row.key.trim(), value: row.value.trim() }))
    .filter((row) => row.key && row.value);
  const normalizedEditedProductAttributes =
    normalizedEditedProductAttributesEntries.length > 0
      ? Object.fromEntries(normalizedEditedProductAttributesEntries.map((row) => [row.key, row.value]))
      : null;
  const normalizedCurrentProductAttributes = product.product_attributes ?? null;
  const normalizedEditedMinPct =
    editablePriceFilterMinPct.trim() === "" ? null : Number(editablePriceFilterMinPct);
  const normalizedEditedMaxPct =
    editablePriceFilterMaxPct.trim() === "" ? null : Number(editablePriceFilterMaxPct);
  const isTrackingFieldsChanged =
    editableNaverProductId.trim() !== (product.naver_product_id ?? "") ||
    editableModelCode.trim() !== (product.model_code ?? "") ||
    normalizedEditedSpecKeywordsString !== currentSpecKeywordsString ||
    normalizedEditedMinPct !== (product.price_filter_min_pct ?? null) ||
    normalizedEditedMaxPct !== (product.price_filter_max_pct ?? null);
  const isCategoryChanged = editableCategory.trim() !== (product.category ?? "");
  const isProductAttributesChanged =
    editableBrand.trim() !== (product.brand ?? "") ||
    editableMaker.trim() !== (product.maker ?? "") ||
    editableSeries.trim() !== (product.series ?? "") ||
    editableCapacity.trim() !== (product.capacity ?? "") ||
    editableColor.trim() !== (product.color ?? "") ||
    editableMaterial.trim() !== (product.material ?? "") ||
    JSON.stringify(normalizedEditedProductAttributes) !==
      JSON.stringify(normalizedCurrentProductAttributes);
  const isBasicInfoChanged =
    editableName.trim() !== product.name ||
    isCategoryChanged ||
    isProductAttributesChanged;
  const isExposureTopButPriceLosing = product.my_rank === 1 && product.status === "losing";
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
  const normalizedExcludedGroupQuery = excludedGroupQuery.trim().toLowerCase();
  const excludedProductGroups = [...excludedGroupBase]
    .filter((group) => {
      if (!normalizedExcludedGroupQuery) return true;
      if (group.mallName.toLowerCase().includes(normalizedExcludedGroupQuery)) return true;
      return group.items.some((item) => {
        const name = item.naver_product_name?.toLowerCase() ?? "";
        return (
          name.includes(normalizedExcludedGroupQuery) ||
          item.naver_product_id.toLowerCase().includes(normalizedExcludedGroupQuery)
        );
      });
    })
    .sort((a, b) => {
      if (excludedGroupSort === "name") return a.mallName.localeCompare(b.mallName);
      if (excludedGroupSort === "count") {
        if (b.items.length !== a.items.length) return b.items.length - a.items.length;
        return a.mallName.localeCompare(b.mallName);
      }
      return (b.latestCreatedAt ?? "").localeCompare(a.latestCreatedAt ?? "");
    });
  const excludedVisibleCount = excludedProductGroups.reduce((sum, group) => sum + group.items.length, 0);

  const renderExcludedSearchHighlight = (text: string) => {
    if (!normalizedExcludedGroupQuery) return text;
    const source = text ?? "";
    const lower = source.toLowerCase();
    const query = normalizedExcludedGroupQuery;
    if (!query || !lower.includes(query)) return source;

    const nodes: ReactNode[] = [];
    let start = 0;
    let key = 0;

    while (start < source.length) {
      const idx = lower.indexOf(query, start);
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
          {source.slice(idx, idx + query.length)}
        </mark>
      );
      start = idx + query.length;
    }

    return nodes;
  };

  const toggleExcludedGroupCollapsed = (mallName: string) => {
    setCollapsedExcludedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(mallName)) next.delete(mallName);
      else next.add(mallName);
      return next;
    });
  };
  const priceFilterRangePreview = {
    minPct: Number.isFinite(normalizedEditedMinPct as number)
      ? normalizedEditedMinPct
      : null,
    maxPct: Number.isFinite(normalizedEditedMaxPct as number)
      ? normalizedEditedMaxPct
      : null,
  };
  const minPricePreview =
    priceFilterRangePreview.minPct == null
      ? null
      : Math.round((product.selling_price * priceFilterRangePreview.minPct) / 100);
  const maxPricePreview =
    priceFilterRangePreview.maxPct == null
      ? null
      : Math.round((product.selling_price * priceFilterRangePreview.maxPct) / 100);
  const basicInfoAttributeSummary = [
    product.brand && `브랜드 ${product.brand}`,
    product.model_code && `모델 ${product.model_code}`,
    product.series && `시리즈 ${product.series}`,
    product.capacity && `규격 ${product.capacity}`,
  ].filter(Boolean) as string[];
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
      <div
        id="basic-info"
        className={cn(
          "glass-card scroll-mt-24 p-4 transition-shadow",
          highlightedAnchor === "basic-info" &&
            "ring-2 ring-blue-500/40 shadow-[0_0_0_4px_rgba(59,130,246,0.08)]"
        )}
      >
        <button
          type="button"
          onClick={() => setIsBasicInfoOpen((prev) => !prev)}
          className="mb-3 flex w-full items-start justify-between gap-3 text-left"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium">상품 기본 정보</h3>
              {isBasicInfoChanged && (
                <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500">
                  저장 필요
                </span>
              )}
              {isCategoryChanged && (
                <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
                  카테고리 변경됨
                </span>
              )}
              {isTrackingFieldsChanged && (
                <span className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-500">
                  정확도 설정 변경
                </span>
              )}
            </div>
            <div className="mt-1 space-y-0.5">
              <div className="truncate text-sm font-medium">{product.name}</div>
              <div className="truncate text-xs text-[var(--muted-foreground)]">
                {product.category || "카테고리 미설정"} · 상세 편집/검색 정확도 설정
              </div>
              {basicInfoAttributeSummary.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {basicInfoAttributeSummary.slice(0, 4).map((label) => (
                    <span
                      key={label}
                      className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-1.5 py-0.5 text-[10px] text-[var(--muted-foreground)]"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <ChevronDown
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform",
              isBasicInfoOpen && "rotate-180"
            )}
          />
        </button>

        {isBasicInfoOpen && (
          <>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const nextName = editableName.trim();
            if (!nextName) return;
            if (!isBasicInfoChanged) return;
            updateBasicInfoMutation.mutate({
              name: nextName,
              category: editableCategory.trim() || null,
              brand: editableBrand.trim() || null,
              maker: editableMaker.trim() || null,
              series: editableSeries.trim() || null,
              capacity: editableCapacity.trim() || null,
              color: editableColor.trim() || null,
              material: editableMaterial.trim() || null,
              product_attributes: normalizedEditedProductAttributes,
            });
          }}
          className="space-y-2"
        >
          <input
            type="text"
            value={editableName}
            onChange={(e) => setEditableName(e.target.value)}
            placeholder="상품명 입력"
            maxLength={200}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
          />
          <NaverCategoryCascader
            value={editableCategory}
            onChange={setEditableCategory}
            helperText="선택하면 아래 카테고리 입력값에 자동 반영됩니다"
          />
          <input
            type="text"
            value={editableCategory}
            onChange={(e) => setEditableCategory(e.target.value)}
            placeholder="카테고리 입력 (예: 생활/건강/생활용품)"
            className={cn(
              "w-full rounded-lg border bg-[var(--card)] px-3 py-2 text-sm outline-none transition-colors",
              isCategoryChanged
                ? "border-amber-500/50 focus:border-amber-500"
                : "border-[var(--border)] focus:border-blue-500"
            )}
          />
          {isCategoryChanged && (
            <div className="text-[11px] text-amber-500">
              변경된 카테고리는 아직 저장되지 않았습니다. `기본 정보 저장`을 눌러 반영하세요.
            </div>
          )}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/70">
            <button
              type="button"
              onClick={() => setIsProductAttributesOpen((prev) => !prev)}
              className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-medium">제품 속성</div>
                  {isProductAttributesChanged && (
                    <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500">
                      변경됨
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                  브랜드/제조사/시리즈/규격/색상/소재 및 추가 속성
                </div>
              </div>
              <ChevronDown
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform",
                  isProductAttributesOpen && "rotate-180"
                )}
              />
            </button>

            {isProductAttributesOpen && (
              <div className="border-t border-[var(--border)] px-3 pb-3 pt-3 space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      ["brand", "브랜드", editableBrand, setEditableBrand],
                      ["maker", "제조사", editableMaker, setEditableMaker],
                      ["series", "시리즈", editableSeries, setEditableSeries],
                      ["capacity", "용량/규격", editableCapacity, setEditableCapacity],
                      ["color", "색상", editableColor, setEditableColor],
                      ["material", "소재", editableMaterial, setEditableMaterial],
                    ] as const
                  ).map(([key, label, value, setter]) => (
                    <div key={key}>
                      <label className="mb-1 block text-xs text-[var(--muted-foreground)]">{label}</label>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => setter(e.target.value)}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
                        placeholder={`${label} 입력`}
                      />
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-medium">추가 속성 (Key / Value)</div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditableProductAttributes((prev) => [...prev, { key: "", value: "" }])
                      }
                      className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      속성 추가
                    </button>
                  </div>
                  <div className="space-y-2">
                    {editableProductAttributes.map((row, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          value={row.key}
                          onChange={(e) =>
                            setEditableProductAttributes((prev) =>
                              prev.map((item, i) =>
                                i === index ? { ...item, key: e.target.value } : item
                              )
                            )
                          }
                          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-sm outline-none focus:border-blue-500"
                          placeholder="속성명"
                        />
                        <input
                          value={row.value}
                          onChange={(e) =>
                            setEditableProductAttributes((prev) =>
                              prev.map((item, i) =>
                                i === index ? { ...item, value: e.target.value } : item
                              )
                            )
                          }
                          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-sm outline-none focus:border-blue-500"
                          placeholder="값"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setEditableProductAttributes((prev) =>
                              prev.length > 1 ? prev.filter((_, i) => i !== index) : prev
                            )
                          }
                          className="shrink-0 rounded p-1 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={
                updateBasicInfoMutation.isPending ||
                !editableName.trim() ||
                !isBasicInfoChanged
              }
              className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {updateBasicInfoMutation.isPending ? "저장 중..." : "기본 정보 저장"}
            </button>
          </div>
        </form>

        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-3">
          <button
            type="button"
            onClick={() => setIsTrackingSettingsOpen((prev) => !prev)}
            className="flex w-full items-start justify-between gap-3 text-left"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-medium">검색 정확도 설정</h4>
                {isTrackingFieldsChanged && (
                  <span className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-500">
                    저장 필요
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                모델코드/규격 키워드/가격 범위 필터를 접어서 관리할 수 있습니다.
              </p>
            </div>
            <ChevronDown
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform",
                isTrackingSettingsOpen && "rotate-180"
              )}
            />
          </button>

          {isTrackingSettingsOpen && (
            <>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-[var(--muted-foreground)]">
                    <span className="inline-flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      네이버 상품번호
                    </span>
                  </label>
                  <input
                    type="text"
                    value={editableNaverProductId}
                    onChange={(e) => setEditableNaverProductId(e.target.value)}
                    placeholder="예: 87265928596"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--muted-foreground)]">
                    <span className="inline-flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      모델코드
                    </span>
                  </label>
                  <input
                    type="text"
                    value={editableModelCode}
                    onChange={(e) => setEditableModelCode(e.target.value)}
                    placeholder="예: RF85B9121AP"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
              <div className="mt-2">
                <label className="mb-1 block text-xs text-[var(--muted-foreground)]">
                  규격 키워드 (쉼표 구분)
                </label>
                <input
                  type="text"
                  value={editableSpecKeywords}
                  onChange={(e) => setEditableSpecKeywords(e.target.value)}
                  placeholder="예: 43035, 중형, 200매"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
                />
                {parsedEditedSpecKeywords.length > 0 && (
                  <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--card)]/70 p-2">
                    <div className="mb-1 text-[11px] text-[var(--muted-foreground)]">
                      적용 예정 필터 ({parsedEditedSpecKeywords.length}개)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {parsedEditedSpecKeywords.map((kw) => (
                        <span
                          key={kw}
                          className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--card)]/70 p-3">
                <div className="mb-1.5 text-xs font-medium">가격 범위 필터</div>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {(
                    [
                      { label: "표준 30~200%", min: "30", max: "200" },
                      { label: "엄격 50~150%", min: "50", max: "150" },
                      { label: "넓게 20~300%", min: "20", max: "300" },
                      { label: "해제", min: "", max: "" },
                    ] as const
                  ).map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setEditablePriceFilterMinPct(preset.min);
                        setEditablePriceFilterMaxPct(preset.max);
                      }}
                      className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[11px] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-[var(--muted-foreground)]">
                      최소 비율 (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={editablePriceFilterMinPct}
                        onChange={(e) => setEditablePriceFilterMinPct(e.target.value)}
                        placeholder="예: 30"
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 pr-7 text-sm outline-none focus:border-blue-500 transition-colors"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted-foreground)]">
                        %
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-[var(--muted-foreground)]">
                      최대 비율 (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={100}
                        value={editablePriceFilterMaxPct}
                        onChange={(e) => setEditablePriceFilterMaxPct(e.target.value)}
                        placeholder="예: 200"
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 pr-7 text-sm outline-none focus:border-blue-500 transition-colors"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted-foreground)]">
                        %
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-[var(--muted-foreground)]">
                  규격이 다른 상품(낱개/대용량)을 자동으로 제외합니다.
                </div>
                {(minPricePreview != null || maxPricePreview != null) && (
                  <div className="mt-1 text-xs text-[var(--foreground)]">
                    판매가 {formatPrice(product.selling_price)}원 기준:{" "}
                    {minPricePreview != null ? `${formatPrice(minPricePreview)}원` : "제한 없음"} ~{" "}
                    {maxPricePreview != null ? `${formatPrice(maxPricePreview)}원` : "제한 없음"}
                  </div>
                )}
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveTrackingFields}
                  disabled={updateTrackingFieldsMutation.isPending || !isTrackingFieldsChanged}
                  className={cn(
                    "rounded-lg border bg-[var(--card)] px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50",
                    isTrackingFieldsChanged
                      ? "border-blue-500/30 text-blue-500 hover:bg-blue-500/5"
                      : "border-[var(--border)] hover:bg-[var(--muted)]"
                  )}
                >
                  {updateTrackingFieldsMutation.isPending ? "저장 중..." : "정확도 설정 저장"}
                </button>
              </div>
            </>
          )}
        </div>
          </>
        )}
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
          <div className="text-sm text-[var(--muted-foreground)]">최저 총액</div>
          <div className="text-lg font-bold mt-1 tabular-nums">
            {formatPrice(product.lowest_price)}
          </div>
          <div className="text-[10px] text-[var(--muted-foreground)]">
            배송비 포함
          </div>
          {product.lowest_seller && (
            <div className="text-xs text-[var(--muted-foreground)]">
              {product.lowest_seller}
            </div>
          )}
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-sm text-[var(--muted-foreground)]">노출 순위</div>
          <div className="text-lg font-bold mt-1 tabular-nums">
            {product.my_rank ? `노출 ${product.my_rank}위` : "-"}
          </div>
          {product.rank_change != null && (
            <div
              className={cn(
                "mt-1 text-xs",
                product.rank_change > 0
                  ? "text-red-500"
                  : product.rank_change < 0
                  ? "text-emerald-500"
                  : "text-[var(--muted-foreground)]"
              )}
            >
              {product.rank_change > 0
                ? `노출 하락 ${product.rank_change}`
                : product.rank_change < 0
                ? `노출 상승 ${Math.abs(product.rank_change)}`
                : "노출 변동 없음"}
            </div>
          )}
          {isExposureTopButPriceLosing && (
            <div className="mt-1 text-[11px] text-amber-500">
              노출 상단이지만 가격 기준으로는 밀림
            </div>
          )}
        </div>
      </div>

      {/* 액션 바 */}
      <div className="sticky top-0 z-30 -mx-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-1 py-2 isolate">
        <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => crawlMutation.mutate(productId)}
          disabled={crawlMutation.isPending}
          className="flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-1.5 text-sm text-blue-500 hover:bg-blue-500/10 transition-colors"
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

      {/* 제외된 상품 관리 (수동 블랙리스트) */}
      <div>
        <div className="glass-card overflow-hidden">
          <button
            type="button"
            onClick={() => setIsIncludedOverridesOpen((prev) => !prev)}
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
              className={`h-4 w-4 text-[var(--muted-foreground)] transition-transform ${isIncludedOverridesOpen ? "rotate-180" : ""}`}
            />
          </button>
          {isIncludedOverridesOpen && (
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

      {/* 제외된 상품 관리 (수동 블랙리스트) */}
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
                <div className="px-4 py-3 space-y-2">
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]/50 px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
                    이 영역은 <span className="font-medium text-[var(--foreground)]">수동 Ban(블랙리스트)</span>만 표시합니다.
                    가격 범위/모델코드/규격 키워드로 자동 제외된 항목은 아래 &quot;키워드별 경쟁사 순위&quot;에서 흐리게 표시됩니다.
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <input
                      type="text"
                      value={excludedGroupQuery}
                      onChange={(e) => setExcludedGroupQuery(e.target.value)}
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
                          onClick={() => setExcludedGroupSort(option.key)}
                          className={cn(
                            "rounded-md px-2 py-1 text-xs transition-colors",
                            excludedGroupSort === option.key
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
                        onClick={() => setCollapsedExcludedGroups(new Set(excludedProductGroups.map((g) => g.mallName)))}
                        className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[11px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                      >
                        전체 접기
                      </button>
                      <button
                        type="button"
                        onClick={() => setCollapsedExcludedGroups(new Set())}
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
                        onClick={() => toggleExcludedGroupCollapsed(group.mallName)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)] transition-transform",
                            collapsedExcludedGroups.has(group.mallName) && "-rotate-90"
                          )}
                        />
                        <div className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-500">
                          {renderExcludedSearchHighlight(group.mallName)}
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
                    {!collapsedExcludedGroups.has(group.mallName) && (
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
                                ? renderExcludedSearchHighlight(ep.naver_product_name)
                                : "상품명 정보 없음"}
                            </div>
                            <div className="mt-1 text-xs text-[var(--muted-foreground)] font-mono break-all">
                              ID: {renderExcludedSearchHighlight(ep.naver_product_id)}
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
    </div>
  );
}
