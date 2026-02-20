import type { User } from "@/types";
import apiClient from "./client";

export const usersApi = {
  getAll: () => apiClient.get<User[]>("/users").then((r) => r.data),
  create: (name: string) => apiClient.post<User>("/users", { name }).then((r) => r.data),
  update: (id: number, name: string) => apiClient.put<User>(`/users/${id}`, { name }).then((r) => r.data),
  delete: (id: number) => apiClient.delete(`/users/${id}`),
};
