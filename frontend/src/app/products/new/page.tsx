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
    spec_keywords: "",
    price_filter_min_pct: "",
    price_filter_max_pct: "",
  });

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
