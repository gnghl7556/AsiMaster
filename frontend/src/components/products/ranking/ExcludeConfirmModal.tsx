"use client";

import { Ban, Loader2 } from "lucide-react";
import type { KeywordDetail } from "@/types";
import { isMyExactProduct } from "./rankingUtils";

interface ExcludeTarget {
  naver_product_id: string;
  product_name: string;
  mall_name: string;
}

interface Props {
  excludeTarget: ExcludeTarget;
  keywords: KeywordDetail[];
  myProductNaverId: string | null;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ExcludeConfirmModal({
  excludeTarget,
  keywords,
  myProductNaverId,
  isPending,
  onConfirm,
  onCancel,
}: Props) {
  const targetProductId = excludeTarget.naver_product_id;
  const matches = keywords.flatMap((kw) =>
    kw.rankings
      .filter(
        (item) =>
          !isMyExactProduct(item, myProductNaverId) &&
          !!item.naver_product_id &&
          item.naver_product_id === targetProductId
      )
      .map((item) => ({ item, keywordId: kw.id }))
  );
  const keywordCount = new Set(matches.map((match) => match.keywordId)).size;
  const uniqueProductCount = new Set(
    matches.map(
      (match) =>
        match.item.naver_product_id ||
        `${match.item.mall_name}:${match.item.product_name}`
    )
  ).size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass-card mx-4 w-full max-w-sm p-6 space-y-4">
        <div>
          <h3 className="text-lg font-bold">상품 제외 확인</h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            같은 상품이 다른 키워드 결과에 함께 노출된 경우 같이 제외될 수
            있습니다.
          </p>
          {matches.length > 0 && (
            <p className="mt-1 text-xs text-amber-500">
              현재 로드된 결과 기준 {matches.length}개 노출행
              {uniqueProductCount > 0 &&
                ` · 상품 ${uniqueProductCount}개`}
              {keywordCount > 1
                ? ` (키워드 ${keywordCount}개)`
                : ""}{" "}
              이 영향을 받을 수 있습니다.
            </p>
          )}
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-3">
          <div className="text-xs text-[var(--muted-foreground)]">판매자</div>
          <div className="truncate text-sm font-medium">
            {excludeTarget.mall_name}
          </div>
          <div className="mt-2 text-xs text-[var(--muted-foreground)]">
            선택 상품
          </div>
          <div className="line-clamp-2 text-sm">
            {excludeTarget.product_name}
          </div>
          <div className="mt-2 text-xs text-[var(--muted-foreground)]">
            상품코드
          </div>
          <div className="truncate font-mono text-xs">
            {excludeTarget.naver_product_id}
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-sm font-medium hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Ban className="h-4 w-4" />
            )}
            제외
          </button>
        </div>
      </div>
    </div>
  );
}
