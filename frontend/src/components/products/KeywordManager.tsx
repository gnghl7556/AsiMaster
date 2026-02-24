"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X, Loader2, Tag, Wand2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useCreateKeyword, useDeleteKeyword } from "@/lib/hooks/useKeywords";
import { keywordsApi } from "@/lib/api/keywords";
import type { KeywordSuggestion, SearchKeyword } from "@/types";
import { cn } from "@/lib/utils/cn";
import {
  getKeywordLevelBadgeStyle,
  getTokenCategoryStyle,
} from "@/lib/utils/keywordSuggestion";

interface Props {
  productId: number;
  keywords: SearchKeyword[];
  maxKeywords?: number;
  productName?: string;
  categoryHint?: string | null;
  storeName?: string;
  onApplySuggestedCategory?: (category: string) => void;
}

export function KeywordManager({
  productId,
  keywords,
  maxKeywords = 5,
  productName,
  categoryHint,
  storeName,
  onApplySuggestedCategory,
}: Props) {
  const [input, setInput] = useState("");
  const [sortType, setSortType] = useState<"sim" | "asc">("sim");
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<KeywordSuggestion | null>(null);
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);
  const createMutation = useCreateKeyword(productId);
  const deleteMutation = useDeleteKeyword(productId);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const keyword = input.trim();
    if (!keyword) return;
    createMutation.mutate({ keyword, sort_type: sortType }, {
      onSuccess: () => {
        setInput("");
        setSortType("sim");
      },
    });
  };

  const activeCount = keywords.filter((k) => k.is_active).length;
  const existingKeywords = useMemo(
    () => new Set(keywords.filter((k) => k.is_active).map((k) => k.keyword.trim().toLowerCase())),
    [keywords]
  );

  useEffect(() => {
    setAiSuggestion(null);
    setIsAiPanelOpen(false);
  }, [productName, categoryHint, storeName]);

  const handleOpenAiSuggestion = async () => {
    if (!productName?.trim()) {
      return;
    }
    setIsAiPanelOpen(true);
    if (aiSuggestion || isAiSuggesting) return;
    setIsAiSuggesting(true);
    try {
      const data = await keywordsApi.suggest(
        productName.trim(),
        storeName || undefined,
        categoryHint || undefined
      );
      setAiSuggestion(data);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "AI 키워드 추천을 불러오지 못했습니다";
      setIsAiPanelOpen(false);
      setAiSuggestion(null);
      toast.error(msg);
    } finally {
      setIsAiSuggesting(false);
    }
  };

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium flex items-center gap-1.5">
          <Tag className="h-4 w-4" />
          검색 키워드
        </h3>
        <div className="flex items-center gap-2">
          {productName && (
            <button
              type="button"
              onClick={handleOpenAiSuggestion}
              disabled={isAiSuggesting}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--muted)] px-2 py-1 text-xs text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] disabled:opacity-60"
            >
              {isAiSuggesting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5 text-blue-500" />
              )}
              AI 추천
              <ChevronDown
                className={cn("h-3 w-3 transition-transform", isAiPanelOpen && "rotate-180")}
              />
            </button>
          )}
          <span className="text-xs text-[var(--muted-foreground)]">
            {activeCount} / {maxKeywords}
          </span>
        </div>
      </div>

      {/* 키워드 목록 */}
      <div className="flex flex-wrap gap-2 mb-3">
        {keywords.map((kw) => (
          <div
            key={kw.id}
            className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 text-sm"
          >
            <span>{kw.keyword}</span>
            {kw.is_primary && (
              <span className="rounded bg-blue-500/10 px-1 py-0.5 text-[9px] font-medium text-blue-500">
                기본
              </span>
            )}
            {kw.sort_type === "asc" && (
              <span className="rounded bg-amber-500/10 px-1 py-0.5 text-[9px] font-medium text-amber-500">
                가격
              </span>
            )}
            {!kw.is_primary && (
              <button
                onClick={() => deleteMutation.mutate(kw.id)}
                disabled={deleteMutation.isPending}
                className="rounded p-0.5 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-500 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {isAiPanelOpen && (
        <div className="mb-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-medium">AI 추천 키워드</div>
              <div className="text-[11px] text-[var(--muted-foreground)]">
                상품명 기반 SEO 조합 추천
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsAiPanelOpen(false)}
              className="rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--card)]"
              aria-label="닫기"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {isAiSuggesting ? (
            <div className="flex items-center gap-2 rounded-lg bg-[var(--card)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              추천 키워드를 분석 중입니다
            </div>
          ) : aiSuggestion ? (
            <div className="space-y-2">
              {aiSuggestion.tokens.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {aiSuggestion.tokens.map((token, idx) => {
                    const tokenStyle = getTokenCategoryStyle(token.category);
                    return (
                      <span
                        key={`${token.text}-${idx}`}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          tokenStyle.tag,
                          tokenStyle.text,
                          tokenStyle.strike && "line-through"
                        )}
                        title={`${token.category} · weight ${token.weight}`}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", tokenStyle.dot)} />
                        {token.text}
                      </span>
                    );
                  })}
                </div>
              )}

              {(aiSuggestion.field_guide.brand || aiSuggestion.field_guide.category) && (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-2">
                  <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                    필드 가이드
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {aiSuggestion.field_guide.brand && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-500">
                        브랜드
                        <span className="text-[var(--foreground)]">{aiSuggestion.field_guide.brand}</span>
                      </span>
                    )}
                    {aiSuggestion.field_guide.category && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
                        카테고리
                        <span className="text-[var(--foreground)]">
                          {aiSuggestion.field_guide.category}
                        </span>
                        {onApplySuggestedCategory && (
                          <button
                            type="button"
                            onClick={() => {
                              onApplySuggestedCategory(aiSuggestion.field_guide.category!);
                              toast.success("추천 카테고리를 적용했습니다. 기본 정보 저장을 눌러 반영하세요.");
                            }}
                            className="ml-0.5 rounded bg-emerald-500/15 px-1 py-0.5 text-[9px] font-semibold text-emerald-500 hover:bg-emerald-500/20"
                          >
                            적용
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                {aiSuggestion.keywords.length > 0 ? (
                  aiSuggestion.keywords.map((sug) => {
                    const exists = existingKeywords.has(sug.keyword.trim().toLowerCase());
                    const disabled = exists || createMutation.isPending || activeCount >= maxKeywords;
                    return (
                      <div
                        key={sug.keyword}
                        className="flex items-center gap-2 rounded-lg bg-[var(--card)] px-2.5 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{sug.keyword}</div>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                getKeywordLevelBadgeStyle(sug.level)
                              )}
                            >
                              {sug.level}
                            </span>
                            <span className="text-[10px] text-[var(--muted-foreground)]">
                              점수 {sug.score}
                            </span>
                            {exists && (
                              <span className="text-[10px] text-[var(--muted-foreground)]">
                                이미 등록됨
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() =>
                            createMutation.mutate({ keyword: sug.keyword, sort_type: "sim" })
                          }
                          className="shrink-0 rounded-lg border border-[var(--border)] px-2 py-1 text-xs transition-colors hover:bg-[var(--muted)] disabled:opacity-50"
                        >
                          추가
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-lg bg-[var(--card)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
                    추천 키워드를 생성하지 못했습니다
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-[var(--card)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
              AI 추천 버튼을 눌러 키워드를 생성하세요
            </div>
          )}
        </div>
      )}

      {/* 키워드 추가 */}
      {activeCount < maxKeywords && (
        <form onSubmit={handleAdd} className="flex gap-2">
          <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--muted)] p-0.5">
            <button
              type="button"
              onClick={() => setSortType("sim")}
              className={cn(
                "rounded-md px-2 py-1.5 text-xs transition-colors",
                sortType === "sim"
                  ? "bg-[var(--card)] text-blue-500 shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
            >
              노출
            </button>
            <button
              type="button"
              onClick={() => setSortType("asc")}
              className={cn(
                "rounded-md px-2 py-1.5 text-xs transition-colors",
                sortType === "asc"
                  ? "bg-[var(--card)] text-amber-500 shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
            >
              가격
            </button>
          </div>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="검색 키워드 입력..."
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
            maxLength={200}
          />
          <button
            type="submit"
            disabled={!input.trim() || createMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            추가
          </button>
        </form>
      )}

      <p className="mt-2 text-xs text-[var(--muted-foreground)]">
        상품명은 기본 키워드로 자동 등록됩니다. 추가 키워드를 입력하면 더 정확한 경쟁 순위를 파악할 수 있습니다.
      </p>
    </div>
  );
}
