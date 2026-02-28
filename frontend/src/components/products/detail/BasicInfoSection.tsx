"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  Hash,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { productsApi } from "@/lib/api/products";
import { NaverCategoryCascader } from "@/components/products/NaverCategoryCascader";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/format";
import { parseSpecKeywordsInput } from "@/lib/utils/productMatching";
import { useUserStore } from "@/stores/useUserStore";
import type { ProductDetail } from "@/types";

interface BasicInfoSectionProps {
  product: ProductDetail;
  productId: number;
  highlightedAnchor: "basic-info" | "profitability" | null;
  onApplySuggestedCategory?: (category: string) => void;
  onApplySuggestedModelCode?: (modelCode: string) => void;
  onApplySuggestedSpecKeywords?: (keywords: string[]) => void;
  editableCategory: string;
  setEditableCategory: (value: string) => void;
  editableModelCode: string;
  setEditableModelCode: (value: string) => void;
  editableSpecKeywords: string;
  setEditableSpecKeywords: (value: string | ((prev: string) => string)) => void;
}

export function BasicInfoSection({
  product,
  productId,
  highlightedAnchor,
  editableCategory,
  setEditableCategory,
  editableModelCode,
  setEditableModelCode,
  editableSpecKeywords,
  setEditableSpecKeywords,
}: BasicInfoSectionProps) {
  const userId = useUserStore((s) => s.currentUserId);
  const queryClient = useQueryClient();

  const [isBasicInfoOpen, setIsBasicInfoOpen] = useState(false);
  const [isProductAttributesOpen, setIsProductAttributesOpen] = useState(false);
  const [isTrackingSettingsOpen, setIsTrackingSettingsOpen] = useState(false);

  const [editableName, setEditableName] = useState("");
  const [editableBrand, setEditableBrand] = useState("");
  const [editableMaker, setEditableMaker] = useState("");
  const [editableSeries, setEditableSeries] = useState("");
  const [editableCapacity, setEditableCapacity] = useState("");
  const [editableColor, setEditableColor] = useState("");
  const [editableMaterial, setEditableMaterial] = useState("");
  const [editableProductAttributes, setEditableProductAttributes] = useState<
    Array<{ key: string; value: string }>
  >([{ key: "", value: "" }]);
  const [editableNaverProductId, setEditableNaverProductId] = useState("");
  const [editablePriceFilterMinPct, setEditablePriceFilterMinPct] = useState("");
  const [editablePriceFilterMaxPct, setEditablePriceFilterMaxPct] = useState("");

  // Sync product data to editable state
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
    setEditableNaverProductId(product.naver_product_id ?? "");
    setEditableModelCode(product.model_code ?? "");
    setEditableSpecKeywords((product.spec_keywords ?? []).join(", "));
    setEditablePriceFilterMinPct(
      product.price_filter_min_pct == null ? "" : String(product.price_filter_min_pct)
    );
    setEditablePriceFilterMaxPct(
      product.price_filter_max_pct == null ? "" : String(product.price_filter_max_pct)
    );
  }, [product, setEditableCategory, setEditableModelCode, setEditableSpecKeywords]);

  // Open section when highlighted
  useEffect(() => {
    if (highlightedAnchor === "basic-info") {
      setIsBasicInfoOpen(true);
    }
  }, [highlightedAnchor]);

  // Mutations
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

  // Computed values
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

  const basicInfoAttributeSummary = [
    product.brand && `브랜드 ${product.brand}`,
    product.model_code && `모델 ${product.model_code}`,
    product.series && `시리즈 ${product.series}`,
    product.capacity && `규격 ${product.capacity}`,
  ].filter(Boolean) as string[];

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

  const handleSaveTrackingFields = () => {
    const normalizedNaverProductId = editableNaverProductId.trim() || null;
    const normalizedModelCode = editableModelCode.trim() || null;
    const normalizedSpecKeywords = parseSpecKeywordsInput(editableSpecKeywords);
    const normalizedMinPctVal = editablePriceFilterMinPct.trim()
      ? Number(editablePriceFilterMinPct)
      : null;
    const normalizedMaxPctVal = editablePriceFilterMaxPct.trim()
      ? Number(editablePriceFilterMaxPct)
      : null;

    if (normalizedMinPctVal != null) {
      if (!Number.isFinite(normalizedMinPctVal) || normalizedMinPctVal < 0 || normalizedMinPctVal > 100) {
        toast.error("최소 비율은 0~100 사이로 입력해주세요");
        return;
      }
    }
    if (normalizedMaxPctVal != null) {
      if (!Number.isFinite(normalizedMaxPctVal) || normalizedMaxPctVal < 100) {
        toast.error("최대 비율은 100 이상으로 입력해주세요");
        return;
      }
    }
    if (
      normalizedMinPctVal != null &&
      normalizedMaxPctVal != null &&
      normalizedMinPctVal > normalizedMaxPctVal
    ) {
      toast.error("최소 비율은 최대 비율보다 클 수 없습니다");
      return;
    }

    updateTrackingFieldsMutation.mutate({
      naver_product_id: normalizedNaverProductId,
      model_code: normalizedModelCode,
      spec_keywords: normalizedSpecKeywords.length > 0 ? normalizedSpecKeywords : null,
      price_filter_min_pct: normalizedMinPctVal,
      price_filter_max_pct: normalizedMaxPctVal,
    });
  };

  return (
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
  );
}
