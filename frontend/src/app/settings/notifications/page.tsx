"use client";

import { PushToggle } from "@/components/pwa/PushToggle";

export default function NotificationsSettingsPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-6">알림 설정</h1>
      <div className="space-y-4">
        <PushToggle />
      </div>
    </div>
  );
}
