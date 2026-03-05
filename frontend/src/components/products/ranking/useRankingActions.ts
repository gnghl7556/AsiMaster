import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { productsApi } from "@/lib/api/products";

interface ExcludeTarget {
  naver_product_id: string;
  product_name: string;
  mall_name: string;
}

interface ShippingTarget {
  naver_product_id: string;
  product_name: string;
  mall_name: string;
  currentFee: number;
  isOverride: boolean;
}

export function useRankingActions(productId: number) {
  const queryClient = useQueryClient();
  const [excludeTarget, setExcludeTarget] = useState<ExcludeTarget | null>(
    null
  );
  const [shippingTarget, setShippingTarget] = useState<ShippingTarget | null>(
    null
  );
  const [shippingFeeInput, setShippingFeeInput] = useState("");

  const excludeMutation = useMutation({
    mutationFn: (item: ExcludeTarget) =>
      productsApi.excludeProduct(productId, {
        naver_product_id: item.naver_product_id,
        naver_product_name: item.product_name,
        mall_name: item.mall_name,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      queryClient.invalidateQueries({
        queryKey: ["excluded-products", productId],
      });
      setExcludeTarget(null);
      toast.success("해당 경쟁상품이 제외되었습니다");
    },
    onError: () => toast.error("제외에 실패했습니다"),
  });

  const addIncludedOverrideMutation = useMutation({
    mutationFn: (item: {
      naver_product_id: string;
      product_name: string;
      mall_name: string;
    }) =>
      productsApi.addIncludedOverride(productId, {
        naver_product_id: item.naver_product_id,
        naver_product_name: item.product_name,
        mall_name: item.mall_name,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      queryClient.invalidateQueries({
        queryKey: ["included-overrides", productId],
      });
      toast.success("자동필터 예외로 다시 포함했습니다");
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.detail || "다시 포함 처리에 실패했습니다"
      );
    },
  });

  const removeIncludedOverrideMutation = useMutation({
    mutationFn: (naverProductId: string) =>
      productsApi.removeIncludedOverride(productId, naverProductId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      queryClient.invalidateQueries({
        queryKey: ["included-overrides", productId],
      });
      toast.success("수동 포함 예외를 해제했습니다");
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.detail || "예외 해제에 실패했습니다"
      );
    },
  });

  const addShippingOverrideMutation = useMutation({
    mutationFn: (data: {
      naver_product_id: string;
      shipping_fee: number;
      naver_product_name?: string;
      mall_name?: string;
    }) => productsApi.addShippingOverride(productId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      setShippingTarget(null);
      toast.success("배송비가 설정되었습니다");
    },
    onError: (error: any) =>
      toast.error(
        error?.response?.data?.detail || "배송비 설정에 실패했습니다"
      ),
  });

  const updateShippingOverrideMutation = useMutation({
    mutationFn: (data: { naver_product_id: string; shipping_fee: number }) =>
      productsApi.updateShippingOverride(
        productId,
        data.naver_product_id,
        data.shipping_fee
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      setShippingTarget(null);
      toast.success("배송비가 수정되었습니다");
    },
    onError: (error: any) =>
      toast.error(
        error?.response?.data?.detail || "배송비 수정에 실패했습니다"
      ),
  });

  const removeShippingOverrideMutation = useMutation({
    mutationFn: (naverProductId: string) =>
      productsApi.removeShippingOverride(productId, naverProductId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-detail"] });
      setShippingTarget(null);
      toast.success("수동 배송비가 해제되었습니다");
    },
    onError: (error: any) =>
      toast.error(
        error?.response?.data?.detail || "배송비 해제에 실패했습니다"
      ),
  });

  const requestExclude = (item: ExcludeTarget) => {
    setExcludeTarget(item);
  };

  const handleAddIncludedOverride = (item: {
    naver_product_id: string | null;
    product_name: string;
    mall_name: string;
  }) => {
    if (!item.naver_product_id) {
      toast.error("상품 식별자가 없어 다시 포함할 수 없습니다");
      return;
    }
    addIncludedOverrideMutation.mutate({
      naver_product_id: item.naver_product_id,
      product_name: item.product_name,
      mall_name: item.mall_name,
    });
  };

  const handleShippingClick = (item: {
    naver_product_id: string | null;
    product_name: string;
    mall_name: string;
    shipping_fee: number;
    is_shipping_override?: boolean;
  }) => {
    if (!item.naver_product_id) return;
    setShippingTarget({
      naver_product_id: item.naver_product_id,
      product_name: item.product_name,
      mall_name: item.mall_name,
      currentFee: item.shipping_fee || 0,
      isOverride: item.is_shipping_override ?? false,
    });
    setShippingFeeInput(
      item.is_shipping_override ? String(item.shipping_fee || 0) : ""
    );
  };

  return {
    excludeTarget,
    setExcludeTarget,
    shippingTarget,
    setShippingTarget,
    shippingFeeInput,
    setShippingFeeInput,
    excludeMutation,
    addIncludedOverrideMutation,
    removeIncludedOverrideMutation,
    addShippingOverrideMutation,
    updateShippingOverrideMutation,
    removeShippingOverrideMutation,
    requestExclude,
    handleAddIncludedOverride,
    handleShippingClick,
  };
}
