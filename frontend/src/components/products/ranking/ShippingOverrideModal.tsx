"use client";

import { Truck, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ShippingTarget {
  naver_product_id: string;
  product_name: string;
  mall_name: string;
  currentFee: number;
  isOverride: boolean;
}

interface Props {
  shippingTarget: ShippingTarget;
  shippingFeeInput: string;
  onShippingFeeInputChange: (value: string) => void;
  onCancel: () => void;
  onAdd: (data: {
    naver_product_id: string;
    shipping_fee: number;
    naver_product_name?: string;
    mall_name?: string;
  }) => void;
  onUpdate: (data: {
    naver_product_id: string;
    shipping_fee: number;
  }) => void;
  onRemove: (naverProductId: string) => void;
  isAddPending: boolean;
  isUpdatePending: boolean;
  isRemovePending: boolean;
}

export function ShippingOverrideModal({
  shippingTarget,
  shippingFeeInput,
  onShippingFeeInputChange,
  onCancel,
  onAdd,
  onUpdate,
  onRemove,
  isAddPending,
  isUpdatePending,
  isRemovePending,
}: Props) {
  const isSaving = isAddPending || isUpdatePending;

  const handleSubmit = () => {
    const fee = parseInt(shippingFeeInput, 10);
    if (isNaN(fee) || fee < 0 || fee > 100000) {
      toast.error("0 ~ 100,000 범위의 배송비를 입력해주세요");
      return;
    }
    if (shippingTarget.isOverride) {
      onUpdate({
        naver_product_id: shippingTarget.naver_product_id,
        shipping_fee: fee,
      });
    } else {
      onAdd({
        naver_product_id: shippingTarget.naver_product_id,
        shipping_fee: fee,
        naver_product_name: shippingTarget.product_name,
        mall_name: shippingTarget.mall_name,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass-card mx-4 w-full max-w-sm p-6 space-y-4">
        <div>
          <h3 className="text-lg font-bold">배송비 수동 입력</h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            자동 감지에 실패한 배송비를 직접 입력합니다. 다음 크롤링부터 이
            값이 적용됩니다.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-3">
          <div className="text-xs text-[var(--muted-foreground)]">판매자</div>
          <div className="truncate text-sm font-medium">
            {shippingTarget.mall_name}
          </div>
          <div className="mt-2 text-xs text-[var(--muted-foreground)]">
            선택 상품
          </div>
          <div className="line-clamp-2 text-sm">
            {shippingTarget.product_name}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            배송비 (원)
          </label>
          <input
            type="number"
            min={0}
            max={100000}
            value={shippingFeeInput}
            onChange={(e) => onShippingFeeInputChange(e.target.value)}
            placeholder="0"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            autoFocus
          />
          <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
            0원 입력 시 무료배송으로 처리됩니다.
          </p>
        </div>
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-sm font-medium hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
          >
            취소
          </button>
          {shippingTarget.isOverride && (
            <button
              type="button"
              onClick={() =>
                onRemove(shippingTarget.naver_product_id)
              }
              disabled={isRemovePending}
              className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-500/15 transition-colors disabled:opacity-50"
            >
              해제
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="flex-1 rounded-xl bg-cyan-500 py-2.5 text-sm font-semibold text-white hover:bg-cyan-600 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Truck className="h-4 w-4" />
            )}
            적용
          </button>
        </div>
      </div>
    </div>
  );
}
