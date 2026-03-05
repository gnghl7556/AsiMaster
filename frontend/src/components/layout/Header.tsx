"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Plus, Bell, Lock, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useUserStore } from "@/stores/useUserStore";
import { usersApi } from "@/lib/api/users";
import { alertsApi } from "@/lib/api/alerts";
import { ThemeToggle } from "./ThemeToggle";
import type { User } from "@/types";

export function Header() {
  const { currentUserId, setCurrentUser } = useUserStore();
  const queryClient = useQueryClient();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  // 비밀번호 모달 상태
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [modalPassword, setModalPassword] = useState("");
  const [showModalPassword, setShowModalPassword] = useState(false);
  const [verifyError, setVerifyError] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.getAll,
  });
  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts", currentUserId],
    queryFn: () => alertsApi.getList(currentUserId!),
    enabled: !!currentUserId,
    refetchInterval: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: ({ name, password }: { name: string; password?: string }) =>
      usersApi.create(name, password),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setCurrentUser(user.id);
      setShowAdd(false);
      setNewName("");
      setNewPassword("");
    },
  });

  const verifyMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: number; password: string }) =>
      usersApi.verifyPassword(userId, password),
    onSuccess: (result, variables) => {
      if (result.verified) {
        setCurrentUser(variables.userId);
        closePendingModal();
      } else {
        setVerifyError(true);
      }
    },
  });

  // 자동선택: 비밀번호 없는 사업체만
  useEffect(() => {
    if (!currentUserId && users.length > 0) {
      const openUser = users.find((u) => !u.has_password);
      if (openUser) {
        setCurrentUser(openUser.id);
      }
    }
  }, [users, currentUserId, setCurrentUser]);

  const currentUser = users.find((u) => u.id === currentUserId);
  const unreadCount = alerts.filter((a) => !a.is_read).length;

  const handleSelectUser = (user: User) => {
    if (user.has_password) {
      setPendingUser(user);
      setModalPassword("");
      setVerifyError(false);
      setDropdownOpen(false);
    } else {
      setCurrentUser(user.id);
      setDropdownOpen(false);
    }
  };

  const closePendingModal = () => {
    setPendingUser(null);
    setModalPassword("");
    setShowModalPassword(false);
    setVerifyError(false);
  };

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingUser || !modalPassword) return;
    setVerifyError(false);
    verifyMutation.mutate({ userId: pendingUser.id, password: modalPassword });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createMutation.mutate({
      name: newName.trim(),
      password: newPassword || undefined,
    });
  };

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold hidden md:block">Asimaster</h1>

          {/* 사업체 드롭다운 */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
            >
              {currentUser?.name || "사업체 선택"}
              {currentUser?.has_password && <Lock className="h-3 w-3 text-[var(--muted-foreground)]" />}
              <ChevronDown className="h-4 w-4" />
            </button>

            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--muted)] transition-colors ${
                        user.id === currentUserId ? "bg-[var(--muted)] font-medium" : ""
                      }`}
                    >
                      <span className="flex-1">{user.name}</span>
                      {user.has_password && <Lock className="h-3 w-3 text-[var(--muted-foreground)]" />}
                    </button>
                  ))}
                  <hr className="my-1 border-[var(--border)]" />
                  {showAdd ? (
                    <form onSubmit={handleCreate} className="space-y-1.5 p-1.5">
                      <input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="사업체 이름"
                        className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1 text-sm"
                        autoFocus
                      />
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="비밀번호 (선택)"
                          className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1 pr-7 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                          tabIndex={-1}
                        >
                          {showNewPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      <button type="submit" className="w-full rounded-md bg-blue-500 px-2 py-1 text-xs text-white">
                        추가
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => setShowAdd(true)}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                    >
                      <Plus className="h-4 w-4" /> 사업체 추가
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/alerts"
            className="relative rounded-lg p-2 hover:bg-[var(--muted)] transition-colors"
            aria-label="알림"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* 비밀번호 인증 모달 */}
      {pendingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={closePendingModal}>
          <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2.5">
                <Lock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-medium">{pendingUser.name}</h3>
                <p className="text-sm text-[var(--muted-foreground)]">비밀번호를 입력하세요</p>
              </div>
            </div>

            <form onSubmit={handleVerifySubmit}>
              <div className="relative">
                <input
                  type={showModalPassword ? "text" : "password"}
                  value={modalPassword}
                  onChange={(e) => {
                    setModalPassword(e.target.value);
                    setVerifyError(false);
                  }}
                  placeholder="비밀번호"
                  className={`w-full rounded-lg border px-4 py-3 pr-10 text-sm outline-none transition-colors ${
                    verifyError
                      ? "border-red-500 focus:border-red-500"
                      : "border-[var(--border)] focus:border-blue-500"
                  } bg-[var(--card)]`}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowModalPassword(!showModalPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                  tabIndex={-1}
                >
                  {showModalPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {verifyError && (
                <p className="mt-1.5 text-xs text-red-500">비밀번호가 일치하지 않습니다</p>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={closePendingModal}
                  className="flex-1 rounded-lg border border-[var(--border)] py-2.5 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!modalPassword || verifyMutation.isPending}
                  className="flex-1 rounded-lg bg-blue-500 py-2.5 text-sm font-medium text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {verifyMutation.isPending ? "확인 중..." : "확인"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
