"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { PriceHistoryItem } from "@/lib/api/prices";
import { usePriceHistory } from "@/lib/hooks/usePriceHistory";
import { formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

interface Props {
  competitorId: number | null;
  label?: string;
}

const PERIODS = [
  { key: "1d" as const, label: "1일" },
  { key: "7d" as const, label: "7일" },
  { key: "30d" as const, label: "30일" },
];

export function PriceTrendChart({ competitorId, label }: Props) {
  const [period, setPeriod] = useState<"1d" | "7d" | "30d">("7d");
  const { data: history = [], isLoading } = usePriceHistory(competitorId, period);

  const chartData = history.map((item) => ({
    time: new Date(item.crawled_at).toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
    }),
    가격: item.total_price,
  }));

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">{label || "가격 추이"}</h3>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                "rounded-md px-2 py-0.5 text-xs transition-colors",
                period === p.key
                  ? "bg-blue-500 text-white"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="skeleton h-48" />
      ) : chartData.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-[var(--muted-foreground)]">
          데이터가 없습니다
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              opacity={0.5}
            />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number) => [`${formatPrice(value)}원`, "가격"]}
            />
            <Line
              type="monotone"
              dataKey="가격"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#3b82f6" }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
