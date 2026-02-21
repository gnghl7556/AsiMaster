"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { keywordsApi, type CreateKeywordRequest } from "@/lib/api/keywords";

export function useKeywords(productId: number) {
  return useQuery({
    queryKey: ["keywords", productId],
    queryFn: () => keywordsApi.getList(productId),
    enabled: !!productId,
  });
}

export function useCreateKeyword(productId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateKeywordRequest) =>
      keywordsApi.create(productId, {
        keyword: payload.keyword,
        sort_type: payload.sort_type ?? "sim",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["keywords", productId] });
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      toast.success("키워드가 추가되었습니다");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || "키워드 추가 실패";
      toast.error(msg);
    },
  });
}

export function useDeleteKeyword(productId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (keywordId: number) => keywordsApi.delete(keywordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["keywords", productId] });
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      toast.success("키워드가 삭제되었습니다");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || "키워드 삭제 실패";
      toast.error(msg);
    },
  });
}
