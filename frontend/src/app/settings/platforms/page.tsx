"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Store, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import apiClient from "@/lib/api/client";
import { useUserStore } from "@/stores/useUserStore";
import type { User } from "@/types";

export default function NaverStoreSettingsPage() {
  const userId = useUserStore((s) => s.currentUserId);
  const queryClient = useQueryClient();
  const [storeName, setStoreName] = useState("");

  const { data: user, isLoading } = useQuery({
    queryKey: ["user", userId],
    queryFn: () =>
      apiClient.get<User>(`/users/${userId}`).then((r) => r.data),
    enabled: !!userId,
  });

  useEffect(() => {
    if (user?.naver_store_name) {
      setStoreName(user.naver_store_name);
    }
  }, [user]);

  const saveMutation = useMutation({
    mutationFn: (naver_store_name: string) =>
      apiClient.put(`/users/${userId}`, { naver_store_name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      toast.success("네이버 스토어명이 저장되었습니다");
    },
    onError: () => toast.error("저장에 실패했습니다"),
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(storeName.trim());
  };

  if (!userId) {
    return (
      <div className="py-20 text-center text-[var(--muted-foreground)]">
        사업체를 선택해주세요
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-6">네이버 스토어 설정</h1>

      {isLoading ? (
        <div className="skeleton h-40" />
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-emerald-500/10 p-2.5">
                <Store className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-medium">네이버 스토어명 (mallName)</h3>
                <p className="text-sm text-[var(--muted-foreground)]">
                  네이버 쇼핑에서 검색했을 때 표시되는 스토어명을 입력하세요
                </p>
              </div>
            </div>

            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="예: 내스토어, 공식스토어 등"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm outline-none focus:border-blue-500 transition-colors"
              maxLength={200}
            />

            <div className="mt-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-sm text-blue-600 dark:text-blue-400">
              스토어명을 등록하면 키워드 검색 결과에서 내 스토어의 순위를 자동으로 트래킹합니다. 네이버 쇼핑에서 내 상품을 검색하면 표시되는 판매자명(mallName)을 정확하게 입력해주세요.
            </div>

            {user?.naver_store_name && (
              <div className="mt-3 flex items-center gap-1.5 text-sm text-emerald-500">
                <Check className="h-4 w-4" />
                현재 설정: {user.naver_store_name}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={saveMutation.isPending || !storeName.trim()}
            className="w-full rounded-lg bg-blue-500 py-3 text-sm font-medium text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
            ) : (
              "저장"
            )}
          </button>
        </form>
      )}
    </div>
  );
}
