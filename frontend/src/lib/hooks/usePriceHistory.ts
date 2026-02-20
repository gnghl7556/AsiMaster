"use client";

import { useQuery } from "@tanstack/react-query";
import { pricesApi } from "@/lib/api/prices";

export function usePriceHistory(
  productId: number | null,
  period: "1d" | "7d" | "30d" = "7d"
) {
  return useQuery({
    queryKey: ["price-history", productId, period],
    queryFn: () => pricesApi.getHistory(productId!, period),
    enabled: !!productId,
  });
}

export function usePriceSnapshot(productId: number | null) {
  return useQuery({
    queryKey: ["price-snapshot", productId],
    queryFn: () => pricesApi.getSnapshot(productId!),
    enabled: !!productId,
  });
}
