"use client";

import { useState } from "react";
import { Plus, X, Loader2, Tag } from "lucide-react";
import { useCreateKeyword, useDeleteKeyword } from "@/lib/hooks/useKeywords";
import type { SearchKeyword } from "@/types";

interface Props {
  productId: number;
  keywords: SearchKeyword[];
  maxKeywords?: number;
}

export function KeywordManager({ productId, keywords, maxKeywords = 5 }: Props) {
  const [input, setInput] = useState("");
  const createMutation = useCreateKeyword(productId);
  const deleteMutation = useDeleteKeyword(productId);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const keyword = input.trim();
    if (!keyword) return;
    createMutation.mutate(keyword, {
      onSuccess: () => {
        setInput("");
      },
    });
  };

  const activeCount = keywords.filter((k) => k.is_active).length;

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium flex items-center gap-1.5">
          <Tag className="h-4 w-4" />
          검색 키워드
        </h3>
        <span className="text-xs text-[var(--muted-foreground)]">
          {activeCount} / {maxKeywords}
        </span>
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

      {/* 키워드 추가 */}
      {activeCount < maxKeywords && (
        <form onSubmit={handleAdd} className="flex gap-2">
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
