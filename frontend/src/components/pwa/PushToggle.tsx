"use client";

import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { usePushSubscription } from "@/lib/hooks/usePushSubscription";
import { useUserStore } from "@/stores/useUserStore";

export function PushToggle() {
  const userId = useUserStore((s) => s.currentUserId);
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe } =
    usePushSubscription(userId);

  const handleToggle = async () => {
    if (isSubscribed) {
      const ok = await unsubscribe();
      if (ok) toast.success("푸시 알림이 해제되었습니다");
    } else {
      const ok = await subscribe();
      if (ok) {
        toast.success("푸시 알림이 활성화되었습니다");
      } else if (permission === "denied") {
        toast.error("알림이 차단되어 있습니다. 브라우저 설정에서 허용해주세요.");
      }
    }
  };

  if (!isSupported) {
    return (
      <div className="glass-card p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[var(--muted)] p-2.5">
            <BellOff className="h-5 w-5 text-[var(--muted-foreground)]" />
          </div>
          <div>
            <h3 className="font-medium">푸시 알림</h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              이 브라우저에서 푸시 알림이 지원되지 않습니다
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[var(--muted)] p-2.5">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-medium">푸시 알림</h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              가격 변동, 순위 하락 시 알림을 받습니다
            </p>
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={isLoading}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            isSubscribed ? "bg-blue-500" : "bg-[var(--border)]"
          } ${isLoading ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
              isSubscribed ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {permission === "denied" && (
        <p className="mt-3 text-xs text-red-500">
          알림이 차단되었습니다. 브라우저 설정에서 허용해주세요.
        </p>
      )}

      <p className="mt-3 text-xs text-[var(--muted-foreground)]">
        iOS 16.4 이상, Android Chrome에서 지원됩니다
      </p>
    </div>
  );
}
