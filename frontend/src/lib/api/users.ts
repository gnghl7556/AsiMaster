import type { User } from "@/types";
import apiClient from "./client";

export const usersApi = {
  getAll: () => apiClient.get<User[]>("/users").then((r) => r.data),
  create: (name: string) => apiClient.post<User>("/users", { name }).then((r) => r.data),
  update: (id: number, data: { name?: string; naver_store_name?: string; crawl_interval_min?: number }) =>
    apiClient.put<User>(`/users/${id}`, data).then((r) => r.data),
  delete: (id: number) => apiClient.delete(`/users/${id}`),
};
