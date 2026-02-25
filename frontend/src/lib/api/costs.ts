import type { MarginDetail } from "@/types";
import apiClient from "./client";

export interface CostItemInput {
  name: string;
  type: "percent" | "fixed";
  value: number;
}

export interface CostPreset {
  id: number;
  user_id?: number;
  name: string;
  items: CostItemInput[];
  created_at: string;
}

export interface ProductCostItem {
  id: number;
  product_id: number;
  name: string;
  type: "percent" | "fixed";
  value: number;
  sort_order: number;
  created_at: string;
}

export const costsApi = {
  getItems: (userId: number, productId: number) =>
    apiClient
      .get<ProductCostItem[]>(`/products/${productId}/costs`)
      .then((r) => r.data),

  saveItems: (userId: number, productId: number, items: CostItemInput[]) =>
    apiClient
      .put(`/products/${productId}/costs`, items.map((item, index) => ({ ...item, sort_order: index })))
      .then((r) => r.data),

  getMargin: (productId: number) =>
    apiClient
      .get<MarginDetail>(`/products/${productId}/margin`)
      .then((r) => r.data),

  simulateMargin: (productId: number, selling_price: number) =>
    apiClient
      .post<MarginDetail>(`/products/${productId}/margin/simulate`, { selling_price })
      .then((r) => r.data),

  getPresets: (userId: number) =>
    apiClient
      .get<CostPreset[]>(`/users/${userId}/cost-presets`)
      .then((r) => r.data),

  createPreset: (userId: number, data: { name: string; items: CostItemInput[] }) =>
    apiClient
      .post<CostPreset>(`/users/${userId}/cost-presets`, data)
      .then((r) => r.data),

  deletePreset: (userId: number, presetId: number) =>
    apiClient.delete(`/cost-presets/${presetId}`),
};
