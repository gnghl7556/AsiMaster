"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Plus, Bell } from "lucide-react";
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
  const [showAdd, setShowAdd] = useState(false);

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
    mutationFn: (name: string) => usersApi.create(name),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setCurrentUser(user.id);
      setShowAdd(false);
      setNewName("");
    },
  });

  useEffect(() => {
    if (!currentUserId && users.length > 0) {
      setCurrentUser(users[0].id);
    }
  }, [users, currentUserId, setCurrentUser]);

  const currentUser = users.find((u) => u.id === currentUserId);
  const unreadCount = alerts.filter((a) => !a.is_read).length;

  return (
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
            <ChevronDown className="h-4 w-4" />
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
              <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      setCurrentUser(user.id);
                      setDropdownOpen(false);
                    }}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--muted)] transition-colors ${
                      user.id === currentUserId ? "bg-[var(--muted)] font-medium" : ""
                    }`}
                  >
                    {user.name}
                  </button>
                ))}
                <hr className="my-1 border-[var(--border)]" />
                {showAdd ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newName.trim()) createMutation.mutate(newName.trim());
                    }}
                    className="flex gap-1 p-1"
                  >
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="사업체 이름"
                      className="flex-1 rounded-md border border-[var(--border)] bg-transparent px-2 py-1 text-sm"
                      autoFocus
                    />
                    <button type="submit" className="rounded-md bg-blue-500 px-2 py-1 text-xs text-white">
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
  );
}
