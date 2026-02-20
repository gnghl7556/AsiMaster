import apiClient from "./client";

export interface PriceHistoryItem {
  competitor_id: number;
  price: number;
  shipping_fee: number;
  total_price: number;
  ranking: number | null;
  crawled_at: string;
}

export interface PriceSnapshot {
  competitor_id: number;
  seller_name: string | null;
  platform: string;
  price: number;
  shipping_fee: number;
  total_price: number;
  crawled_at: string;
}

export const pricesApi = {
  getHistory: (productId: number, period: "1d" | "7d" | "30d" = "7d") =>
    apiClient
      .get<PriceHistoryItem[]>(`/products/${productId}/price-history`, {
        params: { period },
      })
      .then((r) => r.data),

  getSnapshot: (productId: number) =>
    apiClient
      .get<PriceSnapshot[]>(`/products/${productId}/price-snapshot`)
      .then((r) => r.data),
};
