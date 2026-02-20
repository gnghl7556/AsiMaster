"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { costsApi } from "@/lib/api/costs";

export function useMargin(productId: number | null) {
  return useQuery({
    queryKey: ["margin", productId],
    queryFn: () => costsApi.getMargin(productId!),
    enabled: !!productId,
  });
}

export function useMarginSimulation(productId: number | null) {
  return useMutation({
    mutationFn: (selling_price: number) =>
      costsApi.simulateMargin(productId!, selling_price),
  });
}
