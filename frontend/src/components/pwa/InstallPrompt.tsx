"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Share } from "lucide-react";
import { usePWAInstall } from "@/lib/hooks/usePWAInstall";

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_DAYS = 7;

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function InstallPrompt() {
  const { canInstall, isInstalled, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(true);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(DISMISS_KEY);
    if (stored) {
      const dismissedAt = new Date(stored).getTime();
      const now = Date.now();
      const daysPassed = (now - dismissedAt) / (1000 * 60 * 60 * 24);
      setDismissed(daysPassed < DISMISS_DAYS);
    } else {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    setShowIOSGuide(false);
    localStorage.setItem(DISMISS_KEY, new Date().toISOString());
  };

  const handleInstall = async () => {
    const accepted = await install();
    if (accepted) setDismissed(true);
  };

  // iOS: beforeinstallprompt 미지원 → 수동 안내
  const showIOS = isIOS() && !isInstalled && !dismissed;
  // Android/Desktop: 브라우저 설치 프롬프트 사용
  const showNative = canInstall && !dismissed;

  if (!showNative && !showIOS) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-16 left-3 right-3 z-40 md:hidden"
      >
        <div className="glass-card p-4">
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-1 rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" />
          </button>

          {showIOS && !showIOSGuide ? (
            <div className="flex items-center gap-3 pr-6">
              <div className="rounded-xl bg-blue-500/10 p-2.5 shrink-0">
                <Download className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">앱으로 설치하기</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  홈 화면에서 바로 접근하세요
                </p>
              </div>
              <button
                onClick={() => setShowIOSGuide(true)}
                className="shrink-0 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white"
              >
                방법 보기
              </button>
            </div>
          ) : showIOS && showIOSGuide ? (
            <div className="pr-6">
              <p className="font-medium text-sm mb-2">홈 화면에 추가하기</p>
              <div className="space-y-2 text-xs text-[var(--muted-foreground)]">
                <p className="flex items-center gap-2">
                  <Share className="h-4 w-4 text-blue-500 shrink-0" />
                  하단의 <strong>공유</strong> 버튼을 탭하세요
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-blue-500 shrink-0 text-base">+</span>
                  <strong>홈 화면에 추가</strong>를 선택하세요
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 pr-6">
              <div className="rounded-xl bg-blue-500/10 p-2.5 shrink-0">
                <Download className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">앱으로 설치하기</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  홈 화면에서 바로 접근하세요
                </p>
              </div>
              <button
                onClick={handleInstall}
                className="shrink-0 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white"
              >
                설치
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
