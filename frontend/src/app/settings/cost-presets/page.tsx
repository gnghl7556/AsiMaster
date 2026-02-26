"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";
import { useUserStore } from "@/stores/useUserStore";
import { CostPresetForm } from "@/components/settings/CostPresetForm";
import { costsApi, type CostPreset } from "@/lib/api/costs";
import { productsApi } from "@/lib/api/products";

export default function CostPresetsPage() {
  const userId = useUserStore((s) => s.currentUserId);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingPreset, setEditingPreset] = useState<CostPreset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CostPreset | null>(null);
  const [applyTarget, setApplyTarget] = useState<CostPreset | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());

  const { data: presets = [], isLoading } = useQuery({
    queryKey: ["cost-presets", userId],
    queryFn: () => costsApi.getPresets(userId!),
    enabled: !!userId,
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products", userId, "preset-apply-picker"],
    queryFn: () => productsApi.getList(userId!, { limit: 500 }),
    enabled: !!userId && !!applyTarget,
  });

  const deleteMutation = useMutation({
    mutationFn: (presetId: number) => costsApi.deletePreset(presetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost-presets"] });
      toast.success("프리셋이 삭제되었습니다");
      setDeleteTarget(null);
    },
    onError: () => toast.error("프리셋 삭제에 실패했습니다"),
  });
  const applyPresetMutation = useMutation({
    mutationFn: (params: { presetId: number; productIds: number[] }) =>
      costsApi.applyPreset(params.presetId, params.productIds),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      toast.success(
        `${result.applied}개 상품에 프리셋 적용 완료${
          result.skipped > 0 ? ` (${result.skipped}개 스킵)` : ""
        }`
      );
      setApplyTarget(null);
      setSelectedProductIds(new Set());
    },
    onError: () => toast.error("프리셋 적용에 실패했습니다"),
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
                        setApplyTarget(preset);
                        setSelectedProductIds(new Set());
                      }}
                      className="rounded px-2 py-1 text-xs text-blue-500 hover:bg-blue-500/10 transition-colors"
                    >
                      상품에 적용
                    </button>
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

      {applyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-card mx-4 w-full max-w-lg p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold">프리셋 상품 적용</h3>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                <strong>{applyTarget.name}</strong> 프리셋을 적용할 상품을 선택하세요.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 px-3 py-2">
              <button
                type="button"
                onClick={() => {
                  if (selectedProductIds.size === products.length) {
                    setSelectedProductIds(new Set());
                  } else {
                    setSelectedProductIds(new Set(products.map((p) => p.id)));
                  }
                }}
                className="inline-flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                {selectedProductIds.size > 0 && selectedProductIds.size === products.length ? (
                  <CheckSquare className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                전체 선택
              </button>
              <span className="text-xs text-[var(--muted-foreground)]">
                {selectedProductIds.size}개 선택됨
              </span>
            </div>

            <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
              {products.map((product) => {
                const checked = selectedProductIds.has(product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() =>
                      setSelectedProductIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(product.id)) next.delete(product.id);
                        else next.add(product.id);
                        return next;
                      })
                    }
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-[var(--muted)]/50"
                  >
                    {checked ? (
                      <CheckSquare className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Square className="h-4 w-4 text-[var(--muted-foreground)]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{product.name}</div>
                      <div className="truncate text-xs text-[var(--muted-foreground)]">
                        {product.category || "카테고리 미설정"}
                        {product.cost_preset_id != null && ` · 프리셋 적용됨(#${product.cost_preset_id})`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setApplyTarget(null);
                  setSelectedProductIds(new Set());
                }}
                disabled={applyPresetMutation.isPending}
                className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-sm font-medium hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() =>
                  applyPresetMutation.mutate({
                    presetId: applyTarget.id,
                    productIds: Array.from(selectedProductIds),
                  })
                }
                disabled={applyPresetMutation.isPending || selectedProductIds.size === 0}
                className="flex-1 rounded-xl bg-blue-500 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {applyPresetMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                적용
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
