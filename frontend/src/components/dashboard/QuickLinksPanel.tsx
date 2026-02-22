"use client";

import Link from "next/link";
import { ArrowRight, Boxes, Download, Settings, Bell } from "lucide-react";

const LINKS = [
  {
    href: "/products",
    label: "상품 관리",
    desc: "가격/순위 모니터링 운영",
    icon: Boxes,
    color: "text-blue-500",
  },
  {
    href: "/settings/store-import",
    label: "상품 불러오기",
    desc: "스마트스토어 상품 일괄 등록",
    icon: Download,
    color: "text-emerald-500",
  },
  {
    href: "/alerts",
    label: "알림 확인",
    desc: "미확인 알림 및 이력 확인",
    icon: Bell,
    color: "text-amber-500",
  },
  {
    href: "/settings/platforms",
    label: "스토어 설정",
    desc: "스토어명/크롤링 주기 관리",
    icon: Settings,
    color: "text-violet-500",
  },
];

export function QuickLinksPanel() {
  return (
    <section className="glass-card p-4">
      <h3 className="mb-3 font-medium">빠른 진입</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-xl border border-[var(--border)] bg-[var(--card)]/70 px-3 py-3 transition-colors hover:bg-[var(--card)]"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="rounded-lg bg-[var(--muted)] p-2">
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{item.label}</div>
                  <div className="truncate text-[11px] text-[var(--muted-foreground)]">
                    {item.desc}
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

