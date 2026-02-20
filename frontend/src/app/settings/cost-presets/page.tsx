"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import apiClient from "@/lib/api/client";
import { useUserStore } from "@/stores/useUserStore";
import { CostPresetForm } from "@/components/settings/CostPresetForm";

interface CostPreset {
  id: number;
  name: string;
  items: { name: string; type: string; value: number }[];
  created_at: string;
}

export default function CostPresetsPage() {
  const userId = useUserStore((s) => s.currentUserId);
  const [showForm, setShowForm] = useState(false);

  const { data: presets = [], isLoading } = useQuery({
    queryKey: ["cost-presets", userId],
    queryFn: () =>
      apiClient.get<CostPreset[]>(`/users/${userId}/cost-presets`).then((r) => r.data),
    enabled: !!userId,
  });

  if (!userId) return <div className="py-20 text-center text-[var(--muted-foreground)]">사업체를 선택해주세요</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">비용 프리셋</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            프리셋 추가
          </button>
        )}
      </div>

      {showForm && <CostPresetForm onClose={() => setShowForm(false)} />}

      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-20" />)}</div>
        ) : presets.length === 0 && !showForm ? (
          <div className="py-20 text-center text-[var(--muted-foreground)]">
            <p>등록된 프리셋이 없습니다</p>
            <p className="text-sm mt-1">플랫폼별 수수료 템플릿을 만들어보세요</p>
          </div>
        ) : (
          <div className="space-y-3">
            {presets.map((preset) => (
              <div key={preset.id} className="glass-card p-4">
                <h3 className="font-medium">{preset.name}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {preset.items.map((item, i) => (
                    <span key={i} className="rounded-full bg-[var(--muted)] px-2.5 py-0.5 text-xs">
                      {item.name}: {item.type === "percent" ? `${item.value}%` : `${item.value.toLocaleString()}원`}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
