import { useRef, useState, useCallback } from "react";

interface SwipeState {
  openItemKey: string | null;
  swipeOffsets: Record<string, number>;
}

export function useSwipeGesture() {
  const [openItemKey, setOpenItemKey] = useState<string | null>(null);
  const [swipeOffsets, setSwipeOffsets] = useState<Record<string, number>>({});
  const swipeRef = useRef<{
    key: string | null;
    startX: number;
    startY: number;
    baseOffset: number;
    isHorizontal: boolean;
  }>({
    key: null,
    startX: 0,
    startY: 0,
    baseOffset: 0,
    isHorizontal: false,
  });

  const getItemKey = useCallback(
    (keywordId: number, itemId: number) => `${keywordId}-${itemId}`,
    []
  );

  const handleTouchStart = useCallback(
    (key: string, e: React.TouchEvent<HTMLDivElement>) => {
      const touch = e.touches[0];
      setOpenItemKey((prev) => {
        if (prev && prev !== key) {
          setSwipeOffsets((offsets) => ({ ...offsets, [prev]: 0 }));
          return null;
        }
        return prev;
      });
      swipeRef.current = {
        key,
        startX: touch.clientX,
        startY: touch.clientY,
        baseOffset:
          swipeOffsets[key] ?? 0,
        isHorizontal: false,
      };
    },
    [swipeOffsets]
  );

  const handleTouchMove = useCallback(
    (key: string, actionWidth: number, e: React.TouchEvent<HTMLDivElement>) => {
      if (swipeRef.current.key !== key) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - swipeRef.current.startX;
      const deltaY = touch.clientY - swipeRef.current.startY;

      if (!swipeRef.current.isHorizontal) {
        if (Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY)) {
          swipeRef.current.isHorizontal = true;
        } else {
          return;
        }
      }

      const nextOffset = Math.max(
        0,
        Math.min(actionWidth, swipeRef.current.baseOffset - deltaX)
      );
      setSwipeOffsets((prev) => ({ ...prev, [key]: nextOffset }));
    },
    []
  );

  const handleTouchEnd = useCallback(
    (key: string, actionWidth: number) => {
      if (swipeRef.current.key !== key) return;
      const current = swipeOffsets[key] ?? 0;
      const shouldOpen = current >= actionWidth * 0.45;
      const nextOffset = shouldOpen ? actionWidth : 0;
      setSwipeOffsets((prev) => ({ ...prev, [key]: nextOffset }));
      setOpenItemKey(shouldOpen ? key : null);
      swipeRef.current.key = null;
    },
    [swipeOffsets]
  );

  const getCurrentOffset = useCallback(
    (itemKey: string, actionWidth: number, hasActions: boolean): number => {
      if (!hasActions) return 0;
      return (
        swipeOffsets[itemKey] ??
        (openItemKey === itemKey ? actionWidth : 0)
      );
    },
    [swipeOffsets, openItemKey]
  );

  return {
    openItemKey,
    getItemKey,
    getCurrentOffset,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
