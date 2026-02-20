"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { crawlApi } from "@/lib/api/crawl";

export function useCrawlProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: number) => crawlApi.crawlProduct(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
      queryClient.invalidateQueries({ queryKey: ["price-snapshot"] });
      toast.success("크롤링이 완료되었습니다");
    },
    onError: () => toast.error("크롤링 실패"),
  });
}

export function useCrawlAll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) => crawlApi.crawlUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("전체 크롤링이 완료되었습니다");
    },
    onError: () => toast.error("크롤링 실패"),
  });
}
