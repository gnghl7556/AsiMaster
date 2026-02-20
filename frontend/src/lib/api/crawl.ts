import apiClient from "./client";

export const crawlApi = {
  crawlProduct: (productId: number) =>
    apiClient.post(`/crawl/product/${productId}`).then((r) => r.data),

  crawlUser: (userId: number) =>
    apiClient.post(`/crawl/user/${userId}`).then((r) => r.data),
};
