"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  ChevronDown,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { productsApi } from "@/lib/api/products";
import { useUserStore } from "@/stores/useUserStore";
import { useProductList } from "@/lib/hooks/useProducts";
import { formatPrice } from "@/lib/utils/format";

const PRESET_CATEGORIES = [
  "전자기기",
  "패션/의류",
  "뷰티/화장품",
  "식품",
  "생활/주방",
  "스포츠/레저",
  "유아/아동",
  "반려동물",
  "가구/인테리어",
  "자동차용품",
];

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
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);

  // 드롭다운 외부 클릭 닫기
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        categoryRef.current &&
        !categoryRef.current.contains(e.target as Node)
      ) {
        setIsCategoryOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // 기존 상품에서 카테고리 추출
  const { data: products = [] } = useProductList();
  const categoryOptions = useMemo(() => {
    const existing = products
      .map((p) => p.category)
      .filter((c): c is string => !!c);
    const unique = Array.from(new Set([...existing, ...PRESET_CATEGORIES]));
    return unique.sort((a, b) => a.localeCompare(b, "ko"));
  }, [products]);

  const mutation = useMutation({
    mutationFn: () =>
      productsApi.create(userId!, {
        name: form.name,
        category: form.category || undefined,
        cost_price: Number(form.cost_price),
        selling_price: Number(form.selling_price),
        image_url: form.image_url || undefined,
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

          <div>
            <label className="block text-sm font-medium mb-1.5">
              <span className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                카테고리
              </span>
            </label>

            {isCustomCategory ? (
              <div className="flex gap-2">
                <input
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  className={`${inputClass("")} flex-1`}
                  placeholder="카테고리명 직접 입력"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomCategory(false);
                    setForm({ ...form, category: "" });
                  }}
                  className="shrink-0 rounded-xl border border-[var(--border)] px-3 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
                >
                  목록
                </button>
              </div>
            ) : (
              <div className="relative" ref={categoryRef}>
                <button
                  type="button"
                  onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                  className={`w-full rounded-xl border bg-[var(--card)] px-3.5 py-2.5 text-sm outline-none transition-all text-left flex items-center justify-between border-[var(--border)] ${isCategoryOpen ? "border-blue-500 ring-2 ring-blue-500/20" : ""}`}
                >
                  <span
                    className={
                      form.category
                        ? ""
                        : "text-[var(--muted-foreground)]/50"
                    }
                  >
                    {form.category || "카테고리 선택"}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-[var(--muted-foreground)] transition-transform ${isCategoryOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isCategoryOpen && (
                  <div className="absolute z-50 mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg overflow-hidden">
                    <div className="max-h-52 overflow-y-auto py-1">
                      {form.category && (
                        <button
                          type="button"
                          onClick={() => {
                            setForm({ ...form, category: "" });
                            setIsCategoryOpen(false);
                          }}
                          className="w-full px-3.5 py-2 text-sm text-left text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
                        >
                          선택 안함
                        </button>
                      )}
                      {categoryOptions.map((cat) => (
                        <button
                          type="button"
                          key={cat}
                          onClick={() => {
                            setForm({ ...form, category: cat });
                            setIsCategoryOpen(false);
                          }}
                          className={`w-full px-3.5 py-2 text-sm text-left hover:bg-[var(--muted)] transition-colors ${form.category === cat ? "text-blue-500 font-medium bg-blue-500/5" : ""}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-[var(--border)]">
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomCategory(true);
                          setIsCategoryOpen(false);
                          setForm({ ...form, category: "" });
                        }}
                        className="w-full px-3.5 py-2.5 text-sm text-left text-blue-500 hover:bg-[var(--muted)] transition-colors flex items-center gap-1.5 font-medium"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        직접 입력
                      </button>
                    </div>
                  </div>
                )}
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
