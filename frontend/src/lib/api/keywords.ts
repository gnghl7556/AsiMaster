import type { SearchKeyword } from "@/types";
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

  delete: (keywordId: number) =>
    apiClient.delete(`/keywords/${keywordId}`),
};
