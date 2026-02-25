"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useUserStore } from "@/stores/useUserStore";
import { CostPresetForm } from "@/components/settings/CostPresetForm";
import { costsApi, type CostPreset } from "@/lib/api/costs";

export default function CostPresetsPage() {
  const userId = useUserStore((s) => s.currentUserId);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingPreset, setEditingPreset] = useState<CostPreset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CostPreset | null>(null);

  const { data: presets = [], isLoading } = useQuery({
    queryKey: ["cost-presets", userId],
    queryFn: () => costsApi.getPresets(userId!),
    enabled: !!userId,
  });

  const deleteMutation = useMutation({
    mutationFn: (presetId: number) => costsApi.deletePreset(userId!, presetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost-presets"] });
      toast.success("프리셋이 삭제되었습니다");
      setDeleteTarget(null);
    },
    onError: () => toast.error("프리셋 삭제에 실패했습니다"),
  });

  if (!userId) return <div className="py-20 text-center text-[var(--muted-foreground)]">사업체를 선택해주세요</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">비용 프리셋</h1>
        {!showForm && !editingPreset && (
          <button
            onClick={() => {
              setEditingPreset(null);
              setShowForm(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            프리셋 추가
          </button>
        )}
      </div>

      {(showForm || editingPreset) && (
        <CostPresetForm
          initialPreset={editingPreset}
          onClose={() => {
            setShowForm(false);
            setEditingPreset(null);
          }}
        />
      )}

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
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-medium">{preset.name}</h3>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setEditingPreset(preset);
                      }}
                      className="rounded p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
                      title="프리셋 수정"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(preset)}
                      className="rounded p-1.5 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-500 transition-colors"
                      title="프리셋 삭제"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
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

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-card mx-4 w-full max-w-sm p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold">비용 프리셋 삭제</h3>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                <strong>{deleteTarget.name}</strong> 프리셋을 삭제하시겠습니까?
                <br />
                이미 상품에 적용된 비용 항목은 유지됩니다.
              </p>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteMutation.isPending}
                className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-sm font-medium hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
