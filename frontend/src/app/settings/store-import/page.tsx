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

  const suggestQueueRef = useRef<StoreProduct[]>([]);
  const queuedSuggestIdsRef = useRef<Set<string>>(new Set());
  const activeSuggestWorkersRef = useRef(0);

  const parsedStoreInput = useMemo(() => parseStoreInput(storeUrl), [storeUrl]);

  const selectedCount = selectedIds.size;
  const allSelected =
    storeProducts.length > 0 && selectedCount === storeProducts.length;

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(LAST_STORE_URL_KEY);
    if (saved) {
      setLastStoreUrl(saved);
      setStoreUrl(saved);
    }
  }, []);

  const runSuggestQueue = () => {
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
          setKeywordMetaByProduct((prev) => ({ ...prev, [pid]: data }));
          setFailedKeywordMetaIds((prev) => {
            const next = new Set(prev);
            next.delete(pid);
            return next;
          });
        })
        .catch(() => {
          setFailedKeywordMetaIds((prev) => {
            const next = new Set(prev);
            next.add(pid);
            return next;
          });
        })
        .finally(() => {
          activeSuggestWorkersRef.current -= 1;
          setLoadingKeywordMetaIds((prev) => {
            const next = new Set(prev);
            next.delete(pid);
            return next;
          });
          runSuggestQueue();
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
    runSuggestQueue();
  };

  const previewMutation = useMutation({
    mutationFn: (url: string) => productsApi.previewStoreProducts(userId!, url),
    onSuccess: (data, url) => {
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
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(storeProducts.map((p) => p.naver_product_id)));
    }
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

  useEffect(() => {
    if (storeProducts.length === 0) return;
    for (const product of storeProducts) {
      if (!selectedIds.has(product.naver_product_id)) continue;
      if (!product.suggested_keywords?.length) continue;
      enqueueSuggestMeta(product);
    }
  }, [selectedIds, storeProducts]);

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
            <div className="text-sm font-medium">{storeProducts.length}개 상품 발견</div>
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
              전체 선택
            </button>
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
          </div>

          <div className="max-h-[420px] overflow-y-auto divide-y divide-[var(--border)]">
            {storeProducts.map((p) => {
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
