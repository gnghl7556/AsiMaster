import type { MarginDetail, CostItemCalculated } from "@/types";
import apiClient from "./client";

export interface CostItemInput {
  name: string;
  type: "percent" | "fixed";
  value: number;
}

export interface CostPreset {
  id: number;
  name: string;
  items: CostItemInput[];
  created_at: string;
}

export const costsApi = {
  getItems: (userId: number, productId: number) =>
    apiClient
      .get<CostItemCalculated[]>(`/users/${userId}/products/${productId}/costs`)
      .then((r) => r.data),

  saveItems: (userId: number, productId: number, items: CostItemInput[]) =>
    apiClient
      .put(`/users/${userId}/products/${productId}/costs`, { items })
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
    apiClient.delete(`/users/${userId}/cost-presets/${presetId}`),
};
