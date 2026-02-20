"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useProductStore } from "@/stores/useProductStore";
import { SORT_OPTIONS } from "@/lib/utils/constants";

export function SortDropdown() {
  const { sortBy, setSortBy } = useProductStore();
  const [open, setOpen] = useState(false);
  const currentLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--muted)] transition-colors"
      >
        {currentLabel}
        <ChevronDown className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setSortBy(option.value);
                  setOpen(false);
                }}
                className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--muted)] transition-colors ${
                  sortBy === option.value ? "bg-[var(--muted)] font-medium" : ""
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
