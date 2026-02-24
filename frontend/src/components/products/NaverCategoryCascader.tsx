"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FolderTree, Loader2 } from "lucide-react";
import { productsApi } from "@/lib/api/products";
import type { NaverCategory } from "@/types";

interface Props {
  value: string;
  onChange: (nextValue: string) => void;
  label?: string;
  helperText?: string;
}

function splitCategoryPath(value: string) {
  return value
    .split(/[>/]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export function NaverCategoryCascader({
  value,
  onChange,
  label = "네이버 카테고리",
  helperText = "크롤링 데이터 기반 카테고리 트리입니다",
}: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["naver-categories"],
    queryFn: () => productsApi.getNaverCategories(),
    staleTime: 1000 * 60 * 10,
  });

  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    setSelected(splitCategoryPath(value));
  }, [value]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-3">
        <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          카테고리 트리 불러오는 중
        </div>
      </div>
    );
  }

  if (!data?.categories?.length) {
    return null;
  }

  const levels: NaverCategory[][] = [];
  let currentNodes = data.categories;
  levels.push(currentNodes);
  for (let i = 0; i < 3; i += 1) {
    const picked = selected[i];
    if (!picked) break;
    const matched = currentNodes.find((n) => n.name === picked);
    if (!matched?.children?.length) break;
    currentNodes = matched.children;
    levels.push(currentNodes);
  }

  const handleSelect = (levelIndex: number, nextName: string) => {
    const nextSelected = [...selected.slice(0, levelIndex), nextName].filter(Boolean);
    setSelected(nextSelected);
    onChange(nextSelected.join("/"));
  };

  const handleClear = () => {
    setSelected([]);
    onChange("");
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <FolderTree className="h-3.5 w-3.5 text-blue-500" />
            {label}
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">{helperText}</p>
        </div>
        {!!selected.length && (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted-foreground)] hover:bg-[var(--card)] transition-colors"
          >
            초기화
          </button>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {levels.map((options, levelIndex) => (
          <select
            key={`cat-level-${levelIndex}`}
            value={selected[levelIndex] ?? ""}
            onChange={(e) => {
              const nextValue = e.target.value;
              if (!nextValue) {
                const nextSelected = selected.slice(0, levelIndex);
                setSelected(nextSelected);
                onChange(nextSelected.join("/"));
                return;
              }
              handleSelect(levelIndex, nextValue);
            }}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
          >
            <option value="">카테고리 {levelIndex + 1}</option>
            {options.map((opt) => (
              <option key={`${levelIndex}-${opt.name}`} value={opt.name}>
                {opt.name} ({opt.product_count})
              </option>
            ))}
          </select>
        ))}
      </div>

      {!!selected.length && (
        <div className="rounded-lg bg-[var(--card)] px-3 py-2 text-xs">
          <span className="text-[var(--muted-foreground)]">선택된 경로: </span>
          <span className="font-medium">{selected.join(" / ")}</span>
        </div>
      )}
    </div>
  );
}
