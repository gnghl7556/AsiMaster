import type {
  Product,
  ProductListItem,
  ProductDetail,
  SortOption,
  ExcludedProduct,
  StoreProduct,
  StoreImportResult,
} from "@/types";
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
      .get<ProductDetail>(`/products/${productId}`)
      .then((r) => r.data),

  create: (userId: number, data: { name: string; category?: string; cost_price: number; selling_price: number; image_url?: string }) =>
    apiClient.post<Product>(`/users/${userId}/products`, data).then((r) => r.data),

  update: (userId: number, productId: number, data: Partial<Product>) =>
    apiClient.put<Product>(`/products/${productId}`, data).then((r) => r.data),

  delete: (userId: number, productId: number) =>
    apiClient.delete(`/products/${productId}`),

  bulkDelete: (userId: number, productIds: number[]) =>
    apiClient.post<{ deleted: number }>(`/users/${userId}/products/bulk-delete`, {
      product_ids: productIds,
    }).then((r) => r.data),

  togglePriceLock: (userId: number, productId: number, is_locked: boolean, reason?: string) =>
    apiClient
      .patch<Product>(`/products/${productId}/price-lock`, { is_locked, reason })
      .then((r) => r.data),

  getExcluded: (productId: number) =>
    apiClient
      .get<ExcludedProduct[]>(`/products/${productId}/excluded`)
      .then((r) => r.data),

  excludeProduct: (productId: number, data: { naver_product_id: string; naver_product_name?: string; mall_name?: string }) =>
    apiClient
      .post<ExcludedProduct>(`/products/${productId}/excluded`, data)
      .then((r) => r.data),

  unexcludeProduct: (productId: number, naverProductId: string) =>
    apiClient.delete(`/products/${productId}/excluded/${naverProductId}`),

  previewStoreProducts: (userId: number, storeUrl: string) =>
    apiClient
      .get<StoreProduct[]>(`/users/${userId}/store/products`, { params: { store_url: storeUrl } })
      .then((r) => r.data),

  importStoreProducts: (
    userId: number,
    products: { name: string; selling_price: number; image_url?: string; category?: string }[]
  ) =>
    apiClient
      .post<StoreImportResult>(`/users/${userId}/store/import`, { products })
      .then((r) => r.data),
};
