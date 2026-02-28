"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { crawlApi } from "@/lib/api/crawl";
import type { DashboardSummary, ProductDetail, ProductListItem } from "@/types";

function getCrawlErrorMessage(err: any, fallback: string) {
  const status = err?.response?.status;
  const detail = err?.response?.data?.detail;
  if (status === 409) {
    return detail || "이미 크롤링이 진행 중입니다";
  }
  return detail || fallback;
}

export function useCrawlProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: number) => crawlApi.crawlProduct(productId),
    onSuccess: async (_, productId) => {
      const now = new Date().toISOString();

      queryClient.setQueriesData(
        { queryKey: ["products"] },
        (old: ProductListItem[] | undefined) =>
          old?.map((item) =>
            item.id === productId ? { ...item, last_crawled_at: now } : item
          )
      );

      queryClient.setQueriesData(
        { queryKey: ["product-detail"] },
        (old: ProductDetail | undefined) =>
          old?.id === productId ? { ...old, last_crawled_at: now } : old
      );

      queryClient.setQueriesData(
        { queryKey: ["dashboard"] },
        (old: DashboardSummary | undefined) =>
          old ? { ...old, last_crawled_at: now } : old
      );

      // Invalidate the product list (status/price may change after crawl)
      queryClient.invalidateQueries({ queryKey: ["products"] });
      // Only invalidate the specific product's detail, keywords, and price snapshot
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return key[0] === "product-detail" && key[2] === productId;
        },
      });
      queryClient.invalidateQueries({ queryKey: ["keywords", productId] });
      queryClient.invalidateQueries({ queryKey: ["price-snapshot", productId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("크롤링이 완료되었습니다");
    },
    onError: (err: any) => toast.error(getCrawlErrorMessage(err, "크롤링 실패")),
  });
}

export function useCrawlAll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) => crawlApi.crawlUser(userId),
    onSuccess: async () => {
      const now = new Date().toISOString();

      queryClient.setQueriesData(
        { queryKey: ["products"] },
        (old: ProductListItem[] | undefined) =>
          old?.map((item) => ({ ...item, last_crawled_at: now }))
      );

      queryClient.setQueriesData(
        { queryKey: ["product-detail"] },
        (old: ProductDetail | undefined) =>
          old ? { ...old, last_crawled_at: now } : old
      );

      queryClient.setQueriesData(
        { queryKey: ["dashboard"] },
        (old: DashboardSummary | undefined) =>
          old ? { ...old, last_crawled_at: now } : old
      );

      queryClient.invalidateQueries();
      toast.success("전체 크롤링이 완료되었습니다");
    },
    onError: (err: any) => toast.error(getCrawlErrorMessage(err, "크롤링 실패")),
  });
}
