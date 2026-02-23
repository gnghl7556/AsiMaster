import type { KeywordSuggestion, SuggestedKeyword } from "@/types";

type TokenCategoryStyle = {
  dot: string;
  tag: string;
  text: string;
  strike?: boolean;
};

export const TOKEN_CATEGORY_STYLES: Record<string, TokenCategoryStyle> = {
  BRAND: {
    dot: "bg-blue-500",
    tag: "border-blue-500/30 bg-blue-500/10",
    text: "text-blue-500",
  },
  MODEL: {
    dot: "bg-purple-500",
    tag: "border-purple-500/30 bg-purple-500/10",
    text: "text-purple-500",
  },
  TYPE: {
    dot: "bg-emerald-500",
    tag: "border-emerald-500/30 bg-emerald-500/10",
    text: "text-emerald-500",
  },
  SERIES: {
    dot: "bg-cyan-500",
    tag: "border-cyan-500/30 bg-cyan-500/10",
    text: "text-cyan-500",
  },
  QUANTITY: {
    dot: "bg-orange-500",
    tag: "border-orange-500/30 bg-orange-500/10",
    text: "text-orange-500",
  },
  SIZE: {
    dot: "bg-yellow-500",
    tag: "border-yellow-500/30 bg-yellow-500/10",
    text: "text-yellow-500",
  },
  COLOR: {
    dot: "bg-pink-500",
    tag: "border-pink-500/30 bg-pink-500/10",
    text: "text-pink-500",
  },
  MODIFIER: {
    dot: "bg-rose-500",
    tag: "border-rose-500/30 bg-rose-500/10",
    text: "text-rose-500",
    strike: true,
  },
};

export function getTokenCategoryStyle(category?: string | null): TokenCategoryStyle {
  if (!category) {
    return {
      dot: "bg-[var(--muted-foreground)]/50",
      tag: "border-[var(--border)] bg-[var(--muted)]",
      text: "text-[var(--muted-foreground)]",
    };
  }
  return (
    TOKEN_CATEGORY_STYLES[category] ?? {
      dot: "bg-[var(--muted-foreground)]/50",
      tag: "border-[var(--border)] bg-[var(--muted)]",
      text: "text-[var(--muted-foreground)]",
    }
  );
}

export function getKeywordLevelBadgeStyle(level?: SuggestedKeyword["level"]) {
  if (level === "specific") {
    return "bg-emerald-500/10 text-emerald-500";
  }
  if (level === "medium") {
    return "bg-amber-500/10 text-amber-500";
  }
  if (level === "broad") {
    return "bg-rose-500/10 text-rose-500";
  }
  return "bg-[var(--muted)] text-[var(--muted-foreground)]";
}

export function findSuggestedKeywordMeta(
  keyword: string,
  suggestion?: KeywordSuggestion | null
): {
  level?: SuggestedKeyword["level"];
  score?: number;
  tokenCategory?: string;
} {
  if (!suggestion) return {};

  const kwInfo = suggestion.keywords.find((k) => k.keyword === keyword);
  const lowered = keyword.toLowerCase();
  const matchedTokens = suggestion.tokens
    .filter((t) => t.text && lowered.includes(t.text.toLowerCase()))
    .sort((a, b) => b.weight - a.weight);

  return {
    level: kwInfo?.level,
    score: kwInfo?.score,
    tokenCategory: matchedTokens[0]?.category,
  };
}
