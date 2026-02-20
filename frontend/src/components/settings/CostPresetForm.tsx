"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { costsApi, type CostItemInput } from "@/lib/api/costs";
import { useUserStore } from "@/stores/useUserStore";
import { CostItemEditor } from "./CostItemEditor";

interface Props {
  onClose: () => void;
}

export function CostPresetForm({ onClose }: Props) {
  const userId = useUserStore((s) => s.currentUserId);
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [items, setItems] = useState<CostItemInput[]>([
    { name: "", type: "percent", value: 0 },
  ]);

  const createMutation = useMutation({
    mutationFn: () => costsApi.createPreset(userId!, { name, items: items.filter((i) => i.name) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost-presets"] });
      toast.success("프리셋이 생성되었습니다");
      onClose();
    },
    onError: () => toast.error("프리셋 생성 실패"),
  });

  const addItem = () => setItems([...items, { name: "", type: "percent", value: 0 }]);

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const updateItem = (index: number, updated: CostItemInput) => {
    const newItems = [...items];
    newItems[index] = updated;
    setItems(newItems);
  };

  return (
    <div className="glass-card p-4 space-y-4">
      <h3 className="font-medium">새 프리셋 만들기</h3>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="프리셋 이름 (예: 네이버 수수료)"
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
      />

      <div className="space-y-2">
        <div className="text-sm text-[var(--muted-foreground)]">비용 항목</div>
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <CostItemEditor
              item={item}
              onChange={(updated) => updateItem(i, updated)}
            />
            {items.length > 1 && (
              <button
                onClick={() => removeItem(i)}
                className="shrink-0 rounded p-1 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addItem}
          className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600"
        >
          <Plus className="h-3.5 w-3.5" />
          항목 추가
        </button>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => createMutation.mutate()}
          disabled={!name.trim() || createMutation.isPending}
          className="flex-1 rounded-lg bg-blue-500 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          {createMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
          ) : (
            "저장"
          )}
        </button>
        <button
          onClick={onClose}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--muted)] transition-colors"
        >
          취소
        </button>
      </div>
    </div>
  );
}
