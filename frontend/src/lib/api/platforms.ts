import type { Platform, UserPlatform } from "@/types";
import apiClient from "./client";

export const platformsApi = {
  getAll: () =>
    apiClient.get<Platform[]>("/platforms").then((r) => r.data),

  getUserPlatforms: (userId: number) =>
    apiClient
      .get<UserPlatform[]>(`/users/${userId}/platforms`)
      .then((r) => r.data),

  updateUserPlatform: (
    userId: number,
    platformId: number,
    data: { is_active?: boolean; crawl_interval_min?: number }
  ) =>
    apiClient
      .put<UserPlatform>(`/users/${userId}/platforms/${platformId}`, data)
      .then((r) => r.data),
};
