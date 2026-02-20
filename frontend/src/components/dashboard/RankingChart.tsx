"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { useProductList } from "@/lib/hooks/useProducts";
import { STATUS_CONFIG } from "@/lib/utils/constants";

const STATUS_COLORS: Record<string, string> = {
  winning: "#22c55e",
  close: "#f59e0b",
  losing: "#ef4444",
};

export function RankingChart() {
  const { data: products = [], isLoading } = useProductList();

  if (isLoading) return <div className="skeleton h-48" />;

  const rankedProducts = products
    .filter((p) => p.ranking != null && !p.is_price_locked)
    .sort((a, b) => (a.ranking ?? 99) - (b.ranking ?? 99))
    .slice(0, 8);

  if (rankedProducts.length === 0) {
    return (
      <div className="glass-card p-4">
        <h3 className="font-medium mb-4">순위 현황</h3>
        <div className="flex h-32 items-center justify-center text-sm text-[var(--muted-foreground)]">
          순위 데이터가 없습니다
        </div>
      </div>
    );
  }

  const chartData = rankedProducts.map((p) => ({
    name: p.name.length > 8 ? p.name.slice(0, 8) + "..." : p.name,
    순위: p.ranking,
    status: p.status,
  }));

  return (
    <div className="glass-card p-4">
      <h3 className="font-medium mb-4">순위 현황</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} layout="vertical">
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            reversed
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number) => [`${value}위`, "순위"]}
          />
          <Bar dataKey="순위" radius={[0, 4, 4, 0]} maxBarSize={24}>
            {chartData.map((entry, index) => (
              <Cell
                key={index}
                fill={STATUS_COLORS[entry.status] || "#6b7280"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
