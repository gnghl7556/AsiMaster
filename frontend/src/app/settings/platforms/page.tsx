"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import apiClient from "@/lib/api/client";
import { useUserStore } from "@/stores/useUserStore";
import type { UserPlatform } from "@/types";

export default function PlatformsPage() {
  const userId = useUserStore((s) => s.currentUserId);
  const queryClient = useQueryClient();

  const { data: platforms = [], isLoading } = useQuery({
    queryKey: ["user-platforms", userId],
    queryFn: () =>
      apiClient.get<UserPlatform[]>(`/users/${userId}/platforms`).then((r) => r.data),
    enabled: !!userId,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ platformId, is_active }: { platformId: number; is_active: boolean }) =>
      apiClient.put(`/users/${userId}/platforms/${platformId}`, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-platforms"] });
      toast.success("플랫폼 설정이 변경되었습니다");
    },
  });

  if (!userId) return <div className="py-20 text-center text-[var(--muted-foreground)]">사업체를 선택해주세요</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-6">플랫폼 설정</h1>
      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16" />)}</div>
      ) : (
        <div className="space-y-3">
          {platforms.map((p) => (
            <div key={p.id} className="glass-card flex items-center justify-between p-4">
              <div>
                <h3 className="font-medium">{p.platform_display_name}</h3>
                <p className="text-sm text-[var(--muted-foreground)]">
                  크롤링 주기: {p.crawl_interval_min}분
                </p>
              </div>
              <button
                onClick={() => toggleMutation.mutate({ platformId: p.platform_id, is_active: !p.is_active })}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  p.is_active ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    p.is_active ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
