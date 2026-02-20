"use client";

import { useQuery } from "@tanstack/react-query";
import { productsApi } from "@/lib/api/products";
import { useUserStore } from "@/stores/useUserStore";
import { useProductStore } from "@/stores/useProductStore";

export function useProductList() {
  const userId = useUserStore((s) => s.currentUserId);
  const sortBy = useProductStore((s) => s.sortBy);
  const category = useProductStore((s) => s.category);
  const search = useProductStore((s) => s.search);

  return useQuery({
    queryKey: ["products", userId, sortBy, category, search],
    queryFn: () =>
      productsApi.getList(userId!, {
        sort: sortBy,
        category: category || undefined,
        search: search || undefined,
      }),
    enabled: !!userId,
    refetchInterval: 60000,
  });
}

export function useProductDetail(productId: number) {
  const userId = useUserStore((s) => s.currentUserId);

  return useQuery({
    queryKey: ["products", userId, productId],
    queryFn: () => productsApi.getDetail(userId!, productId),
    enabled: !!userId && !!productId,
  });
}
