import type { Competitor } from "@/types";
import apiClient from "./client";

export const competitorsApi = {
  getList: (productId: number) =>
    apiClient
      .get<Competitor[]>(`/products/${productId}/competitors`)
      .then((r) => r.data),

  create: (productId: number, data: { url: string; platform_id?: number }) =>
    apiClient
      .post<Competitor>(`/products/${productId}/competitors`, data)
      .then((r) => r.data),

  delete: (competitorId: number) =>
    apiClient.delete(`/competitors/${competitorId}`),

  update: (competitorId: number, data: { is_active?: boolean }) =>
    apiClient.put(`/competitors/${competitorId}`, data),
};
