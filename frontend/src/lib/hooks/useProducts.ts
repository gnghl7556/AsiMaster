"use client";

import { useQuery } from "@tanstack/react-query";
import { productsApi } from "@/lib/api/products";
import { useUserStore } from "@/stores/useUserStore";
import { useProductStore } from "@/stores/useProductStore";

interface UseProductListOptions {
  page?: number;
  limit?: number;
  refetchInterval?: number | false;
  ignoreStoreFilters?: boolean;
}

export function useProductList(options?: UseProductListOptions) {
  const userId = useUserStore((s) => s.currentUserId);
  const sortBy = useProductStore((s) => s.sortBy);
  const category = useProductStore((s) => s.category);
  const search = useProductStore((s) => s.search);
  const ignoreStoreFilters = options?.ignoreStoreFilters ?? false;
  const page = options?.page;
  const limit = options?.limit;
  const effectiveSort = ignoreStoreFilters ? undefined : sortBy;
  const effectiveCategory = ignoreStoreFilters ? undefined : category;
  const effectiveSearch = ignoreStoreFilters ? undefined : search;

  return useQuery({
    queryKey: [
      "products",
      userId,
      ignoreStoreFilters ? "all" : "filtered",
      effectiveSort ?? null,
      effectiveCategory ?? null,
      effectiveSearch ?? null,
      page ?? null,
      limit ?? null,
    ],
    queryFn: () =>
      productsApi.getList(userId!, {
        sort: effectiveSort,
        category: effectiveCategory || undefined,
        search: effectiveSearch || undefined,
        page,
        limit,
      }),
    enabled: !!userId,
    refetchInterval: options?.refetchInterval === undefined ? 60000 : options.refetchInterval,
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
