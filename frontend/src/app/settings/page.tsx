"use client";

import Link from "next/link";
import { Globe, DollarSign } from "lucide-react";

const SETTINGS_ITEMS = [
  {
    href: "/settings/platforms",
    icon: Globe,
    label: "플랫폼 설정",
    description: "크롤링 대상 플랫폼 ON/OFF 및 주기 설정",
  },
  {
    href: "/settings/cost-presets",
    icon: DollarSign,
    label: "비용 프리셋",
    description: "플랫폼별 수수료 템플릿 관리",
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
