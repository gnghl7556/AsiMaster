"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Package,
  Tag,
  Wallet,
  BadgeDollarSign,
  Image,
  Search,
  TrendingUp,
  Loader2,
  Hash,
  ChevronDown,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { productsApi } from "@/lib/api/products";
import { useUserStore } from "@/stores/useUserStore";
import { formatPrice } from "@/lib/utils/format";
import { NaverCategoryCascader } from "@/components/products/NaverCategoryCascader";
import { parseSpecKeywordsInput } from "@/lib/utils/productMatching";

export default function NewProductPage() {
  const router = useRouter();
  const userId = useUserStore((s) => s.currentUserId);
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: "",
    category: "",
    cost_price: "",
    selling_price: "",
    image_url: "",
    naver_product_id: "",
    model_code: "",
    brand: "",
    maker: "",
    series: "",
    capacity: "",
    color: "",
    material: "",
    spec_keywords: "",
    price_filter_min_pct: "",
    price_filter_max_pct: "",
  });
  const [productAttributeRows, setProductAttributeRows] = useState<Array<{ key: string; value: string }>>([
    { key: "", value: "" },
  ]);
  const [isProductAttributesOpen, setIsProductAttributesOpen] = useState(false);

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const mutation = useMutation({
    mutationFn: () =>
      productsApi.create(userId!, {
        name: form.name,
        category: form.category || undefined,
        cost_price: Number(form.cost_price),
        selling_price: Number(form.selling_price),
        image_url: form.image_url || undefined,
        naver_product_id: form.naver_product_id.trim() || undefined,
        model_code: form.model_code.trim() || undefined,
        brand: form.brand.trim() || null,
        maker: form.maker.trim() || null,
        series: form.series.trim() || null,
        capacity: form.capacity.trim() || null,
        color: form.color.trim() || null,
        material: form.material.trim() || null,
        product_attributes: normalizedProductAttributes,
        spec_keywords: parsedSpecKeywords.length > 0 ? parsedSpecKeywords : undefined,
        price_filter_min_pct: normalizedPriceFilterMinPct,
        price_filter_max_pct: normalizedPriceFilterMaxPct,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("상품이 등록되었습니다");
      router.push("/products");
    },
    onError: () => toast.error("상품 등록에 실패했습니다"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, cost_price: true, selling_price: true });
    if (!form.name || !form.cost_price || !form.selling_price) {
      toast.error("필수 항목을 입력해주세요");
      return;
    }
    if (
      normalizedPriceFilterMinPct != null &&
      (!Number.isFinite(normalizedPriceFilterMinPct) ||
        normalizedPriceFilterMinPct < 0 ||
        normalizedPriceFilterMinPct > 100)
    ) {
      toast.error("최소 비율은 0~100 사이로 입력해주세요");
      return;
    }
    if (
      normalizedPriceFilterMaxPct != null &&
      (!Number.isFinite(normalizedPriceFilterMaxPct) || normalizedPriceFilterMaxPct < 100)
    ) {
      toast.error("최대 비율은 100 이상으로 입력해주세요");
      return;
    }
    if (
      normalizedPriceFilterMinPct != null &&
      normalizedPriceFilterMaxPct != null &&
      normalizedPriceFilterMinPct > normalizedPriceFilterMaxPct
    ) {
      toast.error("최소 비율은 최대 비율보다 클 수 없습니다");
      return;
    }
    mutation.mutate();
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  // 마진 계산
  const cost = Number(form.cost_price) || 0;
  const sell = Number(form.selling_price) || 0;
  const margin = sell - cost;
  const marginPercent = sell > 0 ? (margin / sell) * 100 : 0;
  const showMargin = cost > 0 && sell > 0;
  const parsedSpecKeywords = parseSpecKeywordsInput(form.spec_keywords);
  const normalizedPriceFilterMinPct =
    form.price_filter_min_pct.trim() === "" ? null : Number(form.price_filter_min_pct);
  const normalizedPriceFilterMaxPct =
    form.price_filter_max_pct.trim() === "" ? null : Number(form.price_filter_max_pct);
  const normalizedProductAttributesEntries = productAttributeRows
    .map((row) => ({ key: row.key.trim(), value: row.value.trim() }))
    .filter((row) => row.key && row.value);
  const normalizedProductAttributes =
    normalizedProductAttributesEntries.length > 0
      ? Object.fromEntries(normalizedProductAttributesEntries.map((row) => [row.key, row.value]))
      : null;
  const minPriceFilterPreview =
    normalizedPriceFilterMinPct == null
      ? null
      : Math.round((sell * normalizedPriceFilterMinPct) / 100);
  const maxPriceFilterPreview =
    normalizedPriceFilterMaxPct == null
      ? null
      : Math.round((sell * normalizedPriceFilterMaxPct) / 100);

  const isFieldError = (field: string) =>
    touched[field] && !form[field as keyof typeof form];

  const inputClass = (field: string) =>
    `w-full rounded-xl border bg-[var(--card)] px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-[var(--muted-foreground)]/50 ${
      isFieldError(field)
        ? "border-red-400 dark:border-red-500/60"
        : "border-[var(--border)] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
    }`;

  return (
    <div className="max-w-xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/products"
          className="rounded-lg p-1.5 hover:bg-[var(--muted)] transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">상품 등록</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            등록된 상품의 네이버 쇼핑 경쟁가격을 모니터링합니다
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 기본 정보 */}
        <div className="glass-card p-5 space-y-4 relative z-10">
          <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider flex items-center gap-2">
            <Package className="h-4 w-4" />
            기본 정보
          </h2>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              상품명 <span className="text-red-400">*</span>
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onBlur={() => handleBlur("name")}
              className={inputClass("name")}
              placeholder="네이버 쇼핑에서 검색될 상품명 (예: 삼성 갤럭시 버즈3 프로)"
            />
            {isFieldError("name") && (
              <p className="mt-1 text-xs text-red-400">상품명을 입력해주세요</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                <span className="flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                  네이버 상품번호
                </span>
              </label>
              <input
                value={form.naver_product_id}
                onChange={(e) => setForm({ ...form, naver_product_id: e.target.value })}
                className={inputClass("")}
                placeholder="예: 87265928596"
                inputMode="numeric"
              />
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                있으면 내 상품 매칭 정확도가 올라갑니다
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                <span className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                  모델코드
                </span>
              </label>
              <input
                value={form.model_code}
                onChange={(e) => setForm({ ...form, model_code: e.target.value })}
                className={inputClass("")}
                placeholder="예: RF85B9121AP"
              />
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                관련 상품 필터링의 핵심 기준
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              <span className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                규격 키워드 (선택)
              </span>
            </label>
            <input
              value={form.spec_keywords}
              onChange={(e) => setForm({ ...form, spec_keywords: e.target.value })}
              className={inputClass("")}
              placeholder="예: 43035, 중형, 200매"
            />
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              쉼표로 구분 입력. 크롤링 시 제목에 모두 포함된 상품만 관련 상품으로 판단합니다.
            </p>
            {parsedSpecKeywords.length > 0 && (
              <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-2">
                <div className="mb-1 text-[11px] text-[var(--muted-foreground)]">
                  저장 시 적용될 규격 키워드 ({parsedSpecKeywords.length}개)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {parsedSpecKeywords.map((kw) => (
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

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/70 p-3">
            <div className="mb-1.5 text-sm font-medium">가격 범위 필터 (선택)</div>
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
                  onClick={() =>
                    setForm({
                      ...form,
                      price_filter_min_pct: preset.min,
                      price_filter_max_pct: preset.max,
                    })
                  }
                  className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[11px] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[var(--muted-foreground)]">
                  최소 비율 (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.price_filter_min_pct}
                    onChange={(e) =>
                      setForm({ ...form, price_filter_min_pct: e.target.value })
                    }
                    className={inputClass("") + " pr-7"}
                    placeholder="예: 30"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted-foreground)]">
                    %
                  </span>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--muted-foreground)]">
                  최대 비율 (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={100}
                    value={form.price_filter_max_pct}
                    onChange={(e) =>
                      setForm({ ...form, price_filter_max_pct: e.target.value })
                    }
                    className={inputClass("") + " pr-7"}
                    placeholder="예: 200"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted-foreground)]">
                    %
                  </span>
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              규격이 다른 상품(낱개/대용량)을 자동으로 제외합니다.
            </p>
            {sell > 0 && (minPriceFilterPreview != null || maxPriceFilterPreview != null) && (
              <p className="mt-1 text-xs text-[var(--foreground)]">
                판매가 {formatPrice(sell)}원 기준:{" "}
                {minPriceFilterPreview != null ? `${formatPrice(minPriceFilterPreview)}원` : "제한 없음"} ~{" "}
                {maxPriceFilterPreview != null ? `${formatPrice(maxPriceFilterPreview)}원` : "제한 없음"}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              <span className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                카테고리
              </span>
            </label>

            <div className="mb-2">
              <NaverCategoryCascader
                value={form.category}
                onChange={(next) => setForm({ ...form, category: next })}
                helperText="선택하거나 아래에 직접 입력할 수 있습니다"
              />
            </div>
            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className={inputClass("")}
              placeholder="카테고리 직접 입력 (예: 생활/건강/생활용품)"
            />
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/70">
            <button
              type="button"
              onClick={() => setIsProductAttributesOpen((prev) => !prev)}
              className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">제품 속성 (선택)</div>
                <div className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                  브랜드/제조사/시리즈/규격 등 구조화 속성을 저장합니다
                </div>
              </div>
              <ChevronDown
                className={`mt-0.5 h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform ${
                  isProductAttributesOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isProductAttributesOpen && (
              <div className="border-t border-[var(--border)] px-3 pb-3 pt-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["brand", "브랜드", "예: 유한킴벌리"],
                      ["maker", "제조사", "예: 유한킴벌리"],
                      ["series", "시리즈", "예: 크리넥스"],
                      ["capacity", "용량/규격", "예: 41117 / 200매"],
                      ["color", "색상", "예: 화이트"],
                      ["material", "소재", "예: 펄프"],
                    ] as const
                  ).map(([field, label, placeholder]) => (
                    <div key={field}>
                      <label className="mb-1 block text-xs text-[var(--muted-foreground)]">{label}</label>
                      <input
                        value={form[field]}
                        onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                        className={inputClass("")}
                        placeholder={placeholder}
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
                        setProductAttributeRows((prev) => [...prev, { key: "", value: "" }])
                      }
                      className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      속성 추가
                    </button>
                  </div>
                  <div className="space-y-2">
                    {productAttributeRows.map((row, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          value={row.key}
                          onChange={(e) =>
                            setProductAttributeRows((prev) =>
                              prev.map((item, i) =>
                                i === index ? { ...item, key: e.target.value } : item
                              )
                            )
                          }
                          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-sm outline-none focus:border-blue-500"
                          placeholder="속성명 (예: 폭)"
                        />
                        <input
                          value={row.value}
                          onChange={(e) =>
                            setProductAttributeRows((prev) =>
                              prev.map((item, i) =>
                                i === index ? { ...item, value: e.target.value } : item
                              )
                            )
                          }
                          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-sm outline-none focus:border-blue-500"
                          placeholder="값 (예: 220mm)"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setProductAttributeRows((prev) =>
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
        </div>

        {/* 가격 정보 */}
        <div className="glass-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider flex items-center gap-2">
            <BadgeDollarSign className="h-4 w-4" />
            가격 정보
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                  매입가 <span className="text-red-400">*</span>
                </span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={form.cost_price}
                  onChange={(e) =>
                    setForm({ ...form, cost_price: e.target.value })
                  }
                  onBlur={() => handleBlur("cost_price")}
                  className={`${inputClass("cost_price")} pr-8 tabular-nums`}
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted-foreground)]">
                  원
                </span>
              </div>
              {form.cost_price && (
                <p className="mt-1 text-xs text-[var(--muted-foreground)] tabular-nums">
                  {formatPrice(Number(form.cost_price))}원
                </p>
              )}
              {isFieldError("cost_price") && (
                <p className="mt-1 text-xs text-red-400">
                  매입가를 입력해주세요
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                <span className="flex items-center gap-1.5">
                  <BadgeDollarSign className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                  판매가 <span className="text-red-400">*</span>
                </span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={form.selling_price}
                  onChange={(e) =>
                    setForm({ ...form, selling_price: e.target.value })
                  }
                  onBlur={() => handleBlur("selling_price")}
                  className={`${inputClass("selling_price")} pr-8 tabular-nums`}
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted-foreground)]">
                  원
                </span>
              </div>
              {form.selling_price && (
                <p className="mt-1 text-xs text-[var(--muted-foreground)] tabular-nums">
                  {formatPrice(Number(form.selling_price))}원
                </p>
              )}
              {isFieldError("selling_price") && (
                <p className="mt-1 text-xs text-red-400">
                  판매가를 입력해주세요
                </p>
              )}
            </div>
          </div>

          {/* 마진 미리보기 */}
          {showMargin && (
            <div
              className={`rounded-xl p-3.5 flex items-center justify-between ${
                margin > 0
                  ? "bg-emerald-500/10 border border-emerald-500/20"
                  : margin < 0
                    ? "bg-red-500/10 border border-red-500/20"
                    : "bg-[var(--muted)] border border-[var(--border)]"
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp
                  className={`h-4 w-4 ${
                    margin > 0
                      ? "text-emerald-500"
                      : margin < 0
                        ? "text-red-500"
                        : "text-[var(--muted-foreground)]"
                  }`}
                />
                <span className="text-sm font-medium">예상 마진</span>
              </div>
              <div className="text-right">
                <span
                  className={`text-base font-bold tabular-nums ${
                    margin > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : margin < 0
                        ? "text-red-600 dark:text-red-400"
                        : ""
                  }`}
                >
                  {margin > 0 ? "+" : ""}
                  {formatPrice(margin)}원
                </span>
                <span
                  className={`ml-2 text-sm tabular-nums ${
                    margin > 0
                      ? "text-emerald-500"
                      : margin < 0
                        ? "text-red-500"
                        : "text-[var(--muted-foreground)]"
                  }`}
                >
                  ({marginPercent.toFixed(1)}%)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 이미지 */}
        <div className="glass-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider flex items-center gap-2">
            <Image className="h-4 w-4" />
            상품 이미지
          </h2>
          <div>
            <label className="block text-sm font-medium mb-1.5">
              이미지 URL
            </label>
            <input
              value={form.image_url}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              className={inputClass("")}
              placeholder="https://example.com/product.jpg"
            />
          </div>
          {form.image_url && (
            <div className="rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--muted)]">
              <img
                src={form.image_url}
                alt="미리보기"
                className="w-full h-40 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
        </div>

        {/* 키워드 안내 */}
        <div className="glass-card p-5">
          <div className="flex gap-3">
            <div className="shrink-0 mt-0.5">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Search className="h-4 w-4 text-blue-500" />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-1">
                자동 키워드 모니터링
              </h3>
              <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                상품명이 기본 검색 키워드로 자동 등록되어 네이버 쇼핑 상위 10개
                경쟁사 순위를 모니터링합니다. 추가 키워드는 상품 상세에서 등록할
                수 있습니다.
              </p>
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3 pt-1 pb-8">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 rounded-xl border border-[var(--border)] py-3 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 rounded-xl bg-blue-500 py-3 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-blue-500/25 flex items-center justify-center gap-2"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                등록 중...
              </>
            ) : (
              <>
                <Package className="h-4 w-4" />
                상품 등록
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
