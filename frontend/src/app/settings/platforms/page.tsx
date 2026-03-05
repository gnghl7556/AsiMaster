"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Store, Loader2, Timer, Trash2, Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import apiClient from "@/lib/api/client";
import { usersApi } from "@/lib/api/users";
import { useUserStore } from "@/stores/useUserStore";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { User } from "@/types";

export default function NaverStoreSettingsPage() {
  const userId = useUserStore((s) => s.currentUserId);
  const setCurrentUser = useUserStore((s) => s.setCurrentUser);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [storeName, setStoreName] = useState("");
  const [crawlInterval, setCrawlInterval] = useState(60);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ["user", userId],
    queryFn: () =>
      apiClient.get<User>(`/users/${userId}`).then((r) => r.data),
    enabled: !!userId,
  });

  useEffect(() => {
    if (!user) return;
    setStoreName(user.naver_store_name ?? "");
    setCrawlInterval(user.crawl_interval_min ?? 60);
  }, [user]);

  const saveStoreMutation = useMutation({
    mutationFn: (naver_store_name: string) =>
      usersApi.update(userId!, { naver_store_name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("네이버 스토어명이 저장되었습니다");
    },
    onError: () => toast.error("저장에 실패했습니다"),
  });

  const saveCrawlMutation = useMutation({
    mutationFn: (crawl_interval_min: number) =>
      usersApi.update(userId!, { crawl_interval_min }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("크롤링 주기가 저장되었습니다");
    },
    onError: () => toast.error("저장에 실패했습니다"),
  });

  const savePasswordMutation = useMutation({
    mutationFn: (password: string) =>
      usersApi.update(userId!, { password }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setNewPassword("");
      toast.success("비밀번호가 설정되었습니다");
    },
    onError: () => toast.error("비밀번호 설정에 실패했습니다"),
  });

  const removePasswordMutation = useMutation({
    mutationFn: () =>
      usersApi.update(userId!, { remove_password: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("비밀번호가 해제되었습니다");
    },
    onError: () => toast.error("비밀번호 해제에 실패했습니다"),
  });

  const deleteBusinessMutation = useMutation({
    mutationFn: () => usersApi.delete(userId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setCurrentUser(null);
      router.push("/");
      toast.success("사업장이 삭제되었습니다");
    },
    onError: () => toast.error("사업장 삭제에 실패했습니다"),
  });

  const handleStoreSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveStoreMutation.mutate(storeName.trim());
  };

  const CRAWL_PRESETS = [
    { label: "30분", value: 30 },
    { label: "1시간", value: 60 },
    { label: "2시간", value: 120 },
    { label: "6시간", value: 360 },
    { label: "중지", value: 0 },
  ];

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
        <div className="skeleton h-56" />
      ) : (
        <div className="space-y-4">
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-emerald-500/10 p-2.5">
                <Store className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-medium">네이버 스토어명</h3>
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

            <form onSubmit={handleStoreSave}>
              <button
                type="submit"
                disabled={saveStoreMutation.isPending || !storeName.trim()}
                className="mt-4 w-full rounded-lg bg-blue-500 py-3 text-sm font-medium text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {saveStoreMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : (
                  "스토어명 저장"
                )}
              </button>
            </form>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-blue-500/10 p-2.5">
                <Timer className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-medium">자동 크롤링 주기</h3>
                <p className="text-sm text-[var(--muted-foreground)]">
                  설정한 주기마다 등록된 키워드의 가격/순위를 자동 수집합니다
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {CRAWL_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setCrawlInterval(preset.value)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    crawlInterval === preset.value
                      ? "border-blue-500/30 bg-blue-500/10 text-blue-500"
                      : "border-[var(--border)] hover:bg-[var(--muted)]"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => saveCrawlMutation.mutate(crawlInterval)}
              disabled={saveCrawlMutation.isPending || crawlInterval === user?.crawl_interval_min}
              className="mt-4 w-full rounded-lg bg-blue-500 py-3 text-sm font-medium text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {saveCrawlMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
              ) : (
                "크롤링 주기 저장"
              )}
            </button>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-amber-500/10 p-2.5">
                <Lock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <h3 className="font-medium">비밀번호 설정</h3>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {user?.has_password
                    ? "비밀번호가 설정되어 있습니다. 변경하거나 해제할 수 있습니다."
                    : "비밀번호를 설정하면 사업체 전환 시 인증이 필요합니다."}
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newPassword.trim().length >= 4) savePasswordMutation.mutate(newPassword.trim());
              }}
            >
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={user?.has_password ? "새 비밀번호 (4자 이상)" : "비밀번호 (4자 이상)"}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 pr-10 text-sm outline-none focus:border-blue-500 transition-colors"
                  minLength={4}
                  maxLength={100}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="submit"
                  disabled={savePasswordMutation.isPending || newPassword.trim().length < 4}
                  className="flex-1 rounded-lg bg-blue-500 py-3 text-sm font-medium text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {savePasswordMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  ) : user?.has_password ? (
                    "비밀번호 변경"
                  ) : (
                    "비밀번호 설정"
                  )}
                </button>
                {user?.has_password && (
                  <button
                    type="button"
                    onClick={() => removePasswordMutation.mutate()}
                    disabled={removePasswordMutation.isPending}
                    className="rounded-lg border border-[var(--border)] px-4 py-3 text-sm font-medium hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
                  >
                    {removePasswordMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "해제"
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="glass-card border border-red-500/30 bg-red-500/5 p-6">
            <h3 className="font-medium text-red-500">사업장 삭제</h3>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              사업장을 삭제하면 모든 상품, 키워드, 알림 데이터가 영구 삭제됩니다.
            </p>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              사업장 삭제
            </button>
          </div>

          <ConfirmDialog
            isOpen={showDeleteConfirm}
            onConfirm={() => deleteBusinessMutation.mutate()}
            onCancel={() => setShowDeleteConfirm(false)}
            title="사업장 삭제"
            message={
              <>
                정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                <br />
                <strong>{user?.name}</strong>
              </>
            }
            confirmText="삭제"
            variant="danger"
            isPending={deleteBusinessMutation.isPending}
            confirmIcon={<Trash2 className="h-4 w-4" />}
          />
        </div>
      )}
    </div>
  );
}
