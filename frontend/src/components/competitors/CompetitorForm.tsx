"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";

interface Props {
  onSubmit: (url: string) => void;
  isLoading?: boolean;
}

const PLATFORM_HINTS: Record<string, string> = {
  "smartstore.naver.com": "네이버",
  "shopping.naver.com": "네이버",
  "coupang.com": "쿠팡",
  "gmarket.co.kr": "지마켓",
  "auction.co.kr": "옥션",
};

function detectPlatform(url: string): string | null {
  for (const [domain, name] of Object.entries(PLATFORM_HINTS)) {
    if (url.includes(domain)) return name;
  }
  return null;
}

export function CompetitorForm({ onSubmit, isLoading }: Props) {
  const [url, setUrl] = useState("");
  const detected = url.length > 10 ? detectPlatform(url) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    onSubmit(url.trim());
    setUrl("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="경쟁사 상품 URL 입력..."
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
        />
        {detected && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-500">
            {detected}
          </span>
        )}
      </div>
      <button
        type="submit"
        disabled={!url.trim() || isLoading}
        className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        추가
      </button>
    </form>
  );
}
