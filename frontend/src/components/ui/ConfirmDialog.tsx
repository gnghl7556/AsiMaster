"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Variant = "danger" | "warning" | "default";

const variantStyles: Record<Variant, string> = {
  danger:
    "bg-red-500 text-white hover:bg-red-600 disabled:opacity-50",
  warning:
    "bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50",
  default:
    "bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50",
};

interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: Variant;
  isPending?: boolean;
  confirmIcon?: ReactNode;
}

export function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = "확인",
  cancelText = "취소",
  variant = "default",
  isPending = false,
  confirmIcon,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass-card mx-4 w-full max-w-sm p-6 space-y-4">
        <h3 className="text-lg font-bold">{title}</h3>
        <div className="text-sm text-[var(--muted-foreground)]">{message}</div>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={cn(
              "flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2",
              variantStyles[variant]
            )}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              confirmIcon
            )}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
