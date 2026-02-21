"use client";

import { AnimatePresence } from "framer-motion";
import { useProductList } from "@/lib/hooks/useProducts";
import { SortDropdown } from "./SortDropdown";
import { SummaryBar } from "./SummaryBar";
import { ProductCard } from "./ProductCard";
import { PriceLockSection } from "./PriceLockSection";

interface Props {
  hideMeta?: boolean;
}

export function ProductList({ hideMeta = false }: Props) {
  const { data: products, isLoading } = useProductList();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--muted-foreground)]">
        <p className="text-lg font-medium">등록된 상품이 없습니다</p>
        <p className="text-sm mt-1">상품을 등록하고 경쟁사 가격을 모니터링하세요</p>
      </div>
    );
  }

  const activeProducts = products.filter((p) => !p.is_price_locked);
  const lockedProducts = products.filter((p) => p.is_price_locked);
  return (
    <div>
      {!hideMeta && (
        <>
          {/* 상단: 정렬 */}
          <div className="flex items-center justify-between mb-4">
            <SortDropdown />
          </div>
          {/* 관리 중 섹션 */}
          <div className="mb-2 text-sm font-medium text-[var(--muted-foreground)]">
            관리 중 ({activeProducts.length}개)
          </div>
        </>
      )}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {activeProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </AnimatePresence>
      </div>

      {/* 가격고정 섹션 */}
      <PriceLockSection products={lockedProducts} />

      {/* 요약바 */}
      <div className="mt-4">
        <SummaryBar products={products} />
      </div>
    </div>
  );
}
