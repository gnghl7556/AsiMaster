"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  CheckSquare,
  Download,
  Loader2,
  Package,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { productsApi } from "@/lib/api/products";
import { keywordsApi } from "@/lib/api/keywords";
import { useUserStore } from "@/stores/useUserStore";
import { formatPrice } from "@/lib/utils/format";
import type { KeywordSuggestion, StoreProduct } from "@/types";
import { cn } from "@/lib/utils/cn";
import {
  findSuggestedKeywordMeta,
  getKeywordLevelBadgeStyle,
  getTokenCategoryStyle,
} from "@/lib/utils/keywordSuggestion";

const SMARTSTORE_URL_PREFIX = "https://smartstore.naver.com/";
const LAST_STORE_URL_KEY = "asimaster:last-smartstore-url";
const AUTO_KEYWORD_META_PREFETCH_LIMIT = 8;
const TOKEN_LEGEND = [
  { label: "브랜드", category: "BRAND" },
  { label: "모델", category: "MODEL" },
  { label: "유형", category: "TYPE" },
  { label: "시리즈", category: "SERIES" },
  { label: "규격/수량", category: "QUANTITY" },
  { label: "색상", category: "COLOR" },
  { label: "제외어", category: "MODIFIER" },
] as const;

type StoreInputParseResult =
  | { kind: "empty" }
  | { kind: "url"; normalizedUrl: string }
  | { kind: "slug"; normalizedUrl: string; slug: string }
  | { kind: "business_name"; input: string }
  | { kind: "invalid_url"; input: string };

function parseStoreInput(raw: string): StoreInputParseResult {
  const value = raw.trim();
  if (!value) return { kind: "empty" };

  if (/^smartstore\.naver\.com\//i.test(value)) {
    return {
      kind: "url",
      normalizedUrl: `https://${value.replace(/^https?:\/\//i, "")}`,
    };
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (url.hostname !== "smartstore.naver.com") {
        return { kind: "invalid_url", input: value };
      }
      return { kind: "url", normalizedUrl: url.toString() };
    } catch {
      return { kind: "invalid_url", input: value };
    }
  }

  const hasKorean = /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(value);
  const hasWhitespace = /\s/.test(value);
  const looksLikeSlug = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,49}$/.test(value);

  if (looksLikeSlug) {
    return {
      kind: "slug",
      slug: value,
      normalizedUrl: `${SMARTSTORE_URL_PREFIX}${value}`,
    };
  }

  if (hasKorean || hasWhitespace) {
    return { kind: "business_name", input: value };
  }

  return { kind: "invalid_url", input: value };
}

export default function StoreImportPage() {
  const userId = useUserStore((s) => s.currentUserId);
  const queryClient = useQueryClient();

  const [storeUrl, setStoreUrl] = useState("");
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedKeywords, setSelectedKeywords] = useState<Map<string, Set<string>>>(new Map());
  const [hasPreviewed, setHasPreviewed] = useState(false);
  const [lastStoreUrl, setLastStoreUrl] = useState<string>("");
  const [keywordMetaByProduct, setKeywordMetaByProduct] = useState<Record<string, KeywordSuggestion>>({});
  const [loadingKeywordMetaIds, setLoadingKeywordMetaIds] = useState<Set<string>>(new Set());
  const [failedKeywordMetaIds, setFailedKeywordMetaIds] = useState<Set<string>>(new Set());
  const [showAiIncompleteOnly, setShowAiIncompleteOnly] = useState(false);

  const suggestQueueRef = useRef<StoreProduct[]>([]);
  const queuedSuggestIdsRef = useRef<Set<string>>(new Set());
  const activeSuggestWorkersRef = useRef(0);
  const suggestRunIdRef = useRef(0);

  const parsedStoreInput = useMemo(() => parseStoreInput(storeUrl), [storeUrl]);

  const getIsAiMetaIncomplete = (p: StoreProduct) => {
    if (!p.suggested_keywords.length) return false;
    const pid = p.naver_product_id;
    return (
      !keywordMetaByProduct[pid] ||
      loadingKeywordMetaIds.has(pid) ||
      failedKeywordMetaIds.has(pid)
    );
  };

  const visibleStoreProducts = useMemo(
    () =>
      showAiIncompleteOnly
        ? storeProducts.filter((p) => getIsAiMetaIncomplete(p))
        : storeProducts,
    [
      storeProducts,
      showAiIncompleteOnly,
      keywordMetaByProduct,
      loadingKeywordMetaIds,
      failedKeywordMetaIds,
    ]
  );

  const selectedCount = selectedIds.size;
  const allSelected =
    visibleStoreProducts.length > 0 &&
    visibleStoreProducts.every((p) => selectedIds.has(p.naver_product_id));

  const selectedProducts = useMemo(
    () => storeProducts.filter((p) => selectedIds.has(p.naver_product_id)),
    [storeProducts, selectedIds]
  );
  const selectedProductsUsingDefaultKeyword = useMemo(
    () =>
      selectedProducts.filter(
        (p) => (selectedKeywords.get(p.naver_product_id)?.size ?? 0) === 0
      ).length,
    [selectedProducts, selectedKeywords]
  );
  const selectedKeywordSummary = useMemo(() => {
    let totalKeywords = 0;
    let zeroKeywordProducts = 0;
    let maxKeywordsOnSingleProduct = 0;

    for (const p of selectedProducts) {
      const count = selectedKeywords.get(p.naver_product_id)?.size ?? 0;
      totalKeywords += count;
      if (count === 0) zeroKeywordProducts += 1;
      if (count > maxKeywordsOnSingleProduct) maxKeywordsOnSingleProduct = count;
    }

    return {
      totalKeywords,
      zeroKeywordProducts,
      maxKeywordsOnSingleProduct,
      avgKeywordsPerProduct:
        selectedProducts.length > 0 ? totalKeywords / selectedProducts.length : 0,
    };
  }, [selectedProducts, selectedKeywords]);
  const selectedAiMetaSummary = useMemo(() => {
    const targetProducts = selectedProducts.filter((p) => p.suggested_keywords.length > 0);
    let loaded = 0;
    let loading = 0;
    let failed = 0;
    let notLoaded = 0;

    for (const p of targetProducts) {
      const pid = p.naver_product_id;
      if (keywordMetaByProduct[pid]) loaded += 1;
      else if (loadingKeywordMetaIds.has(pid)) loading += 1;
      else if (failedKeywordMetaIds.has(pid)) failed += 1;
      else notLoaded += 1;
    }

    return {
      targetCount: targetProducts.length,
      loaded,
      loading,
      failed,
      notLoaded,
      incomplete: loading + failed + notLoaded,
    };
  }, [
    selectedProducts,
    keywordMetaByProduct,
    loadingKeywordMetaIds,
    failedKeywordMetaIds,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(LAST_STORE_URL_KEY);
    if (saved) {
      setLastStoreUrl(saved);
      setStoreUrl(saved);
    }
  }, []);

  const runSuggestQueue = (runId = suggestRunIdRef.current) => {
    while (activeSuggestWorkersRef.current < 2 && suggestQueueRef.current.length > 0) {
      const product = suggestQueueRef.current.shift();
      if (!product) break;
      const pid = product.naver_product_id;
      queuedSuggestIdsRef.current.delete(pid);
      activeSuggestWorkersRef.current += 1;
      setLoadingKeywordMetaIds((prev) => {
        const next = new Set(prev);
        next.add(pid);
        return next;
      });

      keywordsApi
        .suggest(product.name, undefined, product.category || undefined)
        .then((data) => {
          if (runId !== suggestRunIdRef.current) return;
          setKeywordMetaByProduct((prev) => ({ ...prev, [pid]: data }));
          setFailedKeywordMetaIds((prev) => {
            const next = new Set(prev);
            next.delete(pid);
            return next;
          });
        })
        .catch(() => {
          if (runId !== suggestRunIdRef.current) return;
          setFailedKeywordMetaIds((prev) => {
            const next = new Set(prev);
            next.add(pid);
            return next;
          });
        })
        .finally(() => {
          if (runId !== suggestRunIdRef.current) return;
          activeSuggestWorkersRef.current -= 1;
          setLoadingKeywordMetaIds((prev) => {
            const next = new Set(prev);
            next.delete(pid);
            return next;
          });
          runSuggestQueue(runId);
        });
    }
  };

  const enqueueSuggestMeta = (product: StoreProduct) => {
    const pid = product.naver_product_id;
    if (
      keywordMetaByProduct[pid] ||
      loadingKeywordMetaIds.has(pid) ||
      queuedSuggestIdsRef.current.has(pid)
    ) {
      return;
    }
    queuedSuggestIdsRef.current.add(pid);
    suggestQueueRef.current.push(product);
    runSuggestQueue(suggestRunIdRef.current);
  };

  const enqueueSelectedIncompleteKeywordMeta = () => {
    selectedProducts
      .filter((p) => p.suggested_keywords.length > 0)
      .forEach((p) => {
        const pid = p.naver_product_id;
        if (keywordMetaByProduct[pid] || loadingKeywordMetaIds.has(pid)) return;
        enqueueSuggestMeta(p);
      });
  };

  const previewMutation = useMutation({
    mutationFn: (url: string) => productsApi.previewStoreProducts(userId!, url),
    onSuccess: (data, url) => {
      suggestRunIdRef.current += 1;
      setHasPreviewed(true);
      setStoreProducts(data);
      setSelectedIds(new Set(data.map((p) => p.naver_product_id)));
      const kwMap = new Map<string, Set<string>>();
      data.forEach((p) => {
        kwMap.set(p.naver_product_id, new Set(p.suggested_keywords || []));
      });
      setSelectedKeywords(kwMap);
      setKeywordMetaByProduct({});
      setLoadingKeywordMetaIds(new Set());
      setFailedKeywordMetaIds(new Set());
      suggestQueueRef.current = [];
      queuedSuggestIdsRef.current = new Set();
      activeSuggestWorkersRef.current = 0;
      setStoreUrl(url);
      setLastStoreUrl(url);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LAST_STORE_URL_KEY, url);
      }
      if (data.length === 0) {
        toast.info("해당 스토어에서 상품을 찾을 수 없습니다");
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || "상품을 불러올 수 없습니다";
      toast.error(msg);
    },
  });

  const importMutation = useMutation({
    mutationFn: () =>
      productsApi.importStoreProducts(
        userId!,
        selectedProducts.map((p) => {
          const keywords = Array.from(selectedKeywords.get(p.naver_product_id) || []);
          return {
            name: p.name,
            selling_price: p.price,
            image_url: p.image_url || undefined,
            category: p.category || undefined,
            naver_product_id: p.naver_product_id,
            keywords: keywords.length > 0 ? keywords : undefined,
          };
        })
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(
        `${result.created}개 등록${result.skipped > 0 ? `, ${result.skipped}개 중복 스킵` : ""}`
      );
      setStoreProducts([]);
      setSelectedIds(new Set());
      setSelectedKeywords(new Map());
      setShowAiIncompleteOnly(false);
      suggestRunIdRef.current += 1;
      setKeywordMetaByProduct({});
      setLoadingKeywordMetaIds(new Set());
      setFailedKeywordMetaIds(new Set());
      suggestQueueRef.current = [];
      queuedSuggestIdsRef.current = new Set();
      activeSuggestWorkersRef.current = 0;
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || "상품 등록에 실패했습니다";
      toast.error(msg);
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleStoreProducts.forEach((p) => next.delete(p.naver_product_id));
      } else {
        visibleStoreProducts.forEach((p) => next.add(p.naver_product_id));
      }
      return next;
    });
  };

  const selectAiIncompleteProducts = () => {
    const targets = storeProducts.filter((p) => getIsAiMetaIncomplete(p));
    if (targets.length === 0) {
      toast.info("AI 분류 미완료 상품이 없습니다");
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      targets.forEach((p) => next.add(p.naver_product_id));
      return next;
    });
    toast.success(`AI 분류 미완료 상품 ${targets.length}개를 선택했습니다`);
  };

  const toggleKeyword = (productId: string, keyword: string) => {
    setSelectedKeywords((prev) => {
      const next = new Map(prev);
      const kwSet = new Set(next.get(productId) || []);
      if (kwSet.has(keyword)) kwSet.delete(keyword);
      else kwSet.add(keyword);
      next.set(productId, kwSet);
      return next;
    });
  };

  const applyKeywordPreset = (
    product: StoreProduct,
    mode: "specific" | "balanced" | "all" | "clear"
  ) => {
    const pid = product.naver_product_id;
    const keywordMeta = keywordMetaByProduct[pid];
    const nextSelected =
      mode === "clear"
        ? []
        : mode === "all" || !keywordMeta
        ? product.suggested_keywords
        : product.suggested_keywords.filter((kw) => {
            const meta = findSuggestedKeywordMeta(kw, keywordMeta);
            if (!meta.level) return mode === "balanced";
            if (mode === "specific") return meta.level === "specific";
            return meta.level === "specific" || meta.level === "medium";
          });

    setSelectedKeywords((prev) => {
      const next = new Map(prev);
      next.set(pid, new Set(nextSelected));
      return next;
    });

    toast.success(
      mode === "clear"
        ? "추천 키워드를 해제했습니다 (상품명이 기본 키워드로 등록됨)"
        : mode === "specific"
        ? "정밀 키워드만 선택했습니다"
        : mode === "balanced"
        ? "정밀/중간 키워드 위주로 선택했습니다"
        : "추천 키워드를 모두 선택했습니다"
    );
  };

  const applyBulkKeywordPreset = (mode: "specific" | "balanced" | "all" | "clear") => {
    if (selectedProducts.length === 0) return;

    setSelectedKeywords((prev) => {
      const next = new Map(prev);
      for (const product of selectedProducts) {
        const pid = product.naver_product_id;
        const keywordMeta = keywordMetaByProduct[pid];
        const nextSelected =
          mode === "clear"
            ? []
            : mode === "all" || !keywordMeta
            ? product.suggested_keywords
            : product.suggested_keywords.filter((kw) => {
                const meta = findSuggestedKeywordMeta(kw, keywordMeta);
                if (!meta.level) return mode === "balanced";
                if (mode === "specific") return meta.level === "specific";
                return meta.level === "specific" || meta.level === "medium";
              });
        next.set(pid, new Set(nextSelected));
      }
      return next;
    });

    toast.success(
      mode === "clear"
        ? `선택 상품 ${selectedProducts.length}개의 추천 키워드를 해제했습니다`
        : mode === "specific"
        ? `선택 상품 ${selectedProducts.length}개에 정밀 키워드를 적용했습니다`
        : mode === "balanced"
        ? `선택 상품 ${selectedProducts.length}개에 정밀/중간 키워드를 적용했습니다`
        : `선택 상품 ${selectedProducts.length}개에 추천 키워드를 모두 적용했습니다`
    );
  };

  useEffect(() => {
    if (storeProducts.length === 0) return;
    let queuedCount = 0;
    for (const product of storeProducts) {
      if (!selectedIds.has(product.naver_product_id)) continue;
      if (!product.suggested_keywords?.length) continue;
      if (
        !keywordMetaByProduct[product.naver_product_id] &&
        !loadingKeywordMetaIds.has(product.naver_product_id) &&
        !queuedSuggestIdsRef.current.has(product.naver_product_id)
      ) {
        if (queuedCount >= AUTO_KEYWORD_META_PREFETCH_LIMIT) continue;
        queuedCount += 1;
      }
      enqueueSuggestMeta(product);
    }
  }, [selectedIds, storeProducts, keywordMetaByProduct, loadingKeywordMetaIds]);

  const handlePreview = () => {
    if (!userId) {
      toast.error("사업체를 먼저 선택해주세요");
      return;
    }
    if (parsedStoreInput.kind === "empty") return;

    if (parsedStoreInput.kind === "business_name") {
      toast.error(
        "상호명만으로는 스토어 주소를 찾기 어렵습니다. 스마트스토어 URL 또는 주소 마지막 아이디를 입력해주세요."
      );
      return;
    }

    if (parsedStoreInput.kind === "invalid_url") {
      toast.error("스마트스토어 URL 또는 스토어 아이디를 확인해주세요");
      return;
    }

    previewMutation.mutate(parsedStoreInput.normalizedUrl);
  };

  const handleImport = () => {
    if (selectedCount === 0) return;
    importMutation.mutate();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/settings"
          className="rounded-lg p-1.5 hover:bg-[var(--muted)] transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">상품 불러오기</h1>
      </div>

      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Download className="h-5 w-5 text-blue-500" />
          <h2 className="font-medium">스마트스토어 상품 불러오기</h2>
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">
          스마트스토어 URL 또는 스토어 아이디를 입력하면 상품을 미리보고 선택 등록할 수 있습니다.
        </p>
        {lastStoreUrl && (
          <button
            type="button"
            onClick={() => setStoreUrl(lastStoreUrl)}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--muted)] px-2.5 py-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            최근 사용
            <span className="truncate text-[var(--foreground)]">{lastStoreUrl}</span>
          </button>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={storeUrl}
            onChange={(e) => setStoreUrl(e.target.value)}
            placeholder="스토어 URL 또는 주소 마지막 아이디 (예: asmt)"
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
          />
          <button
            type="button"
            onClick={handlePreview}
            disabled={!storeUrl.trim() || previewMutation.isPending}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {previewMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            상품 불러오기
          </button>
        </div>
        <div className="min-h-5 text-xs text-[var(--muted-foreground)]">
          {parsedStoreInput.kind === "slug" && (
            <span>
              스토어 아이디로 인식됨:{" "}
              <span className="text-[var(--foreground)]">
                {parsedStoreInput.normalizedUrl}
              </span>
            </span>
          )}
          {parsedStoreInput.kind === "business_name" && (
            <span className="text-amber-600 dark:text-amber-400">
              현재 입력은 상호명처럼 보입니다. 스토어 URL 또는 주소 마지막 아이디를 입력해주세요.
            </span>
          )}
          {parsedStoreInput.kind === "invalid_url" && (
            <span className="text-rose-600 dark:text-rose-400">
              `smartstore.naver.com/스토어아이디` 형식의 URL 또는 스토어 아이디를 입력해주세요.
            </span>
          )}
          {(parsedStoreInput.kind === "empty" || parsedStoreInput.kind === "url") && (
            <span>
              예:{" "}
              <span className="text-[var(--foreground)]">
                https://smartstore.naver.com/내스토어
              </span>{" "}
              또는{" "}
              <span className="text-[var(--foreground)]">내스토어</span>
            </span>
          )}
        </div>
      </div>

      {storeProducts.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div className="text-sm font-medium">
              {visibleStoreProducts.length}
              {showAiIncompleteOnly && visibleStoreProducts.length !== storeProducts.length && (
                <span className="text-[var(--muted-foreground)]"> / {storeProducts.length}</span>
              )}개 상품 발견
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAiIncompleteOnly((prev) => !prev)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] transition-colors",
                  showAiIncompleteOnly
                    ? "border-blue-500/25 bg-blue-500/10 text-blue-500"
                    : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                )}
              >
                {showAiIncompleteOnly ? (
                  <CheckSquare className="h-3.5 w-3.5" />
                ) : (
                  <Square className="h-3.5 w-3.5" />
                )}
                AI 미완료만
              </button>
              <button
                type="button"
                onClick={selectAiIncompleteProducts}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--muted-foreground)] hover:text-blue-500 transition-colors"
              >
                <CheckSquare className="h-3.5 w-3.5" />
                미완료 선택
              </button>
              <button
                type="button"
                onClick={toggleAll}
                className="inline-flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              >
                {allSelected ? (
                  <CheckSquare className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                {showAiIncompleteOnly ? "표시목록 선택" : "전체 선택"}
              </button>
            </div>
          </div>
          <div className="border-b border-[var(--border)] px-4 py-2">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
              <span className="font-medium">AI 토큰 색상</span>
              {TOKEN_LEGEND.map((item) => {
                const tokenStyle = getTokenCategoryStyle(item.category);
                return (
                  <span
                    key={item.category}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5",
                      tokenStyle.tag,
                      tokenStyle.text,
                      tokenStyle.strike && "line-through"
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", tokenStyle.dot)} />
                    {item.label}
                  </span>
                );
              })}
            </div>
            {selectedCount > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-[var(--muted-foreground)]">
                  선택 상품 일괄 적용
                </span>
                <button
                  type="button"
                  onClick={() => applyBulkKeywordPreset("specific")}
                  className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500 hover:bg-emerald-500/15"
                >
                  정밀만
                </button>
                <button
                  type="button"
                  onClick={() => applyBulkKeywordPreset("balanced")}
                  className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500 hover:bg-amber-500/15"
                >
                  정밀+중간
                </button>
                <button
                  type="button"
                  onClick={() => applyBulkKeywordPreset("all")}
                  className="rounded-full border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  전체
                </button>
                <button
                  type="button"
                  onClick={() => applyBulkKeywordPreset("clear")}
                  className="rounded-full border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)] hover:text-rose-500"
                >
                  해제
                </button>
              </div>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto divide-y divide-[var(--border)]">
            {visibleStoreProducts.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
                {showAiIncompleteOnly
                  ? "AI 분류 미완료 상품이 없습니다"
                  : "표시할 상품이 없습니다"}
              </div>
            )}
            {visibleStoreProducts.map((p) => {
              const checked = selectedIds.has(p.naver_product_id);
              const selectedKeywordCount =
                selectedKeywords.get(p.naver_product_id)?.size ?? 0;
              const keywordMeta = keywordMetaByProduct[p.naver_product_id];
              const isKeywordMetaLoading = loadingKeywordMetaIds.has(p.naver_product_id);
              const keywordMetaFailed = failedKeywordMetaIds.has(p.naver_product_id);
              return (
                <div
                  key={p.naver_product_id}
                  className="px-4 py-3 hover:bg-[var(--muted)]/40 transition-colors"
                >
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelect(p.naver_product_id)}
                      className="h-4 w-4 rounded border-[var(--border)]"
                    />
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="h-10 w-10 rounded-md object-cover bg-[var(--muted)]"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--muted)]">
                        <Package className="h-4 w-4 text-[var(--muted-foreground)]" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="truncate text-xs text-[var(--muted-foreground)]">
                        {p.category}
                      </div>
                      {(p.brand || p.maker) && (
                        <div className="truncate text-xs text-[var(--muted-foreground)]">
                          {[p.brand, p.maker].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right text-sm font-medium tabular-nums">
                      {formatPrice(p.price)}원
                    </div>
                  </label>

                  {checked && p.suggested_keywords.length > 0 && (
                    <div className="mt-2 ml-7 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-[var(--muted-foreground)]">
                          빠른 선택
                        </span>
                        <button
                          type="button"
                          onClick={() => applyKeywordPreset(p, "specific")}
                          disabled={isKeywordMetaLoading}
                          className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500 hover:bg-emerald-500/15 disabled:opacity-50"
                        >
                          정밀만
                        </button>
                        <button
                          type="button"
                          onClick={() => applyKeywordPreset(p, "balanced")}
                          disabled={isKeywordMetaLoading}
                          className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500 hover:bg-amber-500/15 disabled:opacity-50"
                        >
                          정밀+중간
                        </button>
                        <button
                          type="button"
                          onClick={() => applyKeywordPreset(p, "clear")}
                          className="rounded-full border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)] hover:text-rose-500"
                        >
                          해제
                        </button>
                        <button
                          type="button"
                          onClick={() => applyKeywordPreset(p, "all")}
                          className="rounded-full border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                        >
                          전체
                        </button>
                      </div>
                      <div className="text-[11px] text-[var(--muted-foreground)]">
                        선택된 키워드 {selectedKeywordCount}개
                        {selectedKeywordCount === 0 && (
                          <span className="text-amber-500">
                            {" "}· 상품명이 기본 키워드로 등록됩니다
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                      {isKeywordMetaLoading && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--muted)] px-2 py-1 text-[11px] text-[var(--muted-foreground)]">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          AI 분류 분석 중
                        </span>
                      )}
                      {keywordMetaFailed && !isKeywordMetaLoading && (
                        <button
                          type="button"
                          onClick={() => enqueueSuggestMeta(p)}
                          className="inline-flex items-center gap-1 rounded-full border border-rose-500/25 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-500 transition-colors hover:bg-rose-500/15"
                        >
                          AI 분류 재시도
                        </button>
                      )}
                      {!keywordMeta && !isKeywordMetaLoading && !keywordMetaFailed && (
                        <button
                          type="button"
                          onClick={() => enqueueSuggestMeta(p)}
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[11px] text-[var(--muted-foreground)] transition-colors hover:text-blue-500"
                        >
                          AI 분류 로드
                        </button>
                      )}
                      {p.suggested_keywords.map((kw) => {
                        const kwSelected =
                          selectedKeywords.get(p.naver_product_id)?.has(kw) ?? false;
                        const kwMeta = findSuggestedKeywordMeta(kw, keywordMeta);
                        const tokenStyle = getTokenCategoryStyle(kwMeta.tokenCategory);
                        return (
                          <button
                            key={kw}
                            type="button"
                            onClick={() => toggleKeyword(p.naver_product_id, kw)}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                              kwSelected
                                ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                                : "bg-[var(--muted)] text-[var(--muted-foreground)] border border-transparent",
                              tokenStyle.strike && "line-through"
                            )}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full shrink-0",
                                tokenStyle.dot
                              )}
                            />
                            {kwSelected ? (
                              <CheckSquare className="h-3 w-3" />
                            ) : (
                              <Square className="h-3 w-3" />
                            )}
                            {kw}
                            {kwMeta.level && (
                              <span
                                className={cn(
                                  "rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                                  getKeywordLevelBadgeStyle(kwMeta.level)
                                )}
                              >
                                {kwMeta.level === "specific"
                                  ? "S"
                                  : kwMeta.level === "medium"
                                  ? "M"
                                  : "B"}
                              </span>
                            )}
                          </button>
                        );
                      })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="border-t border-[var(--border)] px-4 py-3">
            {selectedCount > 0 && selectedAiMetaSummary.targetCount > 0 && (
              <div className="mb-2 rounded-lg border border-[var(--border)] bg-[var(--card)]/60 px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[var(--muted-foreground)]">
                  <span>
                    AI 분류 대상 {selectedAiMetaSummary.targetCount}개
                  </span>
                  <span className="text-emerald-500">
                    완료 {selectedAiMetaSummary.loaded}
                  </span>
                  {selectedAiMetaSummary.loading > 0 && (
                    <span className="text-blue-500">로딩 {selectedAiMetaSummary.loading}</span>
                  )}
                  {selectedAiMetaSummary.notLoaded > 0 && (
                    <span className="text-amber-500">
                      미로드 {selectedAiMetaSummary.notLoaded}
                    </span>
                  )}
                  {selectedAiMetaSummary.failed > 0 && (
                    <span className="text-rose-500">실패 {selectedAiMetaSummary.failed}</span>
                  )}
                </div>
                {selectedAiMetaSummary.incomplete > 0 && (
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] text-[var(--muted-foreground)]">
                      AI 분류 미완료 상품 {selectedAiMetaSummary.incomplete}개 (키워드 프리셋 품질이 낮을 수 있음)
                    </div>
                    {(selectedAiMetaSummary.notLoaded > 0 || selectedAiMetaSummary.failed > 0) && (
                      <button
                        type="button"
                        onClick={enqueueSelectedIncompleteKeywordMeta}
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[11px] font-medium text-[var(--muted-foreground)] transition-colors hover:text-blue-500"
                      >
                        <Loader2
                          className={cn(
                            "h-3 w-3",
                            selectedAiMetaSummary.loading > 0 && "animate-spin"
                          )}
                        />
                        미완료 AI 분류 로드
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            {selectedCount > 0 && (
              <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]/60 px-3 py-2">
                  <div className="text-[10px] text-[var(--muted-foreground)]">선택 상품</div>
                  <div className="text-sm font-semibold tabular-nums">{selectedCount}개</div>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]/60 px-3 py-2">
                  <div className="text-[10px] text-[var(--muted-foreground)]">선택 키워드</div>
                  <div className="text-sm font-semibold tabular-nums">
                    {selectedKeywordSummary.totalKeywords}개
                  </div>
                  <div className="text-[10px] text-[var(--muted-foreground)]">
                    평균 {selectedKeywordSummary.avgKeywordsPerProduct.toFixed(1)}개/상품
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]/60 px-3 py-2">
                  <div className="text-[10px] text-[var(--muted-foreground)]">기본 키워드 등록</div>
                  <div
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      selectedKeywordSummary.zeroKeywordProducts > 0
                        ? "text-amber-500"
                        : "text-[var(--foreground)]"
                    )}
                  >
                    {selectedKeywordSummary.zeroKeywordProducts}개
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]/60 px-3 py-2">
                  <div className="text-[10px] text-[var(--muted-foreground)]">AI 미완료</div>
                  <div
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      selectedAiMetaSummary.incomplete > 0
                        ? "text-rose-500"
                        : "text-emerald-500"
                    )}
                  >
                    {selectedAiMetaSummary.incomplete}개
                  </div>
                  <div className="text-[10px] text-[var(--muted-foreground)]">
                    대상 {selectedAiMetaSummary.targetCount}개
                  </div>
                </div>
              </div>
            )}
            {selectedCount > 0 && selectedProductsUsingDefaultKeyword > 0 && (
              <div className="mb-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                선택한 상품 중 {selectedProductsUsingDefaultKeyword}개는 추천 키워드가 해제되어 상품명이 기본 키워드로 등록됩니다.
              </div>
            )}
            <button
              type="button"
              onClick={handleImport}
              disabled={selectedCount === 0 || importMutation.isPending}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              {importMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckSquare className="h-4 w-4" />
              )}
              선택한 {selectedCount}개 상품 등록
            </button>
          </div>
        </div>
      )}

      {hasPreviewed && !previewMutation.isPending && storeProducts.length === 0 && (
        <div className="glass-card p-5 text-center text-sm text-[var(--muted-foreground)]">
          해당 스토어에서 상품을 찾을 수 없습니다
        </div>
      )}
    </div>
  );
}
