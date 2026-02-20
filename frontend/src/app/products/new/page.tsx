"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { productsApi } from "@/lib/api/products";
import { useUserStore } from "@/stores/useUserStore";

export default function NewProductPage() {
  const router = useRouter();
  const userId = useUserStore((s) => s.currentUserId);
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: "",
    category: "",
    cost_price: "",
    selling_price: "",
    image_url: "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      productsApi.create(userId!, {
        name: form.name,
        category: form.category || undefined,
        cost_price: Number(form.cost_price),
        selling_price: Number(form.selling_price),
        image_url: form.image_url || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("상품이 등록되었습니다");
      router.push("/products");
    },
    onError: () => toast.error("상품 등록에 실패했습니다"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.cost_price || !form.selling_price) {
      toast.error("필수 항목을 입력해주세요");
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-6">상품 등록</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">상품명 *</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            placeholder="에어팟 프로2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">카테고리</label>
          <input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            placeholder="이어폰"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">매입가 *</label>
            <input
              type="number"
              value={form.cost_price}
              onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              placeholder="168000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">판매가 *</label>
            <input
              type="number"
              value={form.selling_price}
              onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              placeholder="219000"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">이미지 URL</label>
          <input
            value={form.image_url}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            placeholder="https://..."
          />
        </div>
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-sm text-blue-600 dark:text-blue-400">
          상품을 등록하면 네이버 쇼핑 최저가가 자동으로 모니터링됩니다.
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 rounded-lg border border-[var(--border)] py-2.5 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 rounded-lg bg-blue-500 py-2.5 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? "등록 중..." : "등록"}
          </button>
        </div>
      </form>
    </div>
  );
}
