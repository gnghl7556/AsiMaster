"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { costsApi } from "@/lib/api/costs";
import { productsApi } from "@/lib/api/products";
import { MarginDetail } from "@/components/products/MarginDetail";
import { cn } from "@/lib/utils/cn";
import type { CostItemInput, ProductCostItem } from "@/lib/api/costs";
import type {
  ProductDetail,
  MarginDetail as MarginDetailType,
} from "@/types";

interface ProductProfitabilitySectionProps {
  product: ProductDetail;
  userId: number;
  productId: number;
  highlightedAnchor: "basic-info" | "profitability" | null;
}

export function ProductProfitabilitySection({
  product,
  userId,
  productId,
  highlightedAnchor,
}: ProductProfitabilitySectionProps) {
  const queryClient = useQueryClient();

  const { data: costPresets = [] } = useQuery({
    queryKey: ["cost-presets", userId],
    queryFn: () => costsApi.getPresets(userId),
    enabled: !!userId,
  });

  const { data: costItems = [] } = useQuery({
    queryKey: ["product-cost-items", productId],
    queryFn: () => costsApi.getItems(userId, productId),
    enabled: !!userId && !!productId,
  });

  const [editableCostPrice, setEditableCostPrice] = useState("");
  const [editableCostItems, setEditableCostItems] = useState<CostItemInput[]>([
    { name: "", type: "percent", value: 0 },
  ]);
  const [selectedCostPresetId, setSelectedCostPresetId] = useState<number | null>(null);
  const [simPrice, setSimPrice] = useState("");
  const [simulatedMargin, setSimulatedMargin] = useState<MarginDetailType | null>(null);

  useEffect(() => {
    if (!product) return;
    setEditableCostPrice(String(product.cost_price ?? ""));
  }, [product]);

  useEffect(() => {
    const mapped: CostItemInput[] = costItems
      .filter((item) => item.source_preset_id == null)
      .map((item) => ({
        name: item.name ?? "",
        type: (item.type === "fixed" ? "fixed" : "percent") as "fixed" | "percent",
        value: Number(item.value ?? 0),
      }));
    setEditableCostItems(mapped.length > 0 ? mapped : [{ name: "", type: "percent", value: 0 }]);
  }, [costItems]);

  const updateCostPriceMutation = useMutation({
    mutationFn: (cost_price: number) =>
      productsApi.update(userId, productId, { cost_price }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("매입비용이 수정되었습니다");
    },
    onError: () => toast.error("매입비용 수정에 실패했습니다"),
  });

  const saveCostItemsMutation = useMutation({
    mutationFn: (items: CostItemInput[]) => costsApi.saveItems(userId, productId, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-cost-items", productId] });
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      toast.success("비용 항목이 저장되었습니다");
    },
    onError: () => toast.error("비용 항목 저장에 실패했습니다"),
  });

  const applyCostPresetMutation = useMutation({
    mutationFn: (presetId: number) => costsApi.applyPreset(presetId, [productId]),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["product-cost-items", productId] });
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setSelectedCostPresetId(null);
      toast.success(
        result.applied > 0
          ? `프리셋 적용 완료${result.skipped > 0 ? ` (${result.skipped}개 스킵${result.skipped_reason ? `: ${result.skipped_reason}` : ""})` : ""}`
          : `적용되지 않았습니다${result.skipped_reason ? `: ${result.skipped_reason}` : ""}`
      );
    },
    onError: () => toast.error("프리셋 적용에 실패했습니다"),
  });

  const detachCostPresetMutation = useMutation({
    mutationFn: (presetId: number) => costsApi.detachPreset(presetId, [productId]),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["product-cost-items", productId] });
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(result.detached > 0 ? "프리셋을 해제했습니다" : "해제할 프리셋 항목이 없습니다");
    },
    onError: () => toast.error("프리셋 해제에 실패했습니다"),
  });

  const simMutation = useMutation({
    mutationFn: (price: number) => costsApi.simulateMargin(productId, price),
    onSuccess: (data) => setSimulatedMargin(data),
  });

  const handleSimulate = () => {
    const price = Number(simPrice);
    if (price > 0) simMutation.mutate(price);
  };

  const handleSaveCostPrice = () => {
    const nextCostPrice = Number(editableCostPrice);
    if (!Number.isFinite(nextCostPrice) || nextCostPrice <= 0) return;
    if (nextCostPrice === product.cost_price) return;
    updateCostPriceMutation.mutate(nextCostPrice);
  };

  const normalizedFetchedCostItems = costItems
    .filter((item) => item.source_preset_id == null)
    .map((item) => ({
      name: item.name.trim(),
      type: item.type === "fixed" ? "fixed" : "percent",
      value: Number(item.value ?? 0),
    }));
  const normalizedEditableCostItems = editableCostItems
    .map((item) => ({
      name: item.name.trim(),
      type: item.type,
      value: Number(item.value ?? 0),
    }))
    .filter((item) => item.name.length > 0);
  const costItemsDirty =
    JSON.stringify(normalizedEditableCostItems) !== JSON.stringify(normalizedFetchedCostItems);

  const currentCostPresetNames = (product.cost_preset_ids ?? [])
    .map((id) => costPresets.find((preset) => preset.id === id)?.name)
    .filter(Boolean) as string[];
  const presetCostItems = costItems.filter(
    (item) => item.source_preset_id != null
  ) as ProductCostItem[];

  const handleApplyCostPreset = () => {
    if (!selectedCostPresetId) return;
    if ((product.cost_preset_ids ?? []).includes(selectedCostPresetId)) {
      toast.info("이미 적용된 프리셋입니다");
      return;
    }
    applyCostPresetMutation.mutate(selectedCostPresetId);
  };

  const handleSaveCostItems = () => {
    if (!normalizedEditableCostItems.length) {
      toast.error("최소 1개 이상의 비용 항목을 입력해주세요");
      return;
    }
    saveCostItemsMutation.mutate(normalizedEditableCostItems);
  };

  if (!product.margin) return null;

  return (
    <div
      id="profitability"
      className={cn(
        "scroll-mt-24 rounded-2xl transition-shadow",
        highlightedAnchor === "profitability" &&
          "ring-2 ring-emerald-500/30 shadow-[0_0_0_4px_rgba(16,185,129,0.07)]"
      )}
    >
      <MarginDetail
        margin={product.margin}
        simulatedMargin={simulatedMargin}
        costPriceInput={editableCostPrice}
        setCostPriceInput={setEditableCostPrice}
        currentCostPrice={product.cost_price}
        isSavingCostPrice={updateCostPriceMutation.isPending}
        onSaveCostPrice={handleSaveCostPrice}
        simPrice={simPrice}
        setSimPrice={setSimPrice}
        currentSellingPrice={product.selling_price}
        isSimulating={simMutation.isPending}
        onSimulate={handleSimulate}
        costItemsEditor={editableCostItems}
        onChangeCostItem={(index, updated) =>
          setEditableCostItems((prev) => prev.map((item, i) => (i === index ? updated : item)))
        }
        onAddCostItem={() =>
          setEditableCostItems((prev) => [...prev, { name: "", type: "percent", value: 0 }])
        }
        onRemoveCostItem={(index) =>
          setEditableCostItems((prev) =>
            prev.length > 1 ? prev.filter((_, i) => i !== index) : prev
          )
        }
        onSaveCostItems={handleSaveCostItems}
        isSavingCostItems={saveCostItemsMutation.isPending}
        costItemsDirty={costItemsDirty}
        costPresets={costPresets}
        selectedCostPresetId={selectedCostPresetId}
        setSelectedCostPresetId={setSelectedCostPresetId}
        onApplyCostPreset={handleApplyCostPreset}
        isApplyingCostPreset={applyCostPresetMutation.isPending}
        appliedCostPresetIds={product.cost_preset_ids ?? []}
        currentCostPresetNames={currentCostPresetNames}
        presetCostItems={presetCostItems}
        onDetachCostPreset={(presetId) => detachCostPresetMutation.mutate(presetId)}
        detachingPresetId={detachCostPresetMutation.isPending ? (detachCostPresetMutation.variables ?? null) : null}
      />
    </div>
  );
}
