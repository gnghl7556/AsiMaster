"use client";

import Link from "next/link";
import { Store, DollarSign, Download, Bell } from "lucide-react";

const SETTINGS_ITEMS = [
  {
    href: "/settings/platforms",
    icon: Store,
    label: "네이버 스토어 설정",
    description: "내 네이버 스토어명을 등록하여 검색 결과에서 내 노출 순위를 트래킹합니다",
  },
  {
    href: "/settings/cost-presets",
    icon: DollarSign,
    label: "비용 프리셋",
    description: "플랫폼별 수수료 템플릿 관리",
  },
  {
    href: "/settings/store-import",
    icon: Download,
    label: "상품 불러오기",
    description: "스마트스토어에서 판매 중인 상품을 자동으로 불러옵니다",
  },
  {
    href: "/settings/notifications",
    icon: Bell,
    label: "알림 설정",
    description: "푸시 알림 구독 및 알림 방식을 설정합니다",
  },
];

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-6">설정</h1>
      <div className="space-y-3">
        {SETTINGS_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="glass-card flex items-center gap-4 p-4 transition-all hover:scale-[1.01]"
          >
            <div className="rounded-lg bg-[var(--muted)] p-2.5">
              <item.icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-medium">{item.label}</h3>
              <p className="text-sm text-[var(--muted-foreground)]">{item.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
