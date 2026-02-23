import type { KeywordSuggestion, SearchKeyword } from "@/types";
import apiClient from "./client";

export const keywordsApi = {
  getList: (productId: number) =>
    apiClient
      .get<SearchKeyword[]>(`/products/${productId}/keywords`)
      .then((r) => r.data),

  create: (productId: number, data: { keyword: string; sort_type: "sim" | "asc" }) =>
    apiClient
      .post<SearchKeyword>(`/products/${productId}/keywords`, data)
      .then((r) => r.data),

  suggest: (productName: string, storeName?: string, categoryHint?: string) =>
    apiClient
      .post<KeywordSuggestion>("/keywords/suggest", {
        product_name: productName,
        store_name: storeName,
        category_hint: categoryHint,
      })
      .then((r) => r.data),

  delete: (keywordId: number) =>
    apiClient.delete(`/keywords/${keywordId}`),
};
