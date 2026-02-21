import type { SearchKeyword } from "@/types";
import apiClient from "./client";

export const keywordsApi = {
  getList: (productId: number) =>
    apiClient
      .get<SearchKeyword[]>(`/products/${productId}/keywords`)
      .then((r) => r.data),

  create: (productId: number, keyword: string) =>
    apiClient
      .post<SearchKeyword>(`/products/${productId}/keywords`, { keyword })
      .then((r) => r.data),

  delete: (keywordId: number) =>
    apiClient.delete(`/keywords/${keywordId}`),
};
