import type { Product, ProductListItem, ProductDetail, SortOption } from "@/types";
import apiClient from "./client";

interface ProductListParams {
  sort?: SortOption;
  category?: string;
  search?: string;
  price_locked?: boolean;
}

export const productsApi = {
  getList: (userId: number, params?: ProductListParams) =>
    apiClient
      .get<ProductListItem[]>(`/users/${userId}/products`, { params })
      .then((r) => r.data),

  getDetail: (userId: number, productId: number) =>
    apiClient
      .get<ProductDetail>(`/users/${userId}/products/${productId}`)
      .then((r) => r.data),

  create: (userId: number, data: { name: string; category?: string; cost_price: number; selling_price: number; image_url?: string }) =>
    apiClient.post<Product>(`/users/${userId}/products`, data).then((r) => r.data),

  update: (userId: number, productId: number, data: Partial<Product>) =>
    apiClient.put<Product>(`/users/${userId}/products/${productId}`, data).then((r) => r.data),

  delete: (userId: number, productId: number) =>
    apiClient.delete(`/users/${userId}/products/${productId}`),

  togglePriceLock: (userId: number, productId: number, is_locked: boolean, reason?: string) =>
    apiClient
      .patch<Product>(`/users/${userId}/products/${productId}/price-lock`, { is_locked, reason })
      .then((r) => r.data),
};
