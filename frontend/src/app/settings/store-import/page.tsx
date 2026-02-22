"use client";

import { useEffect, useMemo, useState } from "react";
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
import { useUserStore } from "@/stores/useUserStore";
import { formatPrice } from "@/lib/utils/format";
import type { StoreProduct } from "@/types";
import { cn } from "@/lib/utils/cn";

const SMARTSTORE_URL_PREFIX = "https://smartstore.naver.com/";
const LAST_STORE_URL_KEY = "asimaster:last-smartstore-url";

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

  const parsedStoreInput = useMemo(() => parseStoreInput(storeUrl), [storeUrl]);

  const selectedCount = selectedIds.size;
  const allSelected =
    storeProducts.length > 0 && selectedCount === storeProducts.length;

  const selectedProducts = useMemo(
    () => storeProducts.filter((p) => selectedIds.has(p.naver_product_id)),
    [storeProducts, selectedIds]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(LAST_STORE_URL_KEY);
    if (saved) {
      setLastStoreUrl(saved);
      setStoreUrl(saved);
    }
  }, []);

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
        selectedProducts.map((p) => ({
          name: p.name,
          selling_price: p.price,
          image_url: p.image_url || undefined,
          category: p.category || undefined,
          naver_product_id: p.naver_product_id,
          keywords: Array.from(selectedKeywords.get(p.naver_product_id) || []),
        }))
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(
        `${result.created}개 등록${result.skipped > 0 ? `, ${result.skipped}개 중복 스킵` : ""}`
      );
      setStoreProducts([]);
      setSelectedIds(new Set());
      setSelectedKeywords(new Map());
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

          <div className="max-h-[420px] overflow-y-auto divide-y divide-[var(--border)]">
            {storeProducts.map((p) => {
              const checked = selectedIds.has(p.naver_product_id);
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
                    <div className="mt-2 ml-7 flex flex-wrap gap-1.5">
                      {p.suggested_keywords.map((kw) => {
                        const kwSelected =
                          selectedKeywords.get(p.naver_product_id)?.has(kw) ?? false;
                        return (
                          <button
                            key={kw}
                            type="button"
                            onClick={() => toggleKeyword(p.naver_product_id, kw)}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                              kwSelected
                                ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                                : "bg-[var(--muted)] text-[var(--muted-foreground)] border border-transparent"
                            )}
                          >
                            {kwSelected ? (
                              <CheckSquare className="h-3 w-3" />
                            ) : (
                              <Square className="h-3 w-3" />
                            )}
                            {kw}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="border-t border-[var(--border)] px-4 py-3">
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
