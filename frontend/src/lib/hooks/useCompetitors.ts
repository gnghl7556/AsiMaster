"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { competitorsApi } from "@/lib/api/competitors";

export function useCompetitors(productId: number | null) {
  return useQuery({
    queryKey: ["competitors", productId],
    queryFn: () => competitorsApi.getList(productId!),
    enabled: !!productId,
  });
}

export function useAddCompetitor(productId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (url: string) => competitorsApi.create(productId, { url }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      toast.success("경쟁사가 추가되었습니다");
    },
    onError: () => toast.error("경쟁사 추가 실패"),
  });
}

export function useDeleteCompetitor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (competitorId: number) => competitorsApi.delete(competitorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      toast.success("경쟁사가 삭제되었습니다");
    },
  });
}
