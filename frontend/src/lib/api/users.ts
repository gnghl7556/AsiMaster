import type { User } from "@/types";
import apiClient from "./client";

export const usersApi = {
  getAll: () => apiClient.get<User[]>("/users").then((r) => r.data),
  create: (name: string, password?: string) =>
    apiClient.post<User>("/users", { name, ...(password ? { password } : {}) }).then((r) => r.data),
  update: (id: number, data: { name?: string; naver_store_name?: string; crawl_interval_min?: number; password?: string; remove_password?: boolean; telegram_chat_id?: string }) =>
    apiClient.put<User>(`/users/${id}`, data).then((r) => r.data),
  delete: (id: number) => apiClient.delete(`/users/${id}`),
  telegramTest: (id: number) =>
    apiClient.post<{ ok: boolean }>(`/users/${id}/telegram-test`).then((r) => r.data),
  verifyPassword: (id: number, password: string) =>
    apiClient.post<{ verified: boolean }>(`/users/${id}/verify-password`, { password }).then((r) => r.data),
};
