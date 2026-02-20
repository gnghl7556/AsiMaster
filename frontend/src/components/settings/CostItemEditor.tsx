"use client";

import type { CostItemInput } from "@/lib/api/costs";

interface Props {
  item: CostItemInput;
  onChange: (item: CostItemInput) => void;
}

export function CostItemEditor({ item, onChange }: Props) {
  return (
    <div className="flex flex-1 items-center gap-2">
      <input
        type="text"
        value={item.name}
        onChange={(e) => onChange({ ...item, name: e.target.value })}
        placeholder="항목명"
        className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 transition-colors"
      />
      <select
        value={item.type}
        onChange={(e) =>
          onChange({ ...item, type: e.target.value as "percent" | "fixed" })
        }
        className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm outline-none"
      >
        <option value="percent">%</option>
        <option value="fixed">원</option>
      </select>
      <input
        type="number"
        value={item.value || ""}
        onChange={(e) => onChange({ ...item, value: Number(e.target.value) })}
        placeholder="0"
        className="w-20 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-sm text-right outline-none focus:border-blue-500 transition-colors tabular-nums"
      />
    </div>
  );
}
