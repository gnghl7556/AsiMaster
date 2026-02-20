"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { ProductList } from "@/components/products/ProductList";
import { useUserStore } from "@/stores/useUserStore";

export default function ProductsPage() {
  const userId = useUserStore((s) => s.currentUserId);

  if (!userId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--muted-foreground)]">
        <p>사업체를 먼저 선택해주세요</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">상품 관리</h1>
        <Link
          href="/products/new"
          className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          상품 등록
        </Link>
      </div>
      <ProductList />
    </div>
  );
}
