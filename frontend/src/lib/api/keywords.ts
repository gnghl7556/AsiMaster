import type { SearchKeyword } from "@/types";
import apiClient from "./client";

export interface CreateKeywordRequest {
  keyword: string;
  sort_type?: "sim" | "asc";
}

export const keywordsApi = {
  getList: (productId: number) =>
    apiClient
      .get<SearchKeyword[]>(`/products/${productId}/keywords`)
      .then((r) => r.data),

  create: (productId: number, data: CreateKeywordRequest) =>
    apiClient
      .post<SearchKeyword>(`/products/${productId}/keywords`, {
        keyword: data.keyword,
        sort_type: data.sort_type ?? "sim",
      })
      .then((r) => r.data),

  delete: (keywordId: number) =>
    apiClient.delete(`/keywords/${keywordId}`),
};
